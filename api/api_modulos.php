<?php
/**
 * API de Módulos / Feature Flags — Sistema ODI3D
 * Acciones: list, toggle, estado
 *
 * - list / toggle: solo admin
 * - estado?nombre=X: público (sin auth), con caché en sesión 60 s
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth_middleware.php';

$action = $_GET['action'] ?? 'estado';

switch ($action) {

    // ----------------------------------------------------------
    case 'estado':
        // Público — devuelve si el módulo está activo o no
        $nombre = trim($_GET['nombre'] ?? '');
        if (empty($nombre)) {
            Utils::sendJsonResponse(false, null, 'Parámetro nombre requerido');
        }
        estadoModulo($nombre);
        break;

    // ----------------------------------------------------------
    case 'list':
        requireAuth(['admin']);
        listarModulos();
        break;

    // ----------------------------------------------------------
    case 'toggle':
        $usuario = requireAuth(['admin']);
        Utils::validateMethod('POST');
        toggleModulo($usuario);
        break;

    // ----------------------------------------------------------
    default:
        Utils::sendJsonResponse(false, null, 'Acción no válida');
}

// ============================================================
// FUNCIONES
// ============================================================

function estadoModulo(string $nombre): void {
    // Caché en sesión por 60 segundos para no golpear la BD en cada request
    $cacheKey  = 'modulo_estado_' . $nombre;
    $cacheTick = 'modulo_tick_'   . $nombre;

    $ahora = time();
    if (
        isset($_SESSION[$cacheKey], $_SESSION[$cacheTick]) &&
        ($ahora - $_SESSION[$cacheTick]) < 60
    ) {
        Utils::sendJsonResponse(true, $_SESSION[$cacheKey]);
    }

    $db   = Database::getInstance()->getConnection();
    $stmt = $db->prepare(
        "SELECT activo, mensaje_baja FROM modulos WHERE nombre = ? LIMIT 1"
    );
    $stmt->execute([$nombre]);
    $modulo = $stmt->fetch();

    if (!$modulo) {
        // Si no existe el módulo, lo consideramos activo para no romper módulos legados
        $resultado = ['activo' => true, 'mensaje_baja' => ''];
    } else {
        $resultado = [
            'activo'       => (bool) $modulo['activo'],
            'mensaje_baja' => $modulo['activo'] ? '' : $modulo['mensaje_baja']
        ];
    }

    // Guardar en caché de sesión
    if (session_status() !== PHP_SESSION_NONE) {
        $_SESSION[$cacheKey]  = $resultado;
        $_SESSION[$cacheTick] = $ahora;
    }

    Utils::sendJsonResponse(true, $resultado);
}

function listarModulos(): void {
    $db   = Database::getInstance()->getConnection();
    $stmt = $db->query(
        "SELECT nombre, activo, descripcion, mensaje_baja, fecha_baja, desactivado_por
         FROM modulos
         ORDER BY nombre"
    );
    $modulos = $stmt->fetchAll();
    Utils::sendJsonResponse(true, $modulos);
}

function toggleModulo(array $usuario): void {
    $input  = Utils::getRequestBody();
    $nombre = trim($input['nombre'] ?? '');

    if (empty($nombre)) {
        Utils::sendJsonResponse(false, null, 'Parámetro nombre requerido');
    }

    $db   = Database::getInstance()->getConnection();
    $stmt = $db->prepare("SELECT activo FROM modulos WHERE nombre = ? LIMIT 1");
    $stmt->execute([$nombre]);
    $modulo = $stmt->fetch();

    if (!$modulo) {
        Utils::sendJsonResponse(false, null, 'Módulo no encontrado');
    }

    $nuevoEstado = $modulo['activo'] ? 0 : 1;
    $fechaBaja   = $nuevoEstado ? null : date('Y-m-d H:i:s');
    $desactivadoPor = $nuevoEstado ? null : $usuario['usuario_id'];
    $mensajeBaja = !$nuevoEstado
        ? ($input['mensaje_baja'] ?? 'Módulo en mantenimiento. Intenta más tarde.')
        : 'Módulo en mantenimiento. Intenta más tarde.';

    $stmt = $db->prepare(
        "UPDATE modulos
         SET activo          = ?,
             fecha_baja      = ?,
             desactivado_por = ?,
             mensaje_baja    = ?
         WHERE nombre = ?"
    );
    $stmt->execute([$nuevoEstado, $fechaBaja, $desactivadoPor, $mensajeBaja, $nombre]);

    // Limpiar caché de sesión para este módulo
    unset($_SESSION['modulo_estado_' . $nombre], $_SESSION['modulo_tick_' . $nombre]);

    Utils::sendJsonResponse(true, [
        'nombre' => $nombre,
        'activo' => (bool) $nuevoEstado
    ], $nuevoEstado ? 'Módulo activado' : 'Módulo desactivado');
}
