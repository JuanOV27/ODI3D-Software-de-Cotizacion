<?php
/**
 * API de Solicitudes de Cotización — Sistema ODI3D
 * Acciones: list, get, cambiar_estado, asignar, vincular_cotizacion, no_leidas,
 *           registrar_pago, listar_pagos, comprobante_pago,
 *           crear_manual, agregar_items, listar_items, confirmar_vinculacion,
 *           carpeta_cliente, solicitudes_por_cliente
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

    // ── Solicitudes manuales ───────────────────────────────────────────────
    case 'crear_manual':
        Utils::validateMethod('POST');
        crearSolicitudManual($usuario);
        break;

    case 'agregar_items':
        Utils::validateMethod('POST');
        agregarItems();
        break;

    case 'listar_items':
        Utils::validateMethod('GET');
        $id = trim($_GET['id'] ?? '');
        if (empty($id)) Utils::sendJsonResponse(false, null, 'ID requerido');
        listarItems($id);
        break;

    case 'confirmar_vinculacion':
        Utils::validateMethod('POST');
        confirmarVinculacion();
        break;

    // ── Carpeta de cliente ─────────────────────────────────────────────────
    case 'carpeta_cliente':
        Utils::validateMethod('GET');
        $clienteId  = trim($_GET['cliente_id']  ?? '');
        $clienteTel = trim($_GET['telefono']     ?? '');
        if (empty($clienteId) && empty($clienteTel)) Utils::sendJsonResponse(false, null, 'cliente_id o telefono requerido');
        carpetaCliente($clienteId, $clienteTel);
        break;

    // ── Eliminar ítem ──────────────────────────────────────────────────────
    case 'eliminar_item':
        Utils::validateMethod('POST');
        eliminarItem();
        break;

    // ── Catálogo de productos (misma BD) ───────────────────────────────────
    case 'productos_catalogo':
        Utils::validateMethod('GET');
        productosCatalogo();
        break;

    case 'categorias_catalogo':
        Utils::validateMethod('GET');
        categoriasCatalogo();
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

    // Para solicitudes manuales (sin cliente_id), usar los campos cliente_* de la propia solicitud
    $sql = "SELECT s.id, s.estado, s.precio_final, s.fecha_solicitud,
                s.cotizacion_id, s.asignado_a,
                s.origen, s.tipo_solicitud, s.vinculacion_pendiente,
                COALESCE(c.nombre, s.cliente_nombre)  AS cliente_nombre,
                COALESCE(c.email,  s.cliente_email)   AS cliente_email,
                COALESCE(c.telefono, s.cliente_telefono) AS cliente_telefono,
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
             COALESCE(c.nombre,   s.cliente_nombre)   AS cliente_nombre,
             COALESCE(c.email,    s.cliente_email)    AS cliente_email,
             COALESCE(c.telefono, s.cliente_telefono) AS cliente_telefono,
             c.id AS cuenta_cliente_id,
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

    // Ítems de la solicitud (catálogo o personalizados / multi-ítem cotizador)
    $stmt = $db->prepare(
        "SELECT id, tipo_item, producto_id, producto_nombre,
                producto_precio_unitario, cantidad, material, descripcion_extra,
                datos_cotizacion, created_at,
                ROUND(COALESCE(producto_precio_unitario,0) * cantidad, 2) AS subtotal
         FROM solicitud_items
         WHERE solicitud_id = ?
         ORDER BY created_at ASC"
    );
    $stmt->execute([$id]);
    $items = $stmt->fetchAll();
    // Decodificar JSON de datos_cotizacion si está presente
    foreach ($items as &$item) {
        if (!empty($item['datos_cotizacion'])) {
            $item['datos_cotizacion'] = json_decode($item['datos_cotizacion'], true);
        }
    }
    unset($item);
    $solicitud['items'] = $items;
    $solicitud['items_total'] = array_sum(array_column($items, 'subtotal'));

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

    // ── Control de retroceso: verificar contraseña si el nuevo estado es anterior ──
    // Orden de fases (rechazada no está en la progresión lineal, siempre se permite)
    $ordenFases = ['recibida'=>1,'en_proceso'=>2,'cotizada'=>3,'aceptada'=>4,'en_produccion'=>5,'entregada'=>6];
    if (isset($ordenFases[$estado])) {
        $stmtActual = $db->prepare("SELECT estado FROM solicitudes_cotizacion WHERE id = ? LIMIT 1");
        $stmtActual->execute([$id]);
        $estadoActual = $stmtActual->fetchColumn();

        if ($estadoActual && isset($ordenFases[$estadoActual])
            && $ordenFases[$estado] < $ordenFases[$estadoActual]
        ) {
            // Retroceso detectado — verificar contraseña del empleado
            $passwordConfirmacion = trim($input['password_confirmacion'] ?? '');
            if (empty($passwordConfirmacion)) {
                http_response_code(403);
                Utils::sendJsonResponse(false, ['requiere_password' => true],
                    'Se requiere tu contraseña para retroceder el estado del pedido.'
                );
            }

            $stmtUser = $db->prepare(
                "SELECT password_hash FROM usuarios_internos WHERE id = ? LIMIT 1"
            );
            $stmtUser->execute([$usuario['id']]);
            $hashGuardado = $stmtUser->fetchColumn();

            if (!$hashGuardado || !password_verify($passwordConfirmacion, $hashGuardado)) {
                http_response_code(403);
                Utils::sendJsonResponse(false, ['requiere_password' => true],
                    'Contraseña incorrecta. No se puede retroceder el estado.'
                );
            }
        }
    }
    // ─────────────────────────────────────────────────────────────────────

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

// ============================================================
// SOLICITUDES MANUALES — proxy + lectura directa
// ============================================================

/**
 * Crea una solicitud manual via proxy POST a tienda3d.
 */
