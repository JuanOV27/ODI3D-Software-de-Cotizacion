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
        empleado: [
            'nav-dashboard', 'nav-cotizacion', 'nav-historial',
            'nav-fabricacion', 'nav-catalogo', 'nav-solicitudes', 'nav-chat'
        ]
    };

    // --------------------------------------------------------
    // Verificar sesión activa al cargar cada página
    // --------------------------------------------------------
    async function verificarSesion() {
        try {
            const resp = await fetch(`${BASE}/api/api_auth.php?action=check_session`, {
                cache: 'no-store'
            });

            // Si el servidor no responde correctamente redirigir a login
            if (!resp.ok && resp.status !== 401) {
                window.location.href = `${BASE}/login.html`;
                return;
            }

            const json = await resp.json();

            if (!json.success || !json.data?.autenticado) {
                window.location.href = `${BASE}/login.html`;
                return;
            }

            // Guardar datos del usuario en window para uso en otras páginas
            window.sessionUsuario = json.data;

            // Actualizar UI con datos del usuario
            actualizarUIUsuario(json.data);

            // Renderizar menú según rol
            renderizarMenu(json.data.rol);

        } catch (err) {
            // Error de red — redirigir a login
            window.location.href = `${BASE}/login.html`;
        }
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
            await fetch(`${BASE}/api/api_auth.php?action=logout`, { method: 'GET' });
        } catch (_) {}
        window.location.href = `${BASE}/login.html`;
    };

    // --------------------------------------------------------
    // Arrancar al cargar el DOM
    // --------------------------------------------------------
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', verificarSesion);
    } else {
        verificarSesion();
    }
})();
