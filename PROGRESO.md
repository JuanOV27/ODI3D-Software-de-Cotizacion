# PROGRESO — ODI3D Sistema Integral
Última actualización: 2026-06-04

## Estado general
**Fase 1 completada al 100%** | Fase 2 (tienda3d) pendiente para sesión futura.

---

## Completado en esta sesión

### Base de datos
- `Versiones bd/migracion_fase1.sql` — 11 tablas nuevas + ALTER TABLE cotizaciones
  - `usuarios_internos`, `modulos`, `productos`, `productos_imagenes`, `reviews`
  - `clientes`, `solicitudes_cotizacion`, `solicitudes_archivos`
  - `chat_mensajes`, `pedidos`, `pedidos_items`
  - Admin por defecto: `admin@odi3d.com` / `Admin2024!`

### Autenticación (gestion3d)
- `api/auth_middleware.php` — `requireAuth(['admin','empleado'])` con bloqueo por rol
- `api/api_auth.php` — login (bcrypt, rate limiting 5 intentos/15 min), logout, check_session, get_csrf
- `login.html` — diseño ODI3D negro/amarillo, CSRF token, sin revelar si email existe
- `js/auth.js` — verifica sesión en cada página, renderiza menú por rol, `cerrarSesion()`

### Seguridad transversal
- `api/config.php` — agregadas `generarCSRF()` y `validarCSRF()`
- Todas las APIs existentes protegidas con `requireAuth()`:
  - `api_inventario.php`, `api_suministros.php`, `api_maquinas.php`, `api_perfiles.php` → solo admin
  - `api_cotizaciones.php`, `api_proyectos.php` → admin + empleado
- `.htaccess` raíz — headers `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`
- `uploads/productos/.htaccess` — bloquea PHP, solo imágenes
- `uploads/solicitudes/.htaccess` — bloquea acceso HTTP directo (solo via controller)

### Feature flags
- `api/api_modulos.php` — list, toggle (solo admin), estado (público con caché 60s en sesión)
- `js/modulos.js` — `verificarModulo(nombre, contenedor)` + `mostrarBannerMantenimiento()`

### Menú dinámico por rol
- `index.html` — barra de usuario (nombre, rol badge, "Ver tienda", logout)
- `data-nav-id` en cards admin-only: `nav-inventario`, `nav-suministros`, `nav-maquinas`
- `auth.js` con `renderizarMenu(rol)` oculta ítems sin permiso
- `js/auth.js` añadido a: cotizacion, historial, inventario, suministros, perfiles, centro-fabricacion

### Nuevas páginas y APIs
- `admin-catalogo.html` + `api/api_productos.php` — CRUD productos con upload seguro (magic bytes, UUID, 5MB)
- `panel-solicitudes.html` + `api/api_solicitudes.php` — panel con estados, archivos, vincular cotización
- `api/api_chat.php` — mensajes por solicitud, polling cada 5s, conteo no leídos
- Cards nuevas en `index.html`: "Catálogo de Productos" y "Panel de Solicitudes"

### Directorios nuevos
- `uploads/productos/` — imágenes de productos del catálogo
- `uploads/solicitudes/` — archivos adjuntos de clientes (acceso solo via API)

---

## Pendiente (sesión futura)

### Fase 2A — tienda3d (Laravel backend)
1. `composer create-project laravel/laravel tienda3d` en `C:\xampp\htdocs\`
2. Instalar Sanctum: `composer require laravel/sanctum`
3. Configurar `.env` con puerto 3307 y BD `sistema_gestion_3d`
4. Middleware `CheckModuloActivo`
5. Controllers: `ClienteAuthController`, `ProductoController`, `ReviewController`,
   `PedidoController`, `SolicitudController`, `ChatController`
6. Rutas en `routes/api.php` con grupos `modulo:X` + `auth:sanctum`
7. Endpoint de estado de módulos: `GET /api/modulos/{nombre}/estado`
8. File uploads en `storage/app/private/solicitudes/` (fuera de public)

### Fase 2B — tienda3d-frontend (Vue 3 + Vite + Tailwind)
1. `npm create vite@latest tienda3d-frontend -- --template vue`
2. `npm install vue-router@4 pinia axios`
3. `npm install -D tailwindcss postcss autoprefixer`
4. Paleta: `odi-negro`, `odi-amarillo #F5C518`, `odi-gris`
5. Módulo catálogo: `CatalogoView.vue`, `ProductoDetalle.vue`, `ReviewForm.vue`
6. Módulo solicitudes: `SolicitudForm.vue` (drag&drop), `MiCuenta.vue`, `SolicitudDetalle.vue`
7. Módulo chat: `ChatWindow.vue` con polling
8. Composables: `useModulo.js`, `useAuth.js`, `useWhatsApp.js`
9. Stores Pinia: `auth.store.js`, `carrito.store.js` (sessionStorage)
10. Router con guardia `/admin` para `usuarios_internos`

---

## Para retomar en la próxima sesión

```bash
# 1. Aplicar migración SQL (si no se ha hecho)
#    Importar en phpMyAdmin: Versiones bd/migracion_fase1.sql

# 2. Verificar que el sistema de auth funciona
#    http://localhost/gestion3d/ → debe redirigir a login.html
#    Login: admin@odi3d.com / Admin2024!

# 3. Instalar Laravel
cd C:\xampp\htdocs
composer create-project laravel/laravel tienda3d

# 4. Instalar Vue frontend
npm create vite@latest tienda3d-frontend -- --template vue
```

---

## Notas importantes

- El admin por defecto tiene password `Admin2024!` — cambiar en primer uso real
- Puerto MySQL: **3307** (no 3306)
- CORS sigue abierto (`*`) en config.php — aceptable para desarrollo local
- `api_cotizaciones.php` tiene sus propias funciones `sendSuccess()` / `sendError()` independientes de Utils
- La integración Kiri:Moto (grid-apps) no fue modificada — sigue en `localhost:8080`
- Worktree activo: `claude/peaceful-neumann` → hacer merge a `main` cuando se valide
- El token CSRF se genera en sesión PHP; el login lo obtiene vía `api_auth.php?action=get_csrf`
