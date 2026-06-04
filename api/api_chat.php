<?php
/**
 * API de Chat Interno — Sistema ODI3D
 * Acciones: mensajes, enviar, no_leidos
 * Requiere: admin o empleado
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth_middleware.php';
$usuario = requireAuth(['admin', 'empleado']);

$action = $_GET['action'] ?? '';

switch ($action) {

    case 'mensajes':
        Utils::validateMethod('GET');
        $solicitudId = trim($_GET['solicitud_id'] ?? '');
        if (empty($solicitudId)) Utils::sendJsonResponse(false, null, 'solicitud_id requerido');
        obtenerMensajes($solicitudId, $usuario);
        break;

    case 'enviar':
        Utils::validateMethod('POST');
        enviarMensaje($usuario);
        break;

    case 'no_leidos':
        Utils::validateMethod('GET');
        contarNoLeidos();
        break;

    default:
        Utils::sendJsonResponse(false, null, 'Acción no válida');
}

// ============================================================
// FUNCIONES
// ============================================================

function obtenerMensajes(string $solicitudId, array $usuario): void {
    $db = Database::getInstance()->getConnection();

    // Verificar que la solicitud exista
    $stmt = $db->prepare("SELECT id FROM solicitudes_cotizacion WHERE id = ? LIMIT 1");
    $stmt->execute([$solicitudId]);
    if (!$stmt->fetch()) {
        Utils::sendJsonResponse(false, null, 'Solicitud no encontrada');
    }

    // Marcar como leídos los mensajes del cliente (el empleado los está leyendo)
    $stmt = $db->prepare(
        "UPDATE chat_mensajes SET leido = 1
         WHERE solicitud_id = ? AND remitente = 'cliente' AND leido = 0"
    );
    $stmt->execute([$solicitudId]);

    // Obtener todos los mensajes de la solicitud
    $stmt = $db->prepare(
        "SELECT id, solicitud_id, remitente, mensaje, leido,
                DATE_FORMAT(fecha, '%Y-%m-%d %H:%i:%s') AS fecha
         FROM chat_mensajes
         WHERE solicitud_id = ?
         ORDER BY fecha ASC"
    );
    $stmt->execute([$solicitudId]);
    Utils::sendJsonResponse(true, $stmt->fetchAll());
}

function enviarMensaje(array $usuario): void {
    $input       = Utils::getRequestBody();
    $solicitudId = trim($input['solicitud_id'] ?? '');
    $mensaje     = trim($input['mensaje'] ?? '');

    if (empty($solicitudId) || empty($mensaje)) {
        Utils::sendJsonResponse(false, null, 'solicitud_id y mensaje son requeridos');
    }

    if (mb_strlen($mensaje) > 2000) {
        Utils::sendJsonResponse(false, null, 'Mensaje demasiado largo (máximo 2000 caracteres)');
    }

    $db = Database::getInstance()->getConnection();

    // Verificar que la solicitud exista
    $stmt = $db->prepare("SELECT id FROM solicitudes_cotizacion WHERE id = ? LIMIT 1");
    $stmt->execute([$solicitudId]);
    if (!$stmt->fetch()) {
        Utils::sendJsonResponse(false, null, 'Solicitud no encontrada');
    }

    $id = time() . '_' . substr(md5(uniqid(rand(), true)), 0, 9);

    $stmt = $db->prepare(
        "INSERT INTO chat_mensajes (id, solicitud_id, remitente, remitente_id, mensaje, leido)
         VALUES (?, ?, 'empleado', ?, ?, 0)"
    );
    $ok = $stmt->execute([$id, $solicitudId, $usuario['usuario_id'], $mensaje]);

    if (!$ok) {
        Utils::sendJsonResponse(false, null, 'Error al enviar mensaje');
    }

    Utils::sendJsonResponse(true, [
        'id'           => $id,
        'solicitud_id' => $solicitudId,
        'remitente'    => 'empleado',
        'mensaje'      => $mensaje,
        'fecha'        => date('Y-m-d H:i:s')
    ], 'Mensaje enviado');
}

function contarNoLeidos(): void {
    $db   = Database::getInstance()->getConnection();
    $stmt = $db->query(
        "SELECT COUNT(*) AS total
         FROM chat_mensajes
         WHERE remitente = 'cliente' AND leido = 0"
    );
    $total = (int) $stmt->fetchColumn();
    Utils::sendJsonResponse(true, ['no_leidos' => $total]);
}
