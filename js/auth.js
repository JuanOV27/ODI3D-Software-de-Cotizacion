/**
 * auth.js — Verificación de sesión y menú dinámico por rol
 * Incluir en TODOS los módulos HTML del sistema (excepto login.html).
 *
 * Uso:
 *   <script src="js/auth.js"></script>
 * Se llama automáticamente en DOMContentLoaded.
 */

(function () {
    'use strict';

    // --------------------------------------------------------
    // Detectar base URL del sistema
    // --------------------------------------------------------
    const BASE = (() => {
        const scripts = document.querySelectorAll('script[src]');
        for (const s of scripts) {
            const match = s.src.match(/^(.*\/gestion3d)/);
            if (match) return match[1];
        }
        const m = location.pathname.match(/^(\/gestion3d)/);
        return m ? m[1] : '/gestion3d';
    })();

    // --------------------------------------------------------
    // Matriz de permisos: qué ítems del menú ve cada rol
    // --------------------------------------------------------
    const PERMISOS_MENU = {
        admin: [
            'nav-dashboard', 'nav-cotizacion', 'nav-historial',
            'nav-inventario', 'nav-suministros', 'nav-maquinas',
            'nav-perfiles', 'nav-fabricacion', 'nav-catalogo',
            'nav-solicitudes', 'nav-chat', 'nav-usuarios',
            'nav-modulos', 'nav-metricas'
        ],
        // Según la matriz de permisos: el empleado NO ve métricas financieras
        // (nav-dashboard) ni la gestión del catálogo de productos (nav-catalogo)
        empleado: [
            'nav-cotizacion', 'nav-historial',
            'nav-fabricacion', 'nav-solicitudes', 'nav-chat'
        ]
    };

    // --------------------------------------------------------
    // Verificar sesión activa al cargar cada página
    // --------------------------------------------------------
    async function verificarSesion() {
        try {
            const resp = await fetch(`${BASE}/api/api_auth.php?action=check_session`, {
                method: 'GET',
                cache: 'no-store',
                credentials: 'same-origin'
            });

            // Si el servidor no responde correctamente redirigir a login
            if (!resp.ok && resp.status !== 401) {
                redirigirLogin();
                return;
            }

            const json = await resp.json();

            if (!json.success || !json.data?.autenticado) {
                redirigirLogin();
                return;
            }

            // Sesión válida — mostrar contenido
            mostrarContenido();

            // Guardar datos del usuario en window para uso en otras páginas
            window.sessionUsuario = json.data;

            // Actualizar UI con datos del usuario
            actualizarUIUsuario(json.data);

            // Renderizar menú según rol
            renderizarMenu(json.data.rol);

        } catch (err) {
            // Error de red — redirigir a login
            redirigirLogin();
        }
    }

    // --------------------------------------------------------
    // Redirigir a login reemplazando el historial para que el
    // botón "atrás" no pueda volver a la página protegida
    // --------------------------------------------------------
    function redirigirLogin() {
        window.location.replace(`${BASE}/login.html`);
    }

    // --------------------------------------------------------
    // Ocultar/mostrar el contenido de la página mientras se
    // verifica la sesión (evita el flash de contenido protegido)
    // --------------------------------------------------------
    function ocultarContenido() {
        document.documentElement.style.visibility = 'hidden';
    }

    function mostrarContenido() {
        document.documentElement.style.visibility = '';
    }

    // --------------------------------------------------------
    // Actualizar elementos de UI con los datos del usuario
    // --------------------------------------------------------
    function actualizarUIUsuario(usuario) {
        const elNombre = document.getElementById('usuarioNombre');
        if (elNombre) elNombre.textContent = usuario.nombre;

        const elRol = document.getElementById('usuarioRol');
        if (elRol) elRol.textContent = usuario.rol === 'admin' ? 'Administrador' : 'Empleado';

        const elBadge = document.getElementById('rolBadge');
        if (elBadge) {
            elBadge.textContent = usuario.rol === 'admin' ? 'Admin' : 'Empleado';
            elBadge.className = `rol-badge rol-${usuario.rol}`;
        }

        // Mostrar la barra de usuario
        const elHeader = document.getElementById('headerUsuario');
        if (elHeader) elHeader.style.display = '';
    }

    // --------------------------------------------------------
    // Mostrar/ocultar ítems del menú según el rol
    // --------------------------------------------------------
    function renderizarMenu(rol) {
        const permitidos = PERMISOS_MENU[rol] || [];

        // Ocultar todos los ítems con clase menu-item-rol
        document.querySelectorAll('[data-nav-id]').forEach(el => {
            const navId = el.dataset.navId;
            el.style.display = permitidos.includes(navId) ? '' : 'none';
        });
    }

    // --------------------------------------------------------
    // Cerrar sesión
    // --------------------------------------------------------
    window.cerrarSesion = async function () {
        try {
            await fetch(`${BASE}/api/api_auth.php?action=logout`, {
                method: 'GET',
                cache: 'no-store',
                credentials: 'same-origin'
            });
        } catch (_) {}
        // replace() borra esta página del historial: el botón "atrás"
        // no podrá volver a ella después de cerrar sesión
        window.location.replace(`${BASE}/login.html`);
    };

    // --------------------------------------------------------
    // Arrancar: ocultar contenido de inmediato para evitar
    // que se vea brevemente antes de verificar la sesión
    // --------------------------------------------------------
    ocultarContenido();

    // Verificar sesión en carga normal del DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', verificarSesion);
    } else {
        verificarSesion();
    }

    // Verificar sesión cuando el navegador restaura la página desde
    // el bfcache (botón "atrás"/"adelante" del navegador)
    window.addEventListener('pageshow', function (event) {
        if (event.persisted) {
            // La página viene del bfcache — re-verificar sesión
            ocultarContenido();
            verificarSesion();
        }
    });
})();
