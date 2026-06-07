<?php
/**
 * API de Gestión de Usuarios Internos — Sistema ODI3D
 * Acciones: list, get, create, update, delete, toggle_activo
 * Acceso: exclusivo para administradores
 *
 * Regla de seguridad clave: para crear un nuevo perfil de administrador
 * (o promover a un empleado existente a administrador), el administrador
 * que tiene la sesión activa debe confirmar SU PROPIA contraseña
 * (campo `password_actual`). Esto regula quién puede generar nuevas
 * cuentas con privilegios totales.
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth_middleware.php';

// Toda la gestión de usuarios internos es exclusiva del rol admin
$usuarioActual = requireAuth(['admin']);

$action = $_GET['action'] ?? 'list';

switch ($action) {

    case 'list':
        Utils::validateMethod('GET');
        listarUsuarios();
        break;

    case 'get':
        Utils::validateMethod('GET');
        $id = trim($_GET['id'] ?? '');
        if (empty($id)) Utils::sendJsonResponse(false, null, 'ID requerido');
        obtenerUsuario($id);
        break;

    case 'create':
        Utils::validateMethod('POST');
        crearUsuario($usuarioActual);
        break;

    case 'update':
        Utils::validateMethod('PUT');
        actualizarUsuario($usuarioActual);
        break;

    case 'toggle_activo':
        Utils::validateMethod('POST');
        toggleActivo($usuarioActual);
        break;

    case 'delete':
        Utils::validateMethod('DELETE');
        $id = trim($_GET['id'] ?? '');
        if (empty($id)) Utils::sendJsonResponse(false, null, 'ID requerido');
        eliminarUsuario($id, $usuarioActual);
        break;

    default:
        Utils::sendJsonResponse(false, null, 'Acción no válida');
}

// ============================================================
// FUNCIONES
// ============================================================

function listarUsuarios(): void {
    $db = Database::getInstance()->getConnection();
    $stmt = $db->query(
        "SELECT id, nombre, email, rol, activo, ultimo_acceso, fecha_creacion
         FROM usuarios_internos
         ORDER BY fecha_creacion DESC"
    );
    Utils::sendJsonResponse(true, $stmt->fetchAll());
}

function obtenerUsuario(string $id): void {
    $db = Database::getInstance()->getConnection();
    $stmt = $db->prepare(
        "SELECT id, nombre, email, rol, activo, ultimo_acceso, fecha_creacion
         FROM usuarios_internos WHERE id = ? LIMIT 1"
    );
    $stmt->execute([$id]);
    $usuario = $stmt->fetch();

    if (!$usuario) {
        Utils::sendJsonResponse(false, null, 'Usuario no encontrado');
    }

    Utils::sendJsonResponse(true, $usuario);
}

/**
 * Verifica que la contraseña recibida corresponda al hash almacenado
 * del administrador con sesión activa (no del usuario que se está creando/editando).
 */
function passwordAdminActualValida(string $passwordRecibida, string $idAdminActual): bool {
    if ($passwordRecibida === '') return false;

    $db = Database::getInstance()->getConnection();
    $stmt = $db->prepare("SELECT password_hash FROM usuarios_internos WHERE id = ? LIMIT 1");
    $stmt->execute([$idAdminActual]);
    $row = $stmt->fetch();

    return $row && password_verify($passwordRecibida, $row['password_hash']);
}

