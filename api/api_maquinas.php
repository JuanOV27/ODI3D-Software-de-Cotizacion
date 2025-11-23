<?php
// ============================================
// API_MAQUINAS.PHP
// Sistema de Gestión 3D - Centro de Fabricación
// ============================================

require_once 'config.php';

header('Content-Type: application/json; charset=utf-8');

// Obtener acción
$action = $_GET['action'] ?? '';

// Obtener método HTTP
$method = $_SERVER['REQUEST_METHOD'];

try {
    $db = Database::getInstance();
    
    switch($action) {
        case 'list':
            listarMaquinas($db);
            break;
            
        case 'create':
            crearMaquina($db);
            break;
            
        case 'update':
            actualizarMaquina($db);
            break;
            
        case 'delete':
            eliminarMaquina($db);
            break;
            
        case 'estadisticas':
            obtenerEstadisticas($db);
            break;
            
        default:
            throw new Exception("Acción no válida");
    }
    
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}

// ============================================
// FUNCIÓN AUXILIAR PARA OBTENER DATOS
// ============================================

function getRequestData() {
    $method = $_SERVER['REQUEST_METHOD'];
    
    if ($method === 'POST' || $method === 'PUT' || $method === 'DELETE') {
        $input = file_get_contents('php://input');
        $data = json_decode($input, true);
        return $data ?? [];
    }
    
    return [];
}

// ============================================
// LISTAR TODAS LAS MÁQUINAS
// ============================================

function listarMaquinas($db) {
    $query = "
        SELECT 
            id,
            nombre,
            modelo,
            tipo,
            costo_adquisicion,
            vida_util_horas,
            depreciacion_por_hora,
            volumen_construccion_x,
            volumen_construccion_y,
            volumen_construccion_z,
            velocidad_max,
            num_extrusores,
            activa,
            horas_uso_total,
            fecha_adquisicion,
            notas,
            created_at,
            updated_at
        FROM maquinas
        ORDER BY activa DESC, nombre ASC
    ";
    
    $stmt = $db->getConnection()->prepare($query);
    $stmt->execute();
    $maquinas = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Convertir valores booleanos
    foreach ($maquinas as &$maquina) {
        $maquina['activa'] = (bool) $maquina['activa'];
        $maquina['num_extrusores'] = (int) $maquina['num_extrusores'];
    }
    
    echo json_encode([
        'success' => true,
        'data' => $maquinas
    ], JSON_UNESCAPED_UNICODE);
}

// ============================================
// CREAR NUEVA MÁQUINA
// ============================================

function crearMaquina($db) {
    $data = getRequestData();
    
    // Validar datos requeridos
    if (empty($data['nombre'])) {
        throw new Exception("El nombre de la máquina es requerido");
    }
    
    if (empty($data['costo_adquisicion']) || $data['costo_adquisicion'] <= 0) {
        throw new Exception("El costo de adquisición debe ser mayor a cero");
    }
    
    if (empty($data['vida_util_horas']) || $data['vida_util_horas'] <= 0) {
        throw new Exception("La vida útil debe ser mayor a cero");
    }
    
    // Generar ID único
    $id = 'MAQ_' . time() . '_' . substr(md5(rand()), 0, 8);
    
    // Calcular depreciación si no se proporcionó
    if (empty($data['depreciacion_por_hora'])) {
        $data['depreciacion_por_hora'] = $data['costo_adquisicion'] / $data['vida_util_horas'];
    }
    
    $query = "
        INSERT INTO maquinas (
            id, nombre, modelo, tipo,
            costo_adquisicion, vida_util_horas, depreciacion_por_hora,
            volumen_construccion_x, volumen_construccion_y, volumen_construccion_z,
            velocidad_max, num_extrusores,
            activa, horas_uso_total,
            fecha_adquisicion, notas
        ) VALUES (
            :id, :nombre, :modelo, :tipo,
            :costo_adquisicion, :vida_util_horas, :depreciacion_por_hora,
            :volumen_x, :volumen_y, :volumen_z,
            :velocidad_max, :num_extrusores,
            :activa, :horas_uso_total,
            :fecha_adquisicion, :notas
        )
    ";
    
    $stmt = $db->getConnection()->prepare($query);
    $stmt->execute([
        ':id' => $id,
        ':nombre' => $data['nombre'],
        ':modelo' => $data['modelo'] ?? null,
        ':tipo' => $data['tipo'] ?? 'FDM',
        ':costo_adquisicion' => $data['costo_adquisicion'],
        ':vida_util_horas' => $data['vida_util_horas'],
        ':depreciacion_por_hora' => $data['depreciacion_por_hora'],
        ':volumen_x' => $data['volumen_construccion_x'] ?? null,
        ':volumen_y' => $data['volumen_construccion_y'] ?? null,
        ':volumen_z' => $data['volumen_construccion_z'] ?? null,
        ':velocidad_max' => $data['velocidad_max'] ?? null,
        ':num_extrusores' => $data['num_extrusores'] ?? 1,
        ':activa' => $data['activa'] ?? true,
        ':horas_uso_total' => $data['horas_uso_total'] ?? 0,
        ':fecha_adquisicion' => $data['fecha_adquisicion'] ?? null,
        ':notas' => $data['notas'] ?? null
    ]);
    
    // Obtener la máquina recién creada
    $stmt = $db->getConnection()->prepare("SELECT * FROM maquinas WHERE id = :id");
    $stmt->execute([':id' => $id]);
    $maquina = $stmt->fetch(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'message' => 'Máquina creada exitosamente',
        'data' => $maquina
    ], JSON_UNESCAPED_UNICODE);
}

