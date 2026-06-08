<?php
/**
 * API de Solicitudes de Cotización — Sistema ODI3D
 * Acciones: list, get, cambiar_estado, asignar, vincular_cotizacion, no_leidas,
 *           registrar_pago, listar_pagos, comprobante_pago
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

    case 'registrar_pago':
        // Proxy multipart al API de tienda3d — admite archivo comprobante
        Utils::validateMethod('POST');
        registrarPago($usuario);
        break;

    case 'listar_pagos':
        Utils::validateMethod('GET');
        $id = trim($_GET['id'] ?? '');
        if (empty($id)) Utils::sendJsonResponse(false, null, 'ID requerido');
        listarPagos($id);
        break;

    case 'comprobante_pago':
        // Proxy de descarga del comprobante almacenado en tienda3d/storage/private
        descargarComprobantePago();
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
    if (isset($input['fecha_estimada_entrega'])) {
        $campos[] = 'fecha_estimada_entrega = ?';
        $params[]  = $input['fecha_estimada_entrega'] ?: null;
    }
    if (isset($input['modalidad_pago'])) {
        $modalidad = trim($input['modalidad_pago']);
        $campos[] = 'modalidad_pago = ?';
        $params[]  = in_array($modalidad, ['unico', 'partes'], true) ? $modalidad : null;
    }
    if (isset($input['porcentaje_abono'])) {
        $campos[] = 'porcentaje_abono = ?';
        $params[]  = ($input['porcentaje_abono'] !== null && $input['porcentaje_abono'] !== '')
            ? (float) $input['porcentaje_abono']
            : null;
    }

    // ── Validación de pagos antes de transiciones críticas ────────────────
    if (in_array($estado, ['aceptada', 'entregada'], true)) {
        // Obtener precio_final actual (puede actualizarse en este mismo request)
        $stmtSol = $db->prepare("SELECT precio_final FROM solicitudes_cotizacion WHERE id = ? LIMIT 1");
        $stmtSol->execute([$id]);
        $solicitudActual = $stmtSol->fetch();
        $precioFinal = isset($input['precio_final'])
            ? (float) $input['precio_final']
            : (float) ($solicitudActual['precio_final'] ?? 0);

        $stmtPagos = $db->prepare(
            "SELECT tipo, SUM(monto) as total_tipo
             FROM solicitudes_pagos
             WHERE solicitud_id = ?
             GROUP BY tipo"
        );
        $stmtPagos->execute([$id]);
        $pagosResumen = [];
        while ($row = $stmtPagos->fetch()) {
            $pagosResumen[$row['tipo']] = (float) $row['total_tipo'];
        }

        $totalPagado = array_sum($pagosResumen);

        if ($estado === 'aceptada') {
            if (empty($pagosResumen['abono'])) {
                Utils::sendJsonResponse(
                    false, null,
                    'Registra el abono antes de marcar la solicitud como aceptada.'
                );
            }
        }

        if ($estado === 'entregada') {
            if (empty($pagosResumen['entrega'])) {
                Utils::sendJsonResponse(
                    false, null,
                    'Registra el pago de entrega antes de marcar como entregada.'
                );
            }
            if ($precioFinal > 0 && abs($totalPagado - $precioFinal) > 1) {
                $fmt = fn($v) => '$' . number_format($v, 0, ',', '.');
                Utils::sendJsonResponse(
                    false, null,
                    'La suma de pagos (' . $fmt($totalPagado) . ') no coincide con el precio final (' . $fmt($precioFinal) . '). Ajusta los montos antes de marcar como entregada.'
                );
            }
        }
    }
    // ─────────────────────────────────────────────────────────────────────

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

    $rutaFisica = __DIR__ . '/../../tienda3d/storage/app/private/' . $archivo['nombre_servidor'];
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

// ============================================================
// REGISTRO DE PAGOS — proxy a tienda3d + lectura directa PDO
// ============================================================

/**
 * Proxy multipart → POST /api/interno/solicitudes/{id}/pagos en tienda3d.
 * Reenvía el comprobante (si lo hay) junto con los campos del pago.
 * Incluye automáticamente los datos del empleado que registra.
 */
