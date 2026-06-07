<?php
/**
 * API de Productos — Catálogo ODI3D
 * Acciones: list, get, create, update, delete, toggle_visible
 * Requiere: admin o empleado
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth_middleware.php';
$usuario = requireAuth(['admin', 'empleado']);

$action = $_GET['action'] ?? 'list';

switch ($action) {

    case 'list':
        Utils::validateMethod('GET');
        listarProductos();
        break;

    case 'get':
        Utils::validateMethod('GET');
        $id = trim($_GET['id'] ?? '');
        if (empty($id)) Utils::sendJsonResponse(false, null, 'ID requerido');
        obtenerProducto($id);
        break;

    case 'create':
        Utils::validateMethod('POST');
        crearProducto($usuario);
        break;

    case 'update':
        Utils::validateMethod('PUT');
        actualizarProducto($usuario);
        break;

    case 'delete':
        Utils::validateMethod('DELETE');
        $id = trim($_GET['id'] ?? '');
        if (empty($id)) Utils::sendJsonResponse(false, null, 'ID requerido');
        eliminarProducto($id);
        break;

    case 'toggle_visible':
        Utils::validateMethod('POST');
        toggleVisible();
        break;

    case 'upload_imagen':
        // Subida de imagen multipart — método POST con $_FILES
        subirImagen();
        break;

    case 'delete_imagen':
        Utils::validateMethod('DELETE');
        eliminarImagen();
        break;

    default:
        Utils::sendJsonResponse(false, null, 'Acción no válida');
}

// ============================================================
// FUNCIONES
// ============================================================

function listarProductos(): void {
    $db   = Database::getInstance()->getConnection();
    $stmt = $db->query(
        "SELECT p.*,
            (SELECT ruta FROM productos_imagenes pi
             WHERE pi.producto_id = p.id ORDER BY pi.orden ASC LIMIT 1) AS imagen_principal
         FROM productos p
         ORDER BY p.fecha_creacion DESC"
    );
    Utils::sendJsonResponse(true, $stmt->fetchAll());
}

function obtenerProducto(string $id): void {
    $db   = Database::getInstance()->getConnection();
    $stmt = $db->prepare("SELECT * FROM productos WHERE id = ? LIMIT 1");
    $stmt->execute([$id]);
    $producto = $stmt->fetch();

    if (!$producto) {
        Utils::sendJsonResponse(false, null, 'Producto no encontrado');
    }

    // Imágenes del producto
    $stmt = $db->prepare(
        "SELECT id, ruta, orden FROM productos_imagenes
         WHERE producto_id = ? ORDER BY orden ASC"
    );
    $stmt->execute([$id]);
    $producto['imagenes'] = $stmt->fetchAll();

    Utils::sendJsonResponse(true, $producto);
}

function crearProducto(array $usuario): void {
    $input = Utils::getRequestBody();
    $val   = Utils::validateRequired($input, ['nombre', 'precio']);
    if (!$val['valid']) {
        Utils::sendJsonResponse(false, null, 'Faltan campos: ' . implode(', ', $val['missing']));
    }

    $db = Database::getInstance()->getConnection();
    $id = time() . '_' . substr(md5(uniqid(rand(), true)), 0, 9);

    $stmt = $db->prepare(
        "INSERT INTO productos (id, nombre, descripcion, precio, categoria, enlace_whatsapp, visible, creado_por)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    $ok = $stmt->execute([
        $id,
        Utils::sanitizeInput($input['nombre']),
        Utils::sanitizeInput($input['descripcion'] ?? ''),
        (float) $input['precio'],
        Utils::sanitizeInput($input['categoria'] ?? ''),
        Utils::sanitizeInput($input['enlace_whatsapp'] ?? '') ?: null,
        isset($input['visible']) ? (int)(bool)$input['visible'] : 1,
        $usuario['usuario_id']
    ]);

    if (!$ok) {
        Utils::sendJsonResponse(false, null, 'Error al crear producto');
    }

    $stmt = $db->prepare("SELECT * FROM productos WHERE id = ?");
    $stmt->execute([$id]);
    Utils::sendJsonResponse(true, $stmt->fetch(), 'Producto creado');
}

function actualizarProducto(array $usuario): void {
    $input = Utils::getRequestBody();
    $id    = trim($input['id'] ?? '');
    if (empty($id)) Utils::sendJsonResponse(false, null, 'ID requerido');

    $db   = Database::getInstance()->getConnection();
    $stmt = $db->prepare("SELECT id FROM productos WHERE id = ? LIMIT 1");
    $stmt->execute([$id]);
    if (!$stmt->fetch()) {
        Utils::sendJsonResponse(false, null, 'Producto no encontrado');
    }

    $campos = [];
    $params = [];

    if (isset($input['nombre'])) {
        $campos[] = 'nombre = ?';
        $params[] = Utils::sanitizeInput($input['nombre']);
    }
    if (isset($input['descripcion'])) {
        $campos[] = 'descripcion = ?';
        $params[] = Utils::sanitizeInput($input['descripcion']);
    }
    if (isset($input['precio'])) {
        $campos[] = 'precio = ?';
        $params[] = (float) $input['precio'];
    }
    if (isset($input['categoria'])) {
        $campos[] = 'categoria = ?';
        $params[] = Utils::sanitizeInput($input['categoria']);
    }
    if (isset($input['enlace_whatsapp'])) {
        $campos[] = 'enlace_whatsapp = ?';
        $params[] = Utils::sanitizeInput($input['enlace_whatsapp']) ?: null;
    }
    if (isset($input['visible'])) {
        $campos[] = 'visible = ?';
        $params[] = (int)(bool)$input['visible'];
    }

    if (empty($campos)) {
        Utils::sendJsonResponse(false, null, 'Sin campos para actualizar');
    }

    $params[] = $id;
    $stmt = $db->prepare("UPDATE productos SET " . implode(', ', $campos) . " WHERE id = ?");
    $stmt->execute($params);

    $stmt = $db->prepare("SELECT * FROM productos WHERE id = ?");
    $stmt->execute([$id]);
    Utils::sendJsonResponse(true, $stmt->fetch(), 'Producto actualizado');
}

function eliminarProducto(string $id): void {
    $db   = Database::getInstance()->getConnection();

    // Las imágenes se eliminan por ON DELETE CASCADE en la BD
    // Pero también hay que borrar los archivos físicos
    $stmt = $db->prepare(
        "SELECT ruta FROM productos_imagenes WHERE producto_id = ?"
    );
    $stmt->execute([$id]);
    $imagenes = $stmt->fetchAll();

    foreach ($imagenes as $img) {
        $ruta = __DIR__ . '/../' . $img['ruta'];
        if (file_exists($ruta)) {
            @unlink($ruta);
        }
    }

    $stmt = $db->prepare("DELETE FROM productos WHERE id = ?");
    $ok   = $stmt->execute([$id]);
    Utils::sendJsonResponse($ok, null, $ok ? 'Producto eliminado' : 'Error al eliminar');
}

function toggleVisible(): void {
    $input = Utils::getRequestBody();
    $id    = trim($input['id'] ?? '');
    if (empty($id)) Utils::sendJsonResponse(false, null, 'ID requerido');

    $db   = Database::getInstance()->getConnection();
    $stmt = $db->prepare("SELECT visible FROM productos WHERE id = ? LIMIT 1");
    $stmt->execute([$id]);
    $producto = $stmt->fetch();

    if (!$producto) Utils::sendJsonResponse(false, null, 'Producto no encontrado');

    $nuevo = $producto['visible'] ? 0 : 1;
    $stmt  = $db->prepare("UPDATE productos SET visible = ? WHERE id = ?");
    $stmt->execute([$nuevo, $id]);

    Utils::sendJsonResponse(true, ['visible' => (bool) $nuevo],
        $nuevo ? 'Producto visible en tienda' : 'Producto oculto de la tienda'
    );
}

function subirImagen(): void {
    $productoId = trim($_POST['producto_id'] ?? '');
    if (empty($productoId)) {
        Utils::sendJsonResponse(false, null, 'producto_id requerido');
    }

    if (empty($_FILES['imagen'])) {
        Utils::sendJsonResponse(false, null, 'No se recibió archivo');
    }

    $archivo = $_FILES['imagen'];

    // 1. Verificar tamaño (máx 5 MB)
    if ($archivo['size'] > 5 * 1024 * 1024) {
        Utils::sendJsonResponse(false, null, 'Archivo demasiado grande (máximo 5 MB)');
    }

    // 2. Verificar extensión contra lista blanca
    $ext = strtolower(pathinfo($archivo['name'], PATHINFO_EXTENSION));
    $extensionesPermitidas = ['jpg', 'jpeg', 'png', 'webp'];
    if (!in_array($ext, $extensionesPermitidas, true)) {
        Utils::sendJsonResponse(false, null, 'Extensión no permitida. Use: ' . implode(', ', $extensionesPermitidas));
    }

    // 3. Verificar magic bytes (no confiar en el Content-Type del cliente)
    $info = @getimagesize($archivo['tmp_name']);
    if ($info === false) {
        Utils::sendJsonResponse(false, null, 'El archivo no es una imagen válida');
    }

    // 4. Verificar que el tipo MIME real sea de imagen
    $mimesPermitidos = ['image/jpeg', 'image/png', 'image/webp'];
    if (!in_array($info['mime'], $mimesPermitidos, true)) {
        Utils::sendJsonResponse(false, null, 'Tipo de imagen no permitido');
    }

    // 5. Renombrar con UUID para evitar path traversal
    $nombreServidor = bin2hex(random_bytes(16)) . '.' . $ext;
    $dirDestino     = __DIR__ . '/../uploads/productos/';
    $rutaDestino    = $dirDestino . $nombreServidor;

    if (!is_dir($dirDestino)) {
        mkdir($dirDestino, 0755, true);
    }

    if (!move_uploaded_file($archivo['tmp_name'], $rutaDestino)) {
        Utils::sendJsonResponse(false, null, 'Error al guardar imagen');
    }

    // 6. Guardar referencia en BD
    $db    = Database::getInstance()->getConnection();
    $imgId = time() . '_' . substr(md5(uniqid(rand(), true)), 0, 9);
    $orden = (int) ($_POST['orden'] ?? 0);
    $ruta  = 'uploads/productos/' . $nombreServidor;

    $stmt = $db->prepare(
        "INSERT INTO productos_imagenes (id, producto_id, ruta, orden) VALUES (?, ?, ?, ?)"
    );
    $ok = $stmt->execute([$imgId, $productoId, $ruta, $orden]);

    if (!$ok) {
        @unlink($rutaDestino);
        Utils::sendJsonResponse(false, null, 'Error al registrar imagen en BD');
    }

    Utils::sendJsonResponse(true, [
        'id'    => $imgId,
        'ruta'  => $ruta,
        'orden' => $orden
    ], 'Imagen subida correctamente');
}

function eliminarImagen(): void {
    $input = Utils::getRequestBody();
    $id    = trim($input['id'] ?? '');
    if (empty($id)) Utils::sendJsonResponse(false, null, 'ID de imagen requerido');

    $db   = Database::getInstance()->getConnection();
    $stmt = $db->prepare("SELECT ruta FROM productos_imagenes WHERE id = ? LIMIT 1");
    $stmt->execute([$id]);
    $imagen = $stmt->fetch();

    if (!$imagen) Utils::sendJsonResponse(false, null, 'Imagen no encontrada');

    // Borrar archivo físico
    $rutaFisica = __DIR__ . '/../' . $imagen['ruta'];
    if (file_exists($rutaFisica)) {
        @unlink($rutaFisica);
    }

    $stmt = $db->prepare("DELETE FROM productos_imagenes WHERE id = ?");
    $stmt->execute([$id]);

    Utils::sendJsonResponse(true, null, 'Imagen eliminada');
}