// ============================================
// ACTUALIZAR MÁQUINA
// ============================================

function actualizarMaquina($db) {
    $data = getRequestData();
    
    if (empty($data['id'])) {
        throw new Exception("ID de máquina es requerido");
    }
    
    // Verificar que la máquina existe
    $stmt = $db->getConnection()->prepare("SELECT id FROM maquinas WHERE id = :id");
    $stmt->execute([':id' => $data['id']]);
    if (!$stmt->fetch()) {
        throw new Exception("Máquina no encontrada");
    }
    
    // Recalcular depreciación si cambió el costo o vida útil
    if (isset($data['costo_adquisicion']) && isset($data['vida_util_horas'])) {
        $data['depreciacion_por_hora'] = $data['costo_adquisicion'] / $data['vida_util_horas'];
    }
    
    $query = "
        UPDATE maquinas SET
            nombre = :nombre,
            modelo = :modelo,
            tipo = :tipo,
            costo_adquisicion = :costo_adquisicion,
            vida_util_horas = :vida_util_horas,
            depreciacion_por_hora = :depreciacion_por_hora,
            volumen_construccion_x = :volumen_x,
            volumen_construccion_y = :volumen_y,
            volumen_construccion_z = :volumen_z,
            velocidad_max = :velocidad_max,
            num_extrusores = :num_extrusores,
            activa = :activa,
            horas_uso_total = :horas_uso_total,
            fecha_adquisicion = :fecha_adquisicion,
            notas = :notas,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = :id
    ";
    
    $stmt = $db->getConnection()->prepare($query);
    $result = $stmt->execute([
        ':id' => $data['id'],
        ':nombre' => $data['nombre'],
        ':modelo' => $data['modelo'] ?? null,
        ':tipo' => $data['tipo'] ?? 'FDM',
        ':costo_adquisicion' => $data['costo_adquisicion'],
        ':vida_util_horas' => $data['vida_util_horas'],
        ':depreciacion_por_hora' => $data['depreciacion_por_hora'],
        ':volumen_x' => $data['volumen_construccion_x'] ?? null,
        ':volumen_y' => $data['volumen_construccion_y'] ?? null,
        ':volumen_z' => $data['volumen_construccion_z'] ?? null,
        ':velocidad_max' => $data['velocidad_max'] ?? null,
        ':num_extrusores' => $data['num_extrusores'] ?? 1,
        ':activa' => $data['activa'] ?? true,
        ':horas_uso_total' => $data['horas_uso_total'] ?? 0,
        ':fecha_adquisicion' => $data['fecha_adquisicion'] ?? null,
        ':notas' => $data['notas'] ?? null
    ]);
    
    if (!$result) {
        throw new Exception("Error al actualizar la máquina");
    }
    
    // Obtener la máquina actualizada
    $stmt = $db->getConnection()->prepare("SELECT * FROM maquinas WHERE id = :id");
    $stmt->execute([':id' => $data['id']]);
    $maquina = $stmt->fetch(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'message' => 'Máquina actualizada exitosamente',
        'data' => $maquina
    ], JSON_UNESCAPED_UNICODE);
}

// ============================================
// ELIMINAR MÁQUINA
// ============================================

function eliminarMaquina($db) {
    $data = getRequestData();
    
    if (empty($data['id'])) {
        throw new Exception("ID de máquina es requerido");
    }
    
    // Verificar si hay cotizaciones asociadas
    $stmt = $db->getConnection()->prepare("
        SELECT COUNT(*) as total 
        FROM cotizaciones 
        WHERE maquina_id = :id
    ");
    $stmt->execute([':id' => $data['id']]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($result['total'] > 0) {
        throw new Exception("No se puede eliminar la máquina porque tiene cotizaciones asociadas. Total: {$result['total']}");
    }
    
    // Eliminar máquina
    $stmt = $db->getConnection()->prepare("DELETE FROM maquinas WHERE id = :id");
    $stmt->execute([':id' => $data['id']]);
    
    if ($stmt->rowCount() === 0) {
        throw new Exception("Máquina no encontrada");
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Máquina eliminada exitosamente'
    ], JSON_UNESCAPED_UNICODE);
}

// ============================================
// OBTENER ESTADÍSTICAS
// ============================================

function obtenerEstadisticas($db) {
    $query = "
        SELECT 
            COUNT(*) as total_maquinas,
            SUM(CASE WHEN activa = 1 THEN 1 ELSE 0 END) as maquinas_activas,
            SUM(horas_uso_total) as horas_totales,
            SUM(costo_adquisicion - (horas_uso_total * depreciacion_por_hora)) as valor_total_actual,
            AVG(depreciacion_por_hora) as depreciacion_promedio
        FROM maquinas
    ";
    
    $stmt = $db->getConnection()->prepare($query);
    $stmt->execute();
    $stats = $stmt->fetch(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'data' => $stats
    ], JSON_UNESCAPED_UNICODE);
}

?>