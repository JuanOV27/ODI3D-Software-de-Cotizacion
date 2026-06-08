<?php
/**
 * API de Autenticación — Sistema ODI3D
 * Acciones: login, logout, check_session
 */

require_once __DIR__ . '/config.php';

// Configurar cookie de sesión segura
session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'secure'   => false,   // true en producción con HTTPS
    'httponly' => true,
    'samesite' => 'Strict'
]);

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$action = $_GET['action'] ?? '';

switch ($action) {

    // ----------------------------------------------------------
    case 'login':
        Utils::validateMethod('POST');
        manejarLogin();
        break;

    // ----------------------------------------------------------
    case 'get_csrf':
        // Devuelve un token CSRF para el formulario de login
        if (session_status() === PHP_SESSION_NONE) session_start();
        Utils::sendJsonResponse(true, ['csrf_token' => generarCSRF()]);
        break;

    // ----------------------------------------------------------
    case 'logout':
        manejarLogout();
        break;

    // ----------------------------------------------------------
    case 'check_session':
        checkSession();
        break;

    // ----------------------------------------------------------
    // Verificación cruzada: comprueba si unas credenciales pertenecen
    // a un usuario interno SIN crear sesión (usado por tienda3d cuando
    // el login de cliente falla, para redirigir al empleado al sistema correcto).
    case 'cross_check':
        Utils::validateMethod('POST');
        crossCheckCredenciales();
        break;

    // ----------------------------------------------------------
    default:
        Utils::sendJsonResponse(false, null, 'Acción no válida');
}

// ============================================================
// FUNCIONES
// ============================================================

function manejarLogin(): void {
    $input = Utils::getRequestBody();

    // Validar CSRF
    $csrfToken = $input['csrf_token'] ?? '';
    if (!validarCSRF($csrfToken)) {
        http_response_code(403);
        Utils::sendJsonResponse(false, null, 'Token CSRF inválido');
    }

    $email    = trim($input['email']    ?? '');
    $password = trim($input['password'] ?? '');

    if (empty($email) || empty($password)) {
        Utils::sendJsonResponse(false, null, 'Credenciales incorrectas');
    }

    // Rate limiting: bloquear tras 5 intentos fallidos (15 min)
    $intentosClave = 'intentos_' . md5($email);
    $bloqueoHasta  = 'bloqueo_' . md5($email);

    if (!empty($_SESSION[$bloqueoHasta]) && $_SESSION[$bloqueoHasta] > time()) {
        $minutosRestantes = ceil(($_SESSION[$bloqueoHasta] - time()) / 60);
        Utils::sendJsonResponse(false, null,
            "Demasiados intentos fallidos. Intenta en {$minutosRestantes} minuto(s)."
        );
    }

    // Buscar usuario en BD
    $db = Database::getInstance()->getConnection();
    $stmt = $db->prepare(
        "SELECT id, nombre, email, password_hash, rol, activo
         FROM usuarios_internos
         WHERE email = ?
         LIMIT 1"
    );
    $stmt->execute([$email]);
    $usuario = $stmt->fetch();

    // Mismo mensaje tanto si no existe el email como si la contraseña es incorrecta
    if (!$usuario || !password_verify($password, $usuario['password_hash'])) {
        $_SESSION[$intentosClave] = ($_SESSION[$intentosClave] ?? 0) + 1;

        if ($_SESSION[$intentosClave] >= 5) {
            $_SESSION[$bloqueoHasta] = time() + (15 * 60);
            unset($_SESSION[$intentosClave]);
        }

        Utils::sendJsonResponse(false, null, 'Credenciales incorrectas');
    }

    if (!$usuario['activo']) {
        Utils::sendJsonResponse(false, null, 'Credenciales incorrectas');
    }

    // Login exitoso — regenerar ID de sesión para prevenir session fixation
    session_regenerate_id(true);
    unset($_SESSION[$intentosClave], $_SESSION[$bloqueoHasta]);

    $_SESSION['usuario_id'] = $usuario['id'];
    $_SESSION['rol']        = $usuario['rol'];
    $_SESSION['nombre']     = $usuario['nombre'];
    $_SESSION['email']      = $usuario['email'];

    // Actualizar último acceso
    $stmt = $db->prepare(
        "UPDATE usuarios_internos SET ultimo_acceso = NOW() WHERE id = ?"
    );
    $stmt->execute([$usuario['id']]);

    Utils::sendJsonResponse(true, [
        'usuario_id' => $usuario['id'],
        'nombre'     => $usuario['nombre'],
        'rol'        => $usuario['rol'],
        'email'      => $usuario['email']
    ], 'Sesión iniciada');
}

/**
 * Comprueba si email+password pertenecen a un usuario interno.
 * No crea sesión ni requiere CSRF — solo verifica y responde.
 * Usado por tienda3d-frontend para redirigir empleados que
 * intentaron iniciar sesión en la tienda por equivocación.
 */
function crossCheckCredenciales(): void {
    $input    = Utils::getRequestBody();
    $email    = trim($input['email']    ?? '');
    $password = trim($input['password'] ?? '');

    if (empty($email) || empty($password)) {
        http_response_code(400);
        Utils::sendJsonResponse(false, null, 'Parámetros requeridos');
    }

    $db   = Database::getInstance()->getConnection();
    $stmt = $db->prepare(
        "SELECT nombre, rol, password_hash, activo FROM usuarios_internos WHERE email = ? LIMIT 1"
    );
    $stmt->execute([$email]);
    $usuario = $stmt->fetch();

    if (!$usuario || !password_verify($password, $usuario['password_hash']) || !$usuario['activo']) {
        // Respuesta neutra — no revelar si el email existe o no
        Utils::sendJsonResponse(false, null, 'No pertenece al sistema interno');
    }

    Utils::sendJsonResponse(true, [
        'nombre' => $usuario['nombre'],
        'rol'    => $usuario['rol']
    ]);
}

function manejarLogout(): void {
    $_SESSION = [];

    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(
            session_name(), '', time() - 42000,
            $params['path'], $params['domain'],
            $params['secure'], $params['httponly']
        );
    }

    session_destroy();
    Utils::sendJsonResponse(true, null, 'Sesión cerrada');
}

function checkSession(): void {
    if (empty($_SESSION['usuario_id'])) {
        http_response_code(401);
        Utils::sendJsonResponse(false, null, 'No autenticado');
    }

    Utils::sendJsonResponse(true, [
        'autenticado' => true,
        'usuario_id'  => $_SESSION['usuario_id'],
        'nombre'      => $_SESSION['nombre'],
        'rol'         => $_SESSION['rol'],
        'email'       => $_SESSION['email'] ?? ''
    ]);
}