function crearSolicitudManual(array $usuario): void {
    $input = Utils::getRequestBody();

    $required = ['tipo_solicitud', 'cliente_nombre', 'cliente_telefono'];
    foreach ($required as $campo) {
        if (empty(trim($input[$campo] ?? ''))) {
            Utils::sendJsonResponse(false, null, "Campo requerido: {$campo}");
        }
    }

    $url = 'http://localhost/ODI3D/tienda3d/public/api/interno/solicitudes';

    $payload = [
        'tipo_solicitud'    => trim($input['tipo_solicitud']),
        'cliente_nombre'    => Utils::sanitizeInput($input['cliente_nombre']),
        'cliente_telefono'  => Utils::sanitizeInput($input['cliente_telefono']),
        'cliente_whatsapp'  => Utils::sanitizeInput($input['cliente_whatsapp'] ?? $input['cliente_telefono']),
        'cliente_email'     => Utils::sanitizeInput($input['cliente_email']    ?? ''),
        'descripcion'       => Utils::sanitizeInput($input['descripcion']      ?? ''),
        'material_preferido'=> Utils::sanitizeInput($input['material_preferido'] ?? ''),
        'cantidad'          => (int) ($input['cantidad'] ?? 1),
        'uso_final'         => Utils::sanitizeInput($input['uso_final'] ?? ''),
    ];

    // Para solicitudes de compra con ítems
    if (!empty($input['items']) && is_array($input['items'])) {
        $payload['items'] = array_map(function ($it) {
            return [
                'producto_nombre'          => Utils::sanitizeInput($it['producto_nombre'] ?? ''),
                'cantidad'                 => (int) ($it['cantidad'] ?? 1),
                'producto_precio_unitario' => isset($it['producto_precio_unitario']) && $it['producto_precio_unitario'] !== null
                                             ? (float) $it['producto_precio_unitario'] : null,
                'tipo_item'                => 'personalizado',
                'descripcion_extra'        => Utils::sanitizeInput($it['descripcion_extra'] ?? ''),
            ];
        }, $input['items']);
    }

    $postData = json_encode($payload);

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $postData,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_CONNECTTIMEOUT => 5,
    ]);
    $respBody = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr  = curl_error($ch);
    curl_close($ch);

    if ($curlErr) Utils::sendJsonResponse(false, null, 'Error al crear solicitud: ' . $curlErr);
    $resp = json_decode($respBody, true);
    if (!$resp) Utils::sendJsonResponse(false, null, 'Respuesta inválida del servidor');

    http_response_code($httpCode >= 400 ? $httpCode : 200);
    echo $respBody;
    exit;
}

