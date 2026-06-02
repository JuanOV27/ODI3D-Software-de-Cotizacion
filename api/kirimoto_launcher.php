<?php
/**
 * Kiri:Moto Launcher — ODI3D
 * Verifica e inicia el servidor local de Kiri:Moto (Node.js, puerto 8080)
 *
 * GET ?action=status  → devuelve si el servidor está corriendo
 * GET ?action=start   → inicia el servidor en segundo plano (Windows)
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// ============================================
// RUTAS
// ============================================

// Directorio de grid-apps relativo a este archivo (api/)
$GRID_APPS_DIR = realpath(__DIR__ . '/../grid-apps');
$LOG_DIR       = __DIR__ . '/logs';
$LOG_FILE      = $LOG_DIR . '/kirimoto_server.log';

// ============================================
// HELPERS
// ============================================

/**
 * Verifica si el puerto 8080 responde (Kiri:Moto corriendo).
 */
function isKirimotoRunning(): bool {
    $socket = @fsockopen('127.0.0.1', 8080, $errno, $errstr, 1);
    if ($socket) {
        fclose($socket);
        return true;
    }
    return false;
}

/**
 * Inicia Kiri:Moto como proceso desacoplado en Windows.
 * Crea un .bat temporal y lo lanza con start /MIN para que quede
 * en la barra de tareas pero no interfiera con la pantalla.
 */
function startKirimoto(string $gridAppsDir, string $logFile): array {
    if (!$gridAppsDir || !is_dir($gridAppsDir)) {
        return [
            'success' => false,
            'message' => 'No se encontró grid-apps en: ' . ($gridAppsDir ?: 'ruta vacía'),
        ];
    }

    if (!is_dir($gridAppsDir . DIRECTORY_SEPARATOR . 'node_modules')) {
        return [
            'success' => false,
            'message' => 'Dependencias no instaladas. Abre CMD en grid-apps y ejecuta "npm install" primero.',
        ];
    }

    // Asegurar directorio de logs
    if (!is_dir(dirname($logFile))) {
        mkdir(dirname($logFile), 0755, true);
    }

    // ── Batch file temporal ──────────────────────────────────────────
    // Se guarda en %TEMP% para no ensuciar el proyecto
    $batPath = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'start_kiri_odi3d.bat';
    $batContent =
        "@echo off\r\n" .
        "title Kiri:Moto — ODI3D (puerto 8080)\r\n" .
        "cd /d \"" . $gridAppsDir . "\"\r\n" .
        "echo Iniciando Kiri:Moto en http://localhost:8080/kiri/ ...\r\n" .
        "npm run dev 2>&1\r\n";

    if (file_put_contents($batPath, $batContent) === false) {
        return ['success' => false, 'message' => 'No se pudo escribir el script de inicio en ' . $batPath];
    }

    // ── Lanzar minimizado (visible en barra de tareas) ───────────────
    // popen en Windows usa cmd /c, por lo que 'start' funciona como built-in
    pclose(popen('start "Kiri:Moto" /MIN "' . $batPath . '"', 'r'));

    return [
        'success' => true,
        'message' => 'Kiri:Moto iniciando... espera ~15 segundos',
        'url'     => 'http://localhost:8080/kiri/',
    ];
}

// ============================================
// ROUTER
// ============================================

$action = $_GET['action'] ?? 'status';

switch ($action) {

    case 'status':
        $running = isKirimotoRunning();
        echo json_encode([
            'running' => $running,
            'port'    => 8080,
            'url'     => 'http://localhost:8080/kiri/',
            'message' => $running
                ? '✅ Kiri:Moto activo en puerto 8080'
                : '⭕ Kiri:Moto no está corriendo',
        ]);
        break;

    case 'start':
        if (isKirimotoRunning()) {
            echo json_encode([
                'success' => true,
                'running' => true,
                'message' => '✅ Kiri:Moto ya está corriendo',
                'url'     => 'http://localhost:8080/kiri/',
            ]);
            break;
        }
        $result           = startKirimoto($GRID_APPS_DIR, $LOG_FILE);
        $result['running'] = false;
        echo json_encode($result);
        break;

    default:
        http_response_code(400);
        echo json_encode(['error' => 'Acción no reconocida: ' . htmlspecialchars($action)]);
}
