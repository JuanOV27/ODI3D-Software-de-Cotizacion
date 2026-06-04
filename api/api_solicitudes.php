<?php
/**
 * API de Solicitudes de Cotización — Sistema ODI3D
 * Acciones: list, get, cambiar_estado, asignar, vincular_cotizacion, no_leidas
 * Requiere: admin o empleado
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth_middleware.php';
$usuario = requireAuth(['admin', 'empleado']);

$action = $_GET['action'] ?? 'list';

switch ($action) {

    case 'list':
        Utils::validateMethod('GET');
        listarSolicitudes();
        break;

    case 'get':
        Utils::validateMethod('GET');
        $id = trim($_GET['id'] ?? '');
        if (empty($id)) Utils::sendJsonResponse(false, null, 'ID requerido');
        obtenerSolicitud($id);
        break;

    case 'cambiar_estado':
        Utils::validateMethod('POST');
        cambiarEstado($usuario);
        break;

    case 'asignar':
        Utils::validateMethod('POST');
        asignarSolicitud($usuario);
        break;

    case 'vincular_cotizacion':
        Utils::validateMethod('POST');
        vincularCotizacion();
        break;

    case 'no_leidas':
        Utils::validateMethod('GET');
        contarNoLeidas();
        break;

    case 'descargar_archivo':
        // Descarga de archivo adjunto — verificación por GET
        descargarArchivo();
        break;

    default:
        Utils::sendJsonResponse(false, null, 'Acción no válida');
}

// ============================================================
// FUNCIONES
// ============================================================

function listarSolicitudes(): void {
    $estado = trim($_GET['estado'] ?? '');
    $db     = Database::getInstance()->getConnection();

    $sql = "SELECT s.*,
                c.nombre AS cliente_nombre,
                c.email  AS cliente_email,
                c.telefono AS cliente_telefono,
                u.nombre AS asignado_nombre,
                (SELECT COUNT(*) FROM chat_mensajes cm
                 WHERE cm.solicitud_id = s.id
                   AND cm.remitente = 'cliente'
                   AND cm.leido = 0) AS mensajes_no_leidos
            FROM solicitudes_cotizacion s
            LEFT JOIN clientes c ON s.cliente_id = c.id
            LEFT JOIN usuarios_internos u ON s.asignado_a = u.id";

    $params = [];
    if ($estado) {
        $sql .= " WHERE s.estado = ?";
        $params[] = $estado;
    }

    $sql .= " ORDER BY s.fecha_solicitud DESC";

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    Utils::sendJsonResponse(true, $stmt->fetchAll());
}

function obtenerSolicitud(string $id): void {
    $db   = Database::getInstance()->getConnection();
    $stmt = $db->prepare(
        "SELECT s.*,
             c.nombre AS cliente_nombre,
             c.email  AS cliente_email,
             c.telefono AS cliente_telefono,
             u.nombre AS asignado_nombre
         FROM solicitudes_cotizacion s
         LEFT JOIN clientes c ON s.cliente_id = c.id
         LEFT JOIN usuarios_internos u ON s.asignado_a = u.id
         WHERE s.id = ?
         LIMIT 1"
    );
    $stmt->execute([$id]);
    $solicitud = $stmt->fetch();

    if (!$solicitud) {
        Utils::sendJsonResponse(false, null, 'Solicitud no encontrada');
    }

    // Archivos adjuntos
    $stmt = $db->prepare(
        "SELECT id, nombre_original, tipo_mime, tamano_bytes
         FROM solicitudes_archivos WHERE solicitud_id = ?"
    );
    $stmt->execute([$id]);
    $solicitud['archivos'] = $stmt->fetchAll();

    // Cotización vinculada (solo nombre y fecha, sin costos internos)
    if ($solicitud['cotizacion_id']) {
        $stmt = $db->prepare(
            "SELECT id, nombre_pieza, fecha FROM cotizaciones WHERE id = ? LIMIT 1"
        );
        $stmt->execute([$solicitud['cotizacion_id']]);
        $solicitud['cotizacion'] = $stmt->fetch() ?: null;
    }

    Utils::sendJsonResponse(true, $solicitud);
}

function cambiarEstado(array $usuario): void {
    $input  = Utils::getRequestBody();
    $id     = trim($input['id'] ?? '');
    $estado = trim($input['estado'] ?? '');

    $estadosValidos = ['recibida','en_proceso','cotizada','aceptada','rechazada','en_produccion','entregada'];
    if (empty($id) || !in_array($estado, $estadosValidos, true)) {
        Utils::sendJsonResponse(false, null, 'ID o estado inválido');
    }

    $db = Database::getInstance()->getConnection();

    $campos = ['estado = ?'];
    $params = [$estado];

    // Al cotizar o finalizar, registrar fecha de respuesta
    if (in_array($estado, ['cotizada','aceptada','rechazada','entregada'], true)) {
        $campos[] = 'fecha_respuesta = NOW()';
    }

    if (isset($input['precio_final'])) {
        $campos[] = 'precio_final = ?';
        $params[]  = (float) $input['precio_final'];
    }
    if (isset($input['notas_internas'])) {
        $campos[] = 'notas_internas = ?';
        $params[]  = Utils::sanitizeInput($input['notas_internas']);
    }

    $params[] = $id;
    $stmt = $db->prepare(
        "UPDATE solicitudes_cotizacion SET " . implode(', ', $campos) . " WHERE id = ?"
    );
    $stmt->execute($params);

    Utils::sendJsonResponse(true, ['id' => $id, 'estado' => $estado], 'Estado actualizado');
}

function asignarSolicitud(array $usuario): void {
    $input       = Utils::getRequestBody();
    $id          = trim($input['id'] ?? '');
    $asignadoA   = trim($input['asignado_a'] ?? '');

    if (empty($id)) Utils::sendJsonResponse(false, null, 'ID requerido');

    $db = Database::getInstance()->getConnection();
    $stmt = $db->prepare(
        "UPDATE solicitudes_cotizacion SET asignado_a = ? WHERE id = ?"
    );
    $stmt->execute([$asignadoA ?: null, $id]);

    Utils::sendJsonResponse(true, null, 'Solicitud asignada');
}

function vincularCotizacion(): void {
    $input         = Utils::getRequestBody();
    $id            = trim($input['id'] ?? '');
    $cotizacionId  = trim($input['cotizacion_id'] ?? '');

    if (empty($id)) Utils::sendJsonResponse(false, null, 'ID de solicitud requerido');

    // Verificar que la cotización exista si se envía
    if ($cotizacionId) {
        $db   = Database::getInstance()->getConnection();
        $stmt = $db->prepare("SELECT id FROM cotizaciones WHERE id = ? LIMIT 1");
        $stmt->execute([$cotizacionId]);
        if (!$stmt->fetch()) {
            Utils::sendJsonResponse(false, null, 'Cotización no encontrada');
        }
    }

    $db = Database::getInstance()->getConnection();
    $stmt = $db->prepare(
        "UPDATE solicitudes_cotizacion
         SET cotizacion_id = ?, estado = IF(? IS NOT NULL AND ? != '', 'cotizada', estado)
         WHERE id = ?"
    );
    $stmt->execute([$cotizacionId ?: null, $cotizacionId, $cotizacionId, $id]);

    Utils::sendJsonResponse(true, null, 'Cotización vinculada');
}

function contarNoLeidas(): void {
    $db   = Database::getInstance()->getConnection();

    // Solicitudes nuevas sin leer (estado = recibida)
    $stmt = $db->query(
        "SELECT COUNT(*) AS nuevas FROM solicitudes_cotizacion WHERE estado = 'recibida'"
    );
    $nuevas = (int) $stmt->fetchColumn();

    // Mensajes de clientes sin leer en el chat
    $stmt = $db->query(
        "SELECT COUNT(*) AS mensajes FROM chat_mensajes
         WHERE remitente = 'cliente' AND leido = 0"
    );
    $mensajes = (int) $stmt->fetchColumn();

    Utils::sendJsonResponse(true, [
        'solicitudes_nuevas'    => $nuevas,
        'mensajes_no_leidos'    => $mensajes,
        'total'                 => $nuevas + $mensajes
    ]);
}

function descargarArchivo(): void {
    $archivoId = trim($_GET['archivo_id'] ?? '');
    if (empty($archivoId)) {
        http_response_code(400);
        exit('Parámetro archivo_id requerido');
    }

    $db   = Database::getInstance()->getConnection();
    $stmt = $db->prepare(
        "SELECT sa.nombre_original, sa.nombre_servidor, sa.tipo_mime
         FROM solicitudes_archivos sa
         JOIN solicitudes_cotizacion sc ON sa.solicitud_id = sc.id
         WHERE sa.id = ?
         LIMIT 1"
    );
    $stmt->execute([$archivoId]);
    $archivo = $stmt->fetch();

    if (!$archivo) {
        http_response_code(404);
        exit('Archivo no encontrado');
    }

    $rutaFisica = __DIR__ . '/../uploads/solicitudes/' . $archivo['nombre_servidor'];
    if (!file_exists($rutaFisica)) {
        http_response_code(404);
        exit('Archivo no encontrado en servidor');
    }

    header('Content-Type: ' . ($archivo['tipo_mime'] ?: 'application/octet-stream'));
    header('Content-Disposition: attachment; filename="' . rawurlencode($archivo['nombre_original']) . '"');
    header('Content-Length: ' . filesize($rutaFisica));
    header('X-Content-Type-Options: nosniff');
    readfile($rutaFisica);
    exit;
}
