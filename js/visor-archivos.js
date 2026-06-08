// Vista previa de imágenes y visor 3D (STL/OBJ) para los archivos adjuntos
// del Panel de Solicitudes. Sin bundler: three.js se resuelve vía importmap
// (ver panel-solicitudes.html). Expone window.VisorArchivos para uso desde
// el script clásico de la página.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

const EXTENSIONES_IMAGEN = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
const EXTENSIONES_3D = ['stl', 'obj'];

function obtenerExtension(nombre) {
    const partes = String(nombre || '').split('.');
    return partes.length > 1 ? partes.pop().toLowerCase() : '';
}

function tipoDeArchivo(nombre) {
    const ext = obtenerExtension(nombre);
    if (EXTENSIONES_IMAGEN.includes(ext)) return 'imagen';
    if (EXTENSIONES_3D.includes(ext)) return 'modelo3d';
    return 'otro';
}

// ── Miniatura ─────────────────────────────────────────────────
function crearMiniatura(archivo, urlDescarga) {
    const tipo = tipoDeArchivo(archivo.nombre_original);
    const icono = tipo === 'imagen' ? '🖼️' : (tipo === 'modelo3d' ? '🧊' : '📎');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'archivo-chip archivo-chip-visor';
    btn.innerHTML =
        `<span class="archivo-chip-icono">${icono}</span>` +
        `<span class="archivo-chip-nombre"></span>`;
    btn.querySelector('.archivo-chip-nombre').textContent = archivo.nombre_original;
    btn.addEventListener('click', () => abrirModal(archivo, urlDescarga, tipo));

    if (tipo === 'imagen') {
        fetch(urlDescarga)
            .then(r => (r.ok ? r.blob() : null))
            .then(blob => {
                if (!blob) return;
                const url = URL.createObjectURL(blob);
                const img = document.createElement('img');
                img.src = url;
                img.alt = '';
                img.className = 'archivo-chip-img';
                btn.querySelector('.archivo-chip-icono').replaceWith(img);
            })
            .catch(() => {});
    }

    return btn;
}

// ── Modal de previsualización ─────────────────────────────────
let modalEl = null;
let escenaActual = null;

function asegurarModal() {
    if (modalEl) return modalEl;
    modalEl = document.createElement('div');
    modalEl.className = 'visor-modal-overlay';
    modalEl.innerHTML =
        '<div class="visor-modal">' +
        '  <div class="visor-modal-header">' +
        '    <span class="visor-modal-titulo"></span>' +
        '    <button type="button" class="visor-modal-cerrar">✕</button>' +
        '  </div>' +
        '  <div class="visor-modal-body"></div>' +
        '</div>';
    modalEl.querySelector('.visor-modal-cerrar').addEventListener('click', cerrarModal);
    modalEl.addEventListener('click', (e) => { if (e.target === modalEl) cerrarModal(); });
    document.body.appendChild(modalEl);
    return modalEl;
}

function cerrarModal() {
    if (!modalEl) return;
    modalEl.classList.remove('activo');
    if (escenaActual) {
        escenaActual.detener();
        escenaActual = null;
    }
}

async function abrirModal(archivo, urlDescarga, tipo) {
    const modal = asegurarModal();
    modal.querySelector('.visor-modal-titulo').textContent = archivo.nombre_original;
    const body = modal.querySelector('.visor-modal-body');
    body.innerHTML = '<p class="visor-modal-msg">Cargando vista previa...</p>';
    modal.classList.add('activo');
    if (escenaActual) { escenaActual.detener(); escenaActual = null; }

    if (tipo === 'otro') {
        body.innerHTML =
            '<p class="visor-modal-msg">Vista previa no disponible para este tipo de archivo.<br>' +
            `<a href="${urlDescarga}" target="_blank">Descargar archivo</a></p>`;
        return;
    }

    try {
        const resp = await fetch(urlDescarga);
        if (!resp.ok) throw new Error('descarga fallida');
        const blob = await resp.blob();

        if (tipo === 'imagen') {
            const url = URL.createObjectURL(blob);
            body.innerHTML = '';
            const img = document.createElement('img');
            img.src = url;
            img.className = 'visor-modal-imagen';
            body.appendChild(img);
        } else {
            const buffer = await blob.arrayBuffer();
            body.innerHTML = '<div class="visor-modal-3d"></div>';
            const contenedor = body.querySelector('.visor-modal-3d');
            escenaActual = crearEscena3D(contenedor, buffer, obtenerExtension(archivo.nombre_original));
        }
    } catch (e) {
        body.innerHTML = '<p class="visor-modal-msg">No se pudo cargar la vista previa.</p>';
    }
}

// ── Escena Three.js para STL/OBJ ──────────────────────────────
function crearEscena3D(contenedor, buffer, extension) {
    const ancho = contenedor.clientWidth || 600;
    const alto = contenedor.clientHeight || 400;

    const escena = new THREE.Scene();
    escena.background = new THREE.Color(0x1a1a1a);

    const camara = new THREE.PerspectiveCamera(45, ancho / alto, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(ancho, alto);
    contenedor.appendChild(renderer.domElement);

    escena.add(new THREE.AmbientLight(0xffffff, 0.6));
    const luz1 = new THREE.DirectionalLight(0xffffff, 0.8);
    luz1.position.set(1, 1, 1);
    escena.add(luz1);
    const luz2 = new THREE.DirectionalLight(0xffffff, 0.4);
    luz2.position.set(-1, -0.5, -1);
    escena.add(luz2);

    const controles = new OrbitControls(camara, renderer.domElement);
    controles.enableDamping = true;

    const material = new THREE.MeshStandardMaterial({ color: 0xf5c518, metalness: 0.15, roughness: 0.6 });
    let objeto = null;
    if (extension === 'stl') {
        const geometria = new STLLoader().parse(buffer);
        geometria.computeVertexNormals();
        objeto = new THREE.Mesh(geometria, material);
        escena.add(objeto);
    } else if (extension === 'obj') {
        const texto = new TextDecoder().decode(buffer);
        objeto = new OBJLoader().parse(texto);
        objeto.traverse((nodo) => { if (nodo.isMesh) nodo.material = material; });
        escena.add(objeto);
    }

    if (objeto) {
        const caja = new THREE.Box3().setFromObject(objeto);
        const centro = caja.getCenter(new THREE.Vector3());
        const tamano = caja.getSize(new THREE.Vector3());
        objeto.position.sub(centro);
        const radio = Math.max(tamano.x, tamano.y, tamano.z) || 1;
        camara.position.set(radio * 1.6, radio * 1.2, radio * 1.6);
        camara.near = radio / 100;
        camara.far = radio * 100;
        camara.updateProjectionMatrix();
        controles.target.set(0, 0, 0);
        controles.update();
    }

    let frameId;
    function animar() {
        frameId = requestAnimationFrame(animar);
        controles.update();
        renderer.render(escena, camara);
    }
    animar();

    function ajustar() {
        const a = contenedor.clientWidth;
        const h = contenedor.clientHeight;
        if (!a || !h) return;
        camara.aspect = a / h;
        camara.updateProjectionMatrix();
        renderer.setSize(a, h);
    }
    window.addEventListener('resize', ajustar);

    return {
        detener() {
            window.removeEventListener('resize', ajustar);
            cancelAnimationFrame(frameId);
            controles.dispose();
            renderer.dispose();
            if (contenedor.contains(renderer.domElement)) contenedor.removeChild(renderer.domElement);
        },
    };
}

window.VisorArchivos = { crearMiniatura };