function registrarPago(array $usuario): void {
    $solicitudId = trim($_POST['solicitud_id'] ?? '');
    if (empty($solicitudId)) {
        Utils::sendJsonResponse(false, null, 'solicitud_id requerido');
    }

    $tipo     = trim($_POST['tipo']       ?? '');
    $monto    = trim($_POST['monto']      ?? '');
    $fechaPago = trim($_POST['fecha_pago'] ?? '');

    if (!in_array($tipo, ['abono', 'entrega'], true)) {
        Utils::sendJsonResponse(false, null, 'tipo inválido (debe ser abono o entrega)');
    }
    if (!is_numeric($monto) || (float)$monto <= 0) {
        Utils::sendJsonResponse(false, null, 'monto inválido');
    }
    if (empty($fechaPago)) {
        Utils::sendJsonResponse(false, null, 'fecha_pago requerida');
    }

    // URL interna de tienda3d
    $url = 'http://localhost/ODI3D/tienda3d/public/api/interno/solicitudes/' . urlencode($solicitudId) . '/pagos';

    // Construir multipart con curl_file_create si hay comprobante
    $postData = [
        'tipo'                   => $tipo,
        'monto'                  => $monto,
        'fecha_pago'             => $fechaPago,
        'nota'                   => $_POST['nota'] ?? '',
        'registrado_por'         => $usuario['id']     ?? '',
        'registrado_por_nombre'  => $usuario['nombre'] ?? '',
    ];

    if (!empty($_FILES['comprobante']['tmp_name']) && is_uploaded_file($_FILES['comprobante']['tmp_name'])) {
        $postData['comprobante'] = new CURLFile(
            $_FILES['comprobante']['tmp_name'],
            $_FILES['comprobante']['type']  ?: 'application/octet-stream',
            $_FILES['comprobante']['name']  ?: 'comprobante'
        );
    }

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $postData,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 20,
        CURLOPT_CONNECTTIMEOUT => 5,
    ]);

    $respBody = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr  = curl_error($ch);
    curl_close($ch);

    if ($curlErr) {
        Utils::sendJsonResponse(false, null, 'Error de conexión con el servidor de pagos: ' . $curlErr);
    }

    $resp = json_decode($respBody, true);
    if (!$resp) {
        Utils::sendJsonResponse(false, null, 'Respuesta inválida del servidor de pagos');
    }

    http_response_code($httpCode >= 400 ? $httpCode : 200);
    echo $respBody;
    exit;
}

/**
 * Lee los pagos de una solicitud directamente por PDO (misma BD compartida).
 * Devuelve la lista + un resumen (total_abonado, total_entrega, gran_total).
 */
function listarPagos(string $solicitudId): void {
    $db   = Database::getInstance()->getConnection();
    $stmt = $db->prepare(
        "SELECT id, solicitud_id, tipo, monto, fecha_pago,
                comprobante_path, nota,
                registrado_por, registrado_por_nombre, created_at
         FROM solicitudes_pagos
         WHERE solicitud_id = ?
         ORDER BY created_at ASC"
    );
    $stmt->execute([$solicitudId]);
    $pagos = $stmt->fetchAll();

    // Resumen acumulado
    $totalAbono   = 0.0;
    $totalEntrega = 0.0;
    foreach ($pagos as $p) {
        if ($p['tipo'] === 'abono')   $totalAbono   += (float) $p['monto'];
        if ($p['tipo'] === 'entrega') $totalEntrega += (float) $p['monto'];
    }

    Utils::sendJsonResponse(true, [
        'pagos'           => $pagos,
        'total_abono'     => $totalAbono,
        'total_entrega'   => $totalEntrega,
        'gran_total'      => $totalAbono + $totalEntrega,
    ]);
}

/**
 * Sirve el comprobante almacenado en tienda3d/storage/app/private.
 * Ruta relativa guardada en comprobante_path.
 */
function descargarComprobantePago(): void {
    $pagoId      = trim($_GET['pago_id']      ?? '');
    $solicitudId = trim($_GET['solicitud_id'] ?? '');
    if (empty($pagoId) || empty($solicitudId)) {
        http_response_code(400);
        exit('Parámetros requeridos');
    }

    $db   = Database::getInstance()->getConnection();
    $stmt = $db->prepare(
        "SELECT comprobante_path FROM solicitudes_pagos
         WHERE id = ? AND solicitud_id = ? LIMIT 1"
    );
    $stmt->execute([$pagoId, $solicitudId]);
    $pago = $stmt->fetch();

    if (!$pago || empty($pago['comprobante_path'])) {
        http_response_code(404);
        exit('Comprobante no encontrado');
    }

    $rutaFisica = __DIR__ . '/../../tienda3d/storage/app/private/' . $pago['comprobante_path'];
    if (!file_exists($rutaFisica)) {
        http_response_code(404);
        exit('Archivo no encontrado en servidor');
    }

    $ext  = strtolower(pathinfo($rutaFisica, PATHINFO_EXTENSION));
    $mime = in_array($ext, ['jpg','jpeg']) ? 'image/jpeg'
          : (in_array($ext, ['png']) ? 'image/png'
          : (in_array($ext, ['gif']) ? 'image/gif'
          : (in_array($ext, ['webp']) ? 'image/webp'
          : 'application/octet-stream')));

    header('Content-Type: ' . $mime);
    header('Content-Length: ' . filesize($rutaFisica));
    header('X-Content-Type-Options: nosniff');
    readfile($rutaFisica);
    exit;
}
