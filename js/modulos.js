/**
 * modulos.js — Feature flags del sistema ODI3D
 * Uso: llamar verificarModulo(nombre, contenedor) al cargar cada sección.
 */

const ModulosConfig = {
    baseURL: (() => {
        // Detectar baseURL dinámicamente igual que config.js
        const scripts = document.querySelectorAll('script[src]');
        for (const s of scripts) {
            const match = s.src.match(/(.+\/gestion3d)\//);
            if (match) return match[1] + '/api';
        }
        return '/gestion3d/api';
    })()
};

/**
 * Consulta el estado de un módulo y decide qué renderizar.
 *
 * @param {string} nombre       Nombre del módulo (ej: 'catalogo')
 * @param {Element} contenedor  Elemento DOM que contiene el módulo
 * @returns {Promise<boolean>}  true si el módulo está activo
 */
async function verificarModulo(nombre, contenedor) {
    try {
        const resp = await fetch(
            `${ModulosConfig.baseURL}/api_modulos.php?action=estado&nombre=${encodeURIComponent(nombre)}`
        );
        const json = await resp.json();

        if (!json.success || !json.data?.activo) {
            const mensaje = json.data?.mensaje_baja || 'Módulo temporalmente no disponible.';
            mostrarBannerMantenimiento(contenedor, mensaje);
            return false;
        }

        return true;
    } catch (err) {
        console.warn(`[modulos.js] No se pudo verificar módulo "${nombre}":`, err);
        mostrarBannerMantenimiento(contenedor, 'Servicio temporalmente no disponible.');
        return false;
    }
}

/**
 * Reemplaza el contenido del contenedor con un banner de mantenimiento.
 */
function mostrarBannerMantenimiento(contenedor, mensaje) {
    if (!contenedor) return;
    contenedor.innerHTML = `
        <div class="banner-mantenimiento">
            <div class="banner-icono">🔧</div>
            <h3 class="banner-titulo">Módulo en mantenimiento</h3>
            <p class="banner-mensaje">${mensaje}</p>
        </div>
    `;
}
