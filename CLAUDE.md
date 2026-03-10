# Sistema de Gestión 3D — CLAUDE.md

## Descripción del Proyecto

Sistema de gestión para taller de impresión 3D. Permite administrar inventario de filamentos, cotizar proyectos, controlar suministros y gestionar máquinas. La interfaz y el código están en **español**.

URL local: `http://localhost/gestion3d/`

## Stack Tecnológico

- **Frontend**: HTML + CSS + Vanilla JavaScript (sin frameworks, sin bundler)

- **Backend**: PHP 8+ con PDO
- **Base de datos**: MySQL en XAMPP
- **Servidor local**: Apache (XAMPP)

No hay `npm`, `composer`, ni proceso de build. Los cambios en HTML/CSS/JS se reflejan directamente.

## Estructura del Proyecto

```
/
├── index.html                  # Dashboard principal
├── cotizacion.html             # Módulo de cotización
├── inventario.html             # Inventario de filamentos
├── suministros.html            # Inventario de suministros
├── perfiles.html               # Perfiles de filamento
├── centro-fabricacion.html     # Centro de fabricación
│
├── api/
│   ├── config.php              # Conexión DB + clases base (Database, BaseModel, Utils)
│   ├── api_cotizaciones.php    # CRUD cotizaciones
│   ├── api_inventario.php      # CRUD inventario filamentos
│   ├── api_maquinas.php        # CRUD máquinas
│   ├── api_perfiles.php        # CRUD perfiles de filamento
│   ├── api_proyectos.php       # CRUD proyectos/órdenes
│   ├── api_suministros.php     # CRUD suministros
│   └── api_postprocesado_functions.php
│
├── js/
│   ├── config.js               # APIClient global (baseURL: /gestion3d/api)
│   ├── main.js                 # Página principal
│   ├── cotizacion.js           # Lógica de cotización
│   ├── cotizacion_filamento.js # Cálculos de filamento
│   ├── acciones_cotizacion.js  # Acciones (guardar, WhatsApp, etc.)
│   ├── inventario.js           # Gestión de inventario
│   ├── maquinas.js             # Gestión de máquinas
│   ├── perfiles.js             # Gestión de perfiles
│   ├── suministros.js          # Gestión de suministros
│   ├── postprocesado.js        # Módulo de postprocesado
│   ├── delivery.js             # Cálculo de delivery
│   ├── paqueteria.js           # Empaquetado
│   ├── resizer.js              # Redimensionador de paneles
│   └── Kirimoto-integration.js # Integración con Kiri:Moto (carga STL)
│
├── css/                        # Estilos por módulo
│   ├── styleprincipal.css
│   ├── stylecotizacion.css
│   ├── styleinventario.css
│   ├── styleperfiles.css
│   ├── stylemaquinas.css
│   ├── stylesuministros.css
│   ├── postprocesado.css
│   └── kirimoto-styles.css
│
└── Versiones bd/               # Historial de esquemas SQL
    └── sistema_gestion_3d.sql  # Versión actual
```

## Configuración de Base de Datos

Definida en `api/config.php`:

```
Host:     127.0.0.1
Puerto:   3307        ← IMPORTANTE: no es el 3306 estándar
DB:       sistema_gestion_3d
Usuario:  root
Password: (vacío)
Charset:  utf8mb4
Timezone: America/Bogota
```

## Patrones de la API (Backend)

Todas las APIs PHP siguen el mismo patrón:

```php
// Parámetro de acción via query string
$action = $_GET['action'] ?? 'list';

// Respuesta exitosa
echo json_encode(['success' => true, 'data' => $data, 'message' => '']);

// Respuesta de error
http_response_code(400);
echo json_encode(['success' => false, 'error' => $message]);
```

Las clases base en `config.php`:
- `Database` — Singleton PDO, se obtiene con `Database::getInstance()->getConnection()`
- `BaseModel` — CRUD base con `findById()`, `findAll()`, `delete()`
- `Utils` — `sendJsonResponse()`, `validateRequired()`, `sanitizeInput()`, `getRequestBody()`

Los IDs se generan con: `time() . '_' . substr(md5(uniqid(rand(), true)), 0, 9)`

## Cliente API (Frontend)

`js/config.js` define la clase `APIClient` con métodos `get()`, `post()`, `put()`, `delete()`. La instancia global es `apiClient`.

```js
// Ejemplo de uso
const datos = await apiClient.get('api_inventario.php', { action: 'list' });
await apiClient.post('api_cotizaciones.php', { action: 'create' }, bodyData);
```

## Funcionalidades Clave

- **Cotización**: Cálculo de costos por peso de filamento, tiempo de impresión, costo de máquina, postprocesado, empaquetado y delivery. Soporta modo de máquina única o distribución multi-máquina.
- **Kiri:Moto**: Integración con el slicer online Kiri:Moto para cargar archivos STL y obtener automáticamente peso y tiempo de impresión.
- **WhatsApp**: Botón para enviar cotización por WhatsApp directamente.
- **Proyectos**: Al guardar una cotización se crea un proyecto con datos del cliente (nombre, teléfono, WhatsApp, cédula, dirección).

## Convenciones de Código

- Código y comentarios en **español**
- Sin frameworks JS — usar DOM nativo y Fetch API
- Sin clases CSS de frameworks — estilos propios por módulo
- Los PHP devuelven siempre JSON con la estructura `{success, data, message}`
- Logs de error en `api/logs/php_errors.log`
- CORS abierto (`*`) — solo para desarrollo local

## Notas de Desarrollo

- El proyecto corre en XAMPP. Asegurarse que Apache y MySQL estén corriendo en el panel de XAMPP.
- MySQL usa el **puerto 3307**, no el estándar 3306.
- Los archivos se sirven desde `C:\xampp\htdocs\gestion3d\`.
- No hay sistema de autenticación — es un sistema de uso interno/local.
- Los uploads de imágenes van a `uploads/pagos/`.
- Siempre responde en español sin importar que te escriban en ingles

### Frontend Design Standards
- **Typography**: Avoid Inter/Roboto. Use distinctive pairings (e.g., a serif for headings, high-contrast sans-serif for body).
- **Color**: No more "AI purple" or generic blues. Use deep saturation or sophisticated neutrals with one sharp accent color.
- **Layout**: Avoid perfectly centered, symmetrical containers. Use bento-grids, overlapping elements, and generous white space.
- **Motion**: Every interactive element must have a subtle transition (0.2s ease-out).