/**
 * Proxy para agregar ítems (catálogo o personalizados) a una solicitud.
 */
function agregarItems(): void {
    $input       = Utils::getRequestBody();
    $solicitudId = trim($input['solicitud_id'] ?? '');
    if (empty($solicitudId)) Utils::sendJsonResponse(false, null, 'solicitud_id requerido');

    $url = 'http://localhost/ODI3D/tienda3d/public/api/interno/solicitudes/' . urlencode($solicitudId) . '/items';

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode(['items' => $input['items'] ?? []]),
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_CONNECTTIMEOUT => 5,
    ]);
    $respBody = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr  = curl_error($ch);
    curl_close($ch);

    if ($curlErr) Utils::sendJsonResponse(false, null, 'Error al agregar ítems: ' . $curlErr);
    http_response_code($httpCode >= 400 ? $httpCode : 200);
    echo $respBody;
    exit;
}

/**
 * Lee los ítems de una solicitud directamente por PDO.
 */
function listarItems(string $solicitudId): void {
    $db   = Database::getInstance()->getConnection();
    $stmt = $db->prepare(
        "SELECT id, tipo_item, producto_id, producto_nombre,
                producto_precio_unitario, cantidad, material, descripcion_extra,
                datos_cotizacion, created_at,
                ROUND(COALESCE(producto_precio_unitario,0) * cantidad, 2) AS subtotal
         FROM solicitud_items
         WHERE solicitud_id = ?
         ORDER BY created_at ASC"
    );
    $stmt->execute([$solicitudId]);
    $items = $stmt->fetchAll();

    foreach ($items as &$item) {
        if (!empty($item['datos_cotizacion'])) {
            $item['datos_cotizacion'] = json_decode($item['datos_cotizacion'], true);
        }
    }
    unset($item);

    $total = array_sum(array_column($items, 'subtotal'));
    Utils::sendJsonResponse(true, ['items' => $items, 'total' => $total]);
}

/**
 * Confirma o rechaza la vinculación de un cliente a una solicitud manual.
 */
function confirmarVinculacion(): void {
    $input       = Utils::getRequestBody();
    $solicitudId = trim($input['solicitud_id'] ?? '');
    $confirmar   = !empty($input['confirmar']) && $input['confirmar'] !== false && $input['confirmar'] !== 'false';
    $clienteId   = trim($input['cliente_id'] ?? '');

    if (empty($solicitudId)) Utils::sendJsonResponse(false, null, 'solicitud_id requerido');

    $url = 'http://localhost/ODI3D/tienda3d/public/api/interno/solicitudes/' . urlencode($solicitudId) . '/vincular-cliente';

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode(['confirmar' => $confirmar, 'cliente_id' => $clienteId ?: null]),
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_CONNECTTIMEOUT => 5,
    ]);
    $respBody = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr  = curl_error($ch);
    curl_close($ch);

    if ($curlErr) Utils::sendJsonResponse(false, null, 'Error: ' . $curlErr);
    http_response_code($httpCode >= 400 ? $httpCode : 200);
    echo $respBody;
    exit;
}

// ============================================================
// CARPETA DE CLIENTE — historial agrupado
// ============================================================

/**
 * Devuelve todas las solicitudes de un cliente (por cliente_id o teléfono).
 * Incluye info básica + resumen de pagos.
 */
