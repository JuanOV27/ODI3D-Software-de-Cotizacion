<?php
// ============================================
// API_PROYECTOS.PHP
// Compatible con config.php (PDO)
// Sistema de Gestión 3D
// ============================================

// Headers
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Desactivar warnings que rompen el JSON
error_reporting(E_ERROR | E_PARSE);
ini_set('display_errors', 0);

// Manejar preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Buffer de salida
ob_start();

try {
    // Incluir configuración
    require_once __DIR__ . '/config.php';
    
    // Obtener conexión PDO
    $db = Database::getInstance()->getConnection();
    
    // ============================================
    // FUNCIONES
    // ============================================
    
    function crearProyecto($db) {
        try {
            // Obtener datos
            $id = $_POST['id'] ?? null;
            $cotizacion_id = $_POST['cotizacion_id'] ?? null;
            
            if (!$id || !$cotizacion_id) {
                return ['success' => false, 'message' => 'Faltan datos requeridos (id, cotizacion_id)'];
            }
            
            $nombre_completo = $_POST['nombre_completo'] ?? null;
            $numero_telefono = $_POST['numero_telefono'] ?? null;
            $numero_whatsapp = $_POST['numero_whatsapp'] ?? null;
            
            if (!$nombre_completo || !$numero_telefono || !$numero_whatsapp) {
                return ['success' => false, 'message' => 'Faltan datos del cliente'];
            }
            
            // Datos opcionales
            $cedula = !empty($_POST['cedula']) ? $_POST['cedula'] : null;
            $direccion = !empty($_POST['direccion']) ? $_POST['direccion'] : null;
            $barrio = !empty($_POST['barrio']) ? $_POST['barrio'] : null;
            $municipio = !empty($_POST['municipio']) ? $_POST['municipio'] : null;
            $fecha_pago = !empty($_POST['fecha_pago']) ? $_POST['fecha_pago'] : null;
            $fecha_entrega = !empty($_POST['fecha_entrega']) ? $_POST['fecha_entrega'] : null;
            $notas = !empty($_POST['notas']) ? $_POST['notas'] : null;
            
            // Manejar imagen
            $imagen_pago = null;
            if (isset($_FILES['imagen_pago']) && $_FILES['imagen_pago']['error'] === UPLOAD_ERR_OK) {
                $resultado = guardarImagenPago($_FILES['imagen_pago'], $id);
                if ($resultado['success']) {
                    $imagen_pago = $resultado['ruta'];
                } else {
                    return $resultado;
                }
            }
            
            // Verificar tabla existe
            $check = $db->query("SHOW TABLES LIKE 'proyectos'");
            if ($check->rowCount() === 0) {
                return ['success' => false, 'message' => 'La tabla proyectos no existe. Ejecuta el script SQL primero.'];
            }
            
            // Insertar
            $sql = "INSERT INTO proyectos (
                id, cotizacion_id, 
                nombre_completo, numero_telefono, cedula, numero_whatsapp,
                direccion, barrio, municipio,
                imagen_pago, fecha_pago, fecha_entrega,
                notas, estado
            ) VALUES (
                :id, :cotizacion_id,
                :nombre_completo, :numero_telefono, :cedula, :numero_whatsapp,
                :direccion, :barrio, :municipio,
                :imagen_pago, :fecha_pago, :fecha_entrega,
                :notas, 'pendiente'
            )";
            
            $stmt = $db->prepare($sql);
            
            $params = [
                ':id' => $id,
                ':cotizacion_id' => $cotizacion_id,
                ':nombre_completo' => $nombre_completo,
                ':numero_telefono' => $numero_telefono,
                ':cedula' => $cedula,
                ':numero_whatsapp' => $numero_whatsapp,
                ':direccion' => $direccion,
                ':barrio' => $barrio,
                ':municipio' => $municipio,
                ':imagen_pago' => $imagen_pago,
                ':fecha_pago' => $fecha_pago,
                ':fecha_entrega' => $fecha_entrega,
                ':notas' => $notas
            ];
            
            if ($stmt->execute($params)) {
                return [
                    'success' => true,
                    'message' => 'Proyecto creado exitosamente',
                    'proyecto_id' => $id,
                    'imagen_pago' => $imagen_pago
                ];
            } else {
                $error = $stmt->errorInfo();
                throw new Exception('Error al insertar: ' . $error[2]);
            }
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Error: ' . $e->getMessage()
            ];
        }
    }
    
    function listarProyectos($db) {
        try {
            $sql = "SELECT 
                p.*,
                c.nombre_pieza,
                c.cantidad_piezas,
                calc.precio_final,
                calc.precio_minorista,
                calc.precio_mayorista
            FROM proyectos p
            LEFT JOIN cotizaciones c ON p.cotizacion_id = c.id
            LEFT JOIN calculos_cotizacion calc ON c.id = calc.cotizacion_id
            ORDER BY p.fecha_creacion DESC";
            
            $stmt = $db->query($sql);
            $proyectos = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            return [
                'success' => true,
                'proyectos' => $proyectos,
                'total' => count($proyectos)
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Error: ' . $e->getMessage()
            ];
        }
    }
    
    function obtenerProyecto($db, $id) {
        try {
            $sql = "SELECT 
                p.*,
                c.nombre_pieza,
                c.cantidad_piezas,
                c.peso_pieza,
                c.tiempo_impresion,
                calc.precio_final,
                calc.precio_minorista,
                calc.precio_mayorista,
                calc.costo_total_pedido
            FROM proyectos p
            LEFT JOIN cotizaciones c ON p.cotizacion_id = c.id
            LEFT JOIN calculos_cotizacion calc ON c.id = calc.cotizacion_id
            WHERE p.id = :id";
            
            $stmt = $db->prepare($sql);
            $stmt->execute([':id' => $id]);
            $proyecto = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($proyecto) {
                return [
                    'success' => true,
                    'proyecto' => $proyecto
                ];
            } else {
                return [
                    'success' => false,
                    'message' => 'Proyecto no encontrado'
                ];
            }
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Error: ' . $e->getMessage()
            ];
        }
    }
    
    function actualizarEstadoProyecto($db, $id, $estado) {
        try {
            $estadosValidos = ['pendiente', 'en_proceso', 'completado', 'entregado', 'cancelado'];
            
            if (!in_array($estado, $estadosValidos)) {
                return ['success' => false, 'message' => 'Estado inválido'];
            }
            
            $sql = "UPDATE proyectos SET estado = :estado WHERE id = :id";
            $stmt = $db->prepare($sql);
            
            if ($stmt->execute([':estado' => $estado, ':id' => $id])) {
                return [
                    'success' => true,
                    'message' => 'Estado actualizado'
                ];
            } else {
                throw new Exception('Error al actualizar');
            }
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Error: ' . $e->getMessage()
            ];
        }
    }
    
    function eliminarProyecto($db, $id) {
        try {
            // Obtener imagen
            $sql = "SELECT imagen_pago FROM proyectos WHERE id = :id";
            $stmt = $db->prepare($sql);
            $stmt->execute([':id' => $id]);
            $proyecto = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($proyecto) {
                // Eliminar imagen si existe
                if ($proyecto['imagen_pago']) {
                    $rutaImagen = __DIR__ . '/../' . $proyecto['imagen_pago'];
                    if (file_exists($rutaImagen)) {
                        @unlink($rutaImagen);
                    }
                }
                
                // Eliminar proyecto
                $sql = "DELETE FROM proyectos WHERE id = :id";
                $stmt = $db->prepare($sql);
                
                if ($stmt->execute([':id' => $id])) {
                    return [
                        'success' => true,
                        'message' => 'Proyecto eliminado'
                    ];
                } else {
                    throw new Exception('Error al eliminar');
                }
            } else {
                return [
                    'success' => false,
                    'message' => 'Proyecto no encontrado'
                ];
            }
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Error: ' . $e->getMessage()
            ];
        }
    }
    
    // ============================================
    // GUARDAR IMAGEN
    // ============================================
    
    function guardarImagenPago($archivo, $proyectoId) {
        try {
            // Validar tipo
            $tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
            if (!in_array($archivo['type'], $tiposPermitidos)) {
                return ['success' => false, 'message' => 'Tipo de archivo no permitido'];
            }
            
            // Validar tamaño (5MB)
            if ($archivo['size'] > 5 * 1024 * 1024) {
                return ['success' => false, 'message' => 'Archivo muy grande (máx 5MB)'];
            }
            
            // Crear directorio
            $directorioBase = __DIR__ . '/../uploads/pagos';
            if (!file_exists($directorioBase)) {
                if (!mkdir($directorioBase, 0777, true)) {
                    return ['success' => false, 'message' => 'No se pudo crear directorio'];
                }
            }
            
            // Nombre único
            $extension = pathinfo($archivo['name'], PATHINFO_EXTENSION);
            $nombreArchivo = $proyectoId . '_' . time() . '.' . $extension;
            $rutaCompleta = $directorioBase . '/' . $nombreArchivo;
            
            // Mover archivo
            if (move_uploaded_file($archivo['tmp_name'], $rutaCompleta)) {
                return [
                    'success' => true,
                    'ruta' => 'uploads/pagos/' . $nombreArchivo
                ];
            } else {
                return ['success' => false, 'message' => 'Error al mover archivo'];
            }
            
        } catch (Exception $e) {
            return ['success' => false, 'message' => 'Error: ' . $e->getMessage()];
        }
    }
    
    // ============================================
    // ROUTER
    // ============================================
    
    $metodo = $_SERVER['REQUEST_METHOD'];
    $action = $_GET['action'] ?? '';
    
    $respuesta = null;
    
    switch ($metodo) {
        case 'GET':
            if ($action === 'listar') {
                $respuesta = listarProyectos($db);
            } elseif ($action === 'obtener' && isset($_GET['id'])) {
                $respuesta = obtenerProyecto($db, $_GET['id']);
            } else {
                $respuesta = ['success' => false, 'message' => 'Acción no válida'];
            }
            break;
            
        case 'POST':
            if ($action === 'crear' || !$action) {
                $respuesta = crearProyecto($db);
            } elseif ($action === 'actualizar_estado') {
                $id = $_POST['id'] ?? null;
                $estado = $_POST['estado'] ?? null;
                if ($id && $estado) {
                    $respuesta = actualizarEstadoProyecto($db, $id, $estado);
                } else {
                    $respuesta = ['success' => false, 'message' => 'Faltan parámetros'];
                }
            } else {
                $respuesta = ['success' => false, 'message' => 'Acción no válida'];
            }
            break;
            
        case 'DELETE':
            if (isset($_GET['id'])) {
                $respuesta = eliminarProyecto($db, $_GET['id']);
            } else {
                $respuesta = ['success' => false, 'message' => 'Falta ID'];
            }
            break;
            
        default:
            $respuesta = ['success' => false, 'message' => 'Método no soportado'];
            break;
    }
    
    // Limpiar buffer
    ob_end_clean();
    
    // Enviar JSON
    echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    ob_end_clean();
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error del servidor: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
?>