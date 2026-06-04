<?php
/**
 * Middleware de Autenticación — Sistema ODI3D
 * Incluir al inicio de cada API que requiera sesión activa.
 */

/**
 * Verifica que el usuario esté autenticado y tenga el rol requerido.
 * Termina la ejecución con JSON si falla la verificación.
 *
 * @param array $rolesPermitidos Roles que pueden acceder; vacío = cualquier rol autenticado
 * @return array Datos del usuario: ['usuario_id', 'rol', 'nombre']
 */
function requireAuth(array $rolesPermitidos = ['admin', 'empleado']): array {
    // Configurar cookie segura antes de iniciar sesión
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

    // Sin sesión activa
    if (empty($_SESSION['usuario_id'])) {
        http_response_code(401);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'success'  => false,
            'error'    => 'No autenticado',
            'redirect' => '/gestion3d/login.html'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Sin permiso de rol
    if (!empty($rolesPermitidos) && !in_array($_SESSION['rol'], $rolesPermitidos, true)) {
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'success' => false,
            'error'   => 'Sin permisos para esta acción'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    return [
        'usuario_id' => $_SESSION['usuario_id'],
        'rol'        => $_SESSION['rol'],
        'nombre'     => $_SESSION['nombre']
    ];
}