function crearUsuario(array $usuarioActual): void {
    $input = Utils::getRequestBody();

    $val = Utils::validateRequired($input, ['nombre', 'email', 'password', 'rol']);
    if (!$val['valid']) {
        Utils::sendJsonResponse(false, null, 'Faltan campos requeridos: ' . implode(', ', $val['missing']));
    }

    $nombre   = trim($input['nombre']);
    $email    = strtolower(trim($input['email']));
    $password = (string)$input['password'];
    $rol      = trim($input['rol']);

    if (!in_array($rol, ['admin', 'empleado'], true)) {
        Utils::sendJsonResponse(false, null, 'Rol no válido');
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        Utils::sendJsonResponse(false, null, 'Correo electrónico no válido');
    }
    if (mb_strlen($password) < 8) {
        Utils::sendJsonResponse(false, null, 'La contraseña debe tener al menos 8 caracteres');
    }
    if (mb_strlen($nombre) < 2) {
        Utils::sendJsonResponse(false, null, 'El nombre es demasiado corto');
    }

    // ── Capa de seguridad: crear un perfil de ADMINISTRADOR exige
    //    confirmar la contraseña del admin que tiene la sesión activa ──
    if ($rol === 'admin') {
        $passwordActual = (string)($input['password_actual'] ?? '');
        if (!passwordAdminActualValida($passwordActual, $usuarioActual['usuario_id'])) {
            http_response_code(403);
            Utils::sendJsonResponse(false, null, 'Contraseña de administrador incorrecta. No se creó el perfil.');
        }
    }

    $db = Database::getInstance()->getConnection();

    $stmt = $db->prepare("SELECT id FROM usuarios_internos WHERE email = ? LIMIT 1");
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        Utils::sendJsonResponse(false, null, 'Ya existe un usuario registrado con ese correo electrónico');
    }

    $id   = time() . '_' . substr(md5(uniqid(rand(), true)), 0, 9);
    $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

    $stmt = $db->prepare(
        "INSERT INTO usuarios_internos (id, nombre, email, password_hash, rol, activo, fecha_creacion)
         VALUES (?, ?, ?, ?, ?, 1, NOW())"
    );
    $stmt->execute([$id, $nombre, $email, $hash, $rol]);

    Utils::sendJsonResponse(true, ['id' => $id], 'Usuario creado correctamente');
}

function actualizarUsuario(array $usuarioActual): void {
    $input = Utils::getRequestBody();
    $id = trim($input['id'] ?? '');
    if (empty($id)) Utils::sendJsonResponse(false, null, 'ID requerido');

    $val = Utils::validateRequired($input, ['nombre', 'email', 'rol']);
    if (!$val['valid']) {
        Utils::sendJsonResponse(false, null, 'Faltan campos requeridos: ' . implode(', ', $val['missing']));
    }

    $nombre   = trim($input['nombre']);
    $email    = strtolower(trim($input['email']));
    $rol      = trim($input['rol']);
    $password = isset($input['password']) ? (string)$input['password'] : '';

    if (!in_array($rol, ['admin', 'empleado'], true)) {
        Utils::sendJsonResponse(false, null, 'Rol no válido');
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        Utils::sendJsonResponse(false, null, 'Correo electrónico no válido');
    }
    if ($password !== '' && mb_strlen($password) < 8) {
        Utils::sendJsonResponse(false, null, 'La nueva contraseña debe tener al menos 8 caracteres');
    }
    if (mb_strlen($nombre) < 2) {
        Utils::sendJsonResponse(false, null, 'El nombre es demasiado corto');
    }

    $db = Database::getInstance()->getConnection();

    $stmt = $db->prepare("SELECT id, rol FROM usuarios_internos WHERE id = ? LIMIT 1");
    $stmt->execute([$id]);
    $existente = $stmt->fetch();
    if (!$existente) Utils::sendJsonResponse(false, null, 'Usuario no encontrado');

    // Correo único (ignorando el propio registro)
    $stmt = $db->prepare("SELECT id FROM usuarios_internos WHERE email = ? AND id <> ? LIMIT 1");
    $stmt->execute([$email, $id]);
    if ($stmt->fetch()) {
        Utils::sendJsonResponse(false, null, 'Ya existe otro usuario registrado con ese correo electrónico');
    }

    // ── Capa de seguridad: PROMOVER a alguien a administrador exige
    //    confirmar la contraseña del admin que tiene la sesión activa ──
    if ($rol === 'admin' && $existente['rol'] !== 'admin') {
        $passwordActual = (string)($input['password_actual'] ?? '');
        if (!passwordAdminActualValida($passwordActual, $usuarioActual['usuario_id'])) {
            http_response_code(403);
            Utils::sendJsonResponse(false, null, 'Contraseña de administrador incorrecta. No se asignó el rol de administrador.');
        }
    }

    // Un admin no puede quitarse a sí mismo el rol de administrador (se quedaría sin acceso al módulo)
    if ($id === $usuarioActual['usuario_id'] && $existente['rol'] === 'admin' && $rol !== 'admin') {
        Utils::sendJsonResponse(false, null, 'No puedes quitarte a ti mismo el rol de administrador');
    }

    if ($password !== '') {
        $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
        $stmt = $db->prepare(
            "UPDATE usuarios_internos SET nombre = ?, email = ?, rol = ?, password_hash = ? WHERE id = ?"
        );
        $stmt->execute([$nombre, $email, $rol, $hash, $id]);
    } else {
        $stmt = $db->prepare(
            "UPDATE usuarios_internos SET nombre = ?, email = ?, rol = ? WHERE id = ?"
        );
        $stmt->execute([$nombre, $email, $rol, $id]);
    }

    Utils::sendJsonResponse(true, ['id' => $id], 'Usuario actualizado correctamente');
}