function carpetaCliente(string $clienteId, string $telefono): void {
    $db = Database::getInstance()->getConnection();

    // Buscar por cliente_id o por teléfono (para solicitudes manuales)
    if ($clienteId) {
        $whereClause = "s.cliente_id = ?";
        $params      = [$clienteId];
    } else {
        $whereClause = "s.cliente_telefono = ? OR c.telefono = ?";
        $params      = [$telefono, $telefono];
    }

    $stmt = $db->prepare(
        "SELECT s.id, s.estado, s.precio_final, s.fecha_solicitud,
                s.tipo_solicitud, s.origen, s.descripcion,
                COALESCE(c.nombre, s.cliente_nombre) AS cliente_nombre,
                COALESCE(c.email,  s.cliente_email)  AS cliente_email,
                COALESCE(c.telefono, s.cliente_telefono) AS cliente_telefono,
                (SELECT SUM(sp.monto) FROM solicitudes_pagos sp WHERE sp.solicitud_id = s.id) AS total_pagado
         FROM solicitudes_cotizacion s
         LEFT JOIN clientes c ON s.cliente_id = c.id
         WHERE {$whereClause}
         ORDER BY s.fecha_solicitud DESC"
    );
    $stmt->execute($params);
    $solicitudes = $stmt->fetchAll();

    // Info del cliente (si existe en el sistema)
    $cliente = null;
    if ($clienteId) {
        $stmtC = $db->prepare("SELECT id, nombre, email, telefono FROM clientes WHERE id = ? LIMIT 1");
        $stmtC->execute([$clienteId]);
        $cliente = $stmtC->fetch() ?: null;
    } elseif ($telefono) {
        $stmtC = $db->prepare("SELECT id, nombre, email, telefono FROM clientes WHERE telefono = ? LIMIT 1");
        $stmtC->execute([$telefono]);
        $cliente = $stmtC->fetch() ?: null;
    }

    Utils::sendJsonResponse(true, [
        'cliente'      => $cliente,
        'solicitudes'  => $solicitudes,
        'total_count'  => count($solicitudes),
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

// ============================================================
// ELIMINAR ÍTEM DE SOLICITUD
// ============================================================

function eliminarItem(): void {
    $input  = Utils::getRequestBody();
    $itemId = trim($input['item_id'] ?? '');
    if (empty($itemId)) {
        Utils::sendJsonResponse(false, null, 'item_id requerido');
        return;
    }
    $db   = Database::getInstance()->getConnection();
    $stmt = $db->prepare("DELETE FROM solicitud_items WHERE id = ?");
    $stmt->execute([$itemId]);
    Utils::sendJsonResponse(true, null, 'Ítem eliminado correctamente');
}

// ============================================================
// CATÁLOGO DE PRODUCTOS (misma BD que tienda3d)
// ============================================================

function productosCatalogo(): void {
    $q         = trim($_GET['q']         ?? '');
    $categoria = trim($_GET['categoria'] ?? '');
    $db        = Database::getInstance()->getConnection();

    // La tabla productos pertenece a tienda3d pero está en la misma BD.
    // 'visible' = columna de visibilidad, 'precio' = precio real (alias precio_base al frontend).
    $sql    = "SELECT p.id, p.nombre, p.descripcion, p.precio AS precio_base,
                      p.categoria,
                      (SELECT pi.ruta FROM producto_imagenes pi
                       WHERE pi.producto_id = p.id
                       ORDER BY pi.orden ASC LIMIT 1) AS imagen_principal
               FROM productos p
               WHERE p.visible = 1";
    $params = [];

    if ($q !== '') {
        $sql      .= " AND p.nombre LIKE ?";
        $params[]  = '%' . $q . '%';
    }
    if ($categoria !== '') {
        $sql      .= " AND p.categoria = ?";
        $params[]  = $categoria;
    }
    $sql .= " ORDER BY p.nombre ASC LIMIT 100";

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $productos = $stmt->fetchAll(PDO::FETCH_ASSOC);
    Utils::sendJsonResponse(true, $productos, '');
}

function categoriasCatalogo(): void {
    $db   = Database::getInstance()->getConnection();
    $stmt = $db->query(
        "SELECT DISTINCT categoria FROM productos
         WHERE visible = 1 AND categoria IS NOT NULL AND categoria != ''
         ORDER BY categoria ASC"
    );
    $cats = $stmt->fetchAll(PDO::FETCH_COLUMN);
    Utils::sendJsonResponse(true, $cats, '');
}