function toggleActivo(array $usuarioActual): void {
    $input = Utils::getRequestBody();
    $id = trim($input['id'] ?? '');
    if (empty($id)) Utils::sendJsonResponse(false, null, 'ID requerido');

    if ($id === $usuarioActual['usuario_id']) {
        Utils::sendJsonResponse(false, null, 'No puedes activar/desactivar tu propia cuenta');
    }

    $db = Database::getInstance()->getConnection();
    $stmt = $db->prepare("SELECT activo, rol FROM usuarios_internos WHERE id = ? LIMIT 1");
    $stmt->execute([$id]);
    $usuario = $stmt->fetch();
    if (!$usuario) Utils::sendJsonResponse(false, null, 'Usuario no encontrado');

    $nuevoEstado = $usuario['activo'] ? 0 : 1;

    // No permitir desactivar al último administrador activo del sistema
    if ($usuario['rol'] === 'admin' && $nuevoEstado === 0) {
        $stmt = $db->prepare("SELECT COUNT(*) AS total FROM usuarios_internos WHERE rol = 'admin' AND activo = 1");
        $stmt->execute();
        if ((int)$stmt->fetch()['total'] <= 1) {
            Utils::sendJsonResponse(false, null, 'No puedes desactivar al único administrador activo del sistema');
        }
    }

    $stmt = $db->prepare("UPDATE usuarios_internos SET activo = ? WHERE id = ?");
    $stmt->execute([$nuevoEstado, $id]);

    Utils::sendJsonResponse(
        true,
        ['id' => $id, 'activo' => $nuevoEstado],
        $nuevoEstado ? 'Usuario activado' : 'Usuario desactivado'
    );
}

function eliminarUsuario(string $id, array $usuarioActual): void {
    if ($id === $usuarioActual['usuario_id']) {
        Utils::sendJsonResponse(false, null, 'No puedes eliminar tu propia cuenta');
    }

    $db = Database::getInstance()->getConnection();
    $stmt = $db->prepare("SELECT rol FROM usuarios_internos WHERE id = ? LIMIT 1");
    $stmt->execute([$id]);
    $usuario = $stmt->fetch();
    if (!$usuario) Utils::sendJsonResponse(false, null, 'Usuario no encontrado');

    // No permitir eliminar al único administrador del sistema
    if ($usuario['rol'] === 'admin') {
        $stmt = $db->prepare("SELECT COUNT(*) AS total FROM usuarios_internos WHERE rol = 'admin'");
        $stmt->execute();
        if ((int)$stmt->fetch()['total'] <= 1) {
            Utils::sendJsonResponse(false, null, 'No puedes eliminar al único administrador del sistema');
        }
    }

    try {
        $stmt = $db->prepare("DELETE FROM usuarios_internos WHERE id = ?");
        $stmt->execute([$id]);
    } catch (PDOException $e) {
        // El usuario probablemente está referenciado por una clave foránea
        // (p. ej. solicitudes/proyectos asignados) — sugerir desactivar en su lugar
        error_log('Error al eliminar usuario interno (posible FK): ' . $e->getMessage());
        Utils::sendJsonResponse(
            false, null,
            'No se puede eliminar: este usuario tiene registros asociados (solicitudes, proyectos, etc.). Desactívalo en su lugar.'
        );
    }

    Utils::sendJsonResponse(true, null, 'Usuario eliminado correctamente');
}
