<?php
// ============================================
// API SUMINISTROS - BACKEND PHP
// ============================================

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Manejo de preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Incluir configuración de base de datos
// Nota: el archivo de configuración se llama `config.php` en este proyecto
require_once 'config.php';

// Obtener la acción solicitada
$action = isset($_GET['action']) ? $_GET['action'] : '';

// ============================================
// FUNCIONES DE BASE DE DATOS
// ============================================

function obtenerConexion() {
    // Preferir la clase Database central (definida en config.php)
    try {
        if (class_exists('Database')) {
            $dbInstance = Database::getInstance();
            $pdo = $dbInstance->getConnection();
            return $pdo;
        }

        // Fallback: intentar leer constantes definidas en config.php
        $host = defined('DB_HOST') ? DB_HOST : '127.0.0.1';
        $dbname = defined('DB_NAME') ? DB_NAME : '';
        $username = defined('DB_USER') ? DB_USER : 'root';
        $password = defined('DB_PASS') ? DB_PASS : '';
        $port = defined('DB_PORT') ? DB_PORT : '3306';

        $dsn = "mysql:host={$host};port={$port};dbname={$dbname};charset=utf8mb4";
        $pdo = new PDO($dsn, $username, $password);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        return $pdo;
    } catch (Exception $e) {
        error_log("Error de conexión en obtenerConexion: " . $e->getMessage());
        return null;
    }
}

// ============================================
// LISTAR SUMINISTROS
// ============================================

function listarSuministros() {
    $pdo = obtenerConexion();
    if (!$pdo) {
        return ['success' => false, 'message' => 'Error de conexión a la base de datos'];
    }
    
    try {
        $stmt = $pdo->prepare("
            SELECT * FROM suministros 
            ORDER BY fecha_creacion DESC
        ");
        $stmt->execute();
        $suministros = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        return [
            'success' => true,
            'suministros' => $suministros
        ];
    } catch(PDOException $e) {
        return [
            'success' => false,
            'message' => 'Error al obtener suministros: ' . $e->getMessage()
        ];
    }
}

// ============================================
// OBTENER SUMINISTRO POR ID
// ============================================

function obtenerSuministro($id) {
    $pdo = obtenerConexion();
    if (!$pdo) {
        return ['success' => false, 'message' => 'Error de conexión'];
    }
    
    try {
        $stmt = $pdo->prepare("SELECT * FROM suministros WHERE id = :id");
        $stmt->execute(['id' => $id]);
        $suministro = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($suministro) {
            return ['success' => true, 'suministro' => $suministro];
        } else {
            return ['success' => false, 'message' => 'Suministro no encontrado'];
        }
    } catch(PDOException $e) {
        return ['success' => false, 'message' => 'Error: ' . $e->getMessage()];
    }
}

// ============================================
// CREAR SUMINISTRO
// ============================================

function crearSuministro($datos) {
    $pdo = obtenerConexion();
    if (!$pdo) {
        return ['success' => false, 'message' => 'Error de conexión'];
    }
    
    try {
        $stmt = $pdo->prepare("
            INSERT INTO suministros (
                id, nombre, categoria, precio, unidades, unidad_medida,
                descripcion, marca, color_nombre, color, medidas,
                fecha_compra, stock_minimo, notas, foto,
                fecha_creacion, fecha_modificacion
            ) VALUES (
                :id, :nombre, :categoria, :precio, :unidades, :unidad_medida,
                :descripcion, :marca, :color_nombre, :color, :medidas,
                :fecha_compra, :stock_minimo, :notas, :foto,
                NOW(), NOW()
            )
        ");
        
        $stmt->execute([
            'id' => $datos['id'],
            'nombre' => $datos['nombre'],
            'categoria' => $datos['categoria'],
            'precio' => $datos['precio'],
            'unidades' => $datos['unidades'],
            'unidad_medida' => $datos['unidadMedida'] ?? 'unidades',
            'descripcion' => $datos['descripcion'],
            'marca' => $datos['marca'] ?? null,
            'color_nombre' => $datos['colorNombre'] ?? null,
            'color' => $datos['color'] ?? null,
            'medidas' => $datos['medidas'] ?? null,
            'fecha_compra' => $datos['fechaCompra'] ?? null,
            'stock_minimo' => $datos['stockMinimo'] ?? 5,
            'notas' => $datos['notas'] ?? null,
            'foto' => $datos['foto'] ?? null
        ]);
        
        return [
            'success' => true,
            'message' => 'Suministro creado exitosamente',
            'id' => $datos['id']
        ];
    } catch(PDOException $e) {
        return [
            'success' => false,
            'message' => 'Error al crear suministro: ' . $e->getMessage()
        ];
    }
}

// ============================================
// ACTUALIZAR SUMINISTRO
// ============================================

function actualizarSuministro($datos) {
    $pdo = obtenerConexion();
    if (!$pdo) {
        return ['success' => false, 'message' => 'Error de conexión'];
    }
    
    try {
        $stmt = $pdo->prepare("
            UPDATE suministros SET
                nombre = :nombre,
                categoria = :categoria,
                precio = :precio,
                unidades = :unidades,
                unidad_medida = :unidad_medida,
                descripcion = :descripcion,
                marca = :marca,
                color_nombre = :color_nombre,
                color = :color,
                medidas = :medidas,
                fecha_compra = :fecha_compra,
                stock_minimo = :stock_minimo,
                notas = :notas,
                foto = :foto,
                fecha_modificacion = NOW()
            WHERE id = :id
        ");
        
        $stmt->execute([
            'id' => $datos['id'],
            'nombre' => $datos['nombre'],
            'categoria' => $datos['categoria'],
            'precio' => $datos['precio'],
            'unidades' => $datos['unidades'],
            'unidad_medida' => $datos['unidadMedida'] ?? 'unidades',
            'descripcion' => $datos['descripcion'],
            'marca' => $datos['marca'] ?? null,
            'color_nombre' => $datos['colorNombre'] ?? null,
            'color' => $datos['color'] ?? null,
            'medidas' => $datos['medidas'] ?? null,
            'fecha_compra' => $datos['fechaCompra'] ?? null,
            'stock_minimo' => $datos['stockMinimo'] ?? 5,
            'notas' => $datos['notas'] ?? null,
            'foto' => $datos['foto'] ?? null
        ]);
        
        return [
            'success' => true,
            'message' => 'Suministro actualizado exitosamente'
        ];
    } catch(PDOException $e) {
        return [
            'success' => false,
            'message' => 'Error al actualizar suministro: ' . $e->getMessage()
        ];
    }
}

// ============================================
// ELIMINAR SUMINISTRO
// ============================================

function eliminarSuministro($id) {
    $pdo = obtenerConexion();
    if (!$pdo) {
        return ['success' => false, 'message' => 'Error de conexión'];
    }
    
    try {
        $stmt = $pdo->prepare("DELETE FROM suministros WHERE id = :id");
        $stmt->execute(['id' => $id]);
        
        return [
            'success' => true,
            'message' => 'Suministro eliminado exitosamente'
        ];
    } catch(PDOException $e) {
        return [
            'success' => false,
            'message' => 'Error al eliminar suministro: ' . $e->getMessage()
        ];
    }
}

// ============================================
// ACTUALIZAR STOCK
// ============================================

function actualizarStock($id, $cantidad, $operacion = 'restar') {
    $pdo = obtenerConexion();
    if (!$pdo) {
        return ['success' => false, 'message' => 'Error de conexión'];
    }
    
    try {
        if ($operacion === 'sumar') {
            $stmt = $pdo->prepare("
                UPDATE suministros 
                SET unidades = unidades + :cantidad,
                    fecha_modificacion = NOW()
                WHERE id = :id
            ");
        } else {
            $stmt = $pdo->prepare("
                UPDATE suministros 
                SET unidades = GREATEST(0, unidades - :cantidad),
                    fecha_modificacion = NOW()
                WHERE id = :id
            ");
        }
        
        $stmt->execute([
            'id' => $id,
            'cantidad' => $cantidad
        ]);
        
        return [
            'success' => true,
            'message' => 'Stock actualizado exitosamente'
        ];
    } catch(PDOException $e) {
        return [
            'success' => false,
            'message' => 'Error al actualizar stock: ' . $e->getMessage()
        ];
    }
}

// ============================================
// OBTENER ESTADÍSTICAS
// ============================================

function obtenerEstadisticas() {
    $pdo = obtenerConexion();
    if (!$pdo) {
        return ['success' => false, 'message' => 'Error de conexión'];
    }
    
    try {
        // Total de suministros
        $stmt = $pdo->query("SELECT COUNT(*) as total FROM suministros");
        $total = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
        
        // Valor total del inventario
        $stmt = $pdo->query("SELECT SUM(precio * unidades) as valor FROM suministros");
        $valorTotal = $stmt->fetch(PDO::FETCH_ASSOC)['valor'] ?? 0;
        
        // Stock bajo
        $stmt = $pdo->query("
            SELECT COUNT(*) as stock_bajo 
            FROM suministros 
            WHERE unidades <= stock_minimo AND unidades > 0
        ");
        $stockBajo = $stmt->fetch(PDO::FETCH_ASSOC)['stock_bajo'];
        
        // Categorías activas
        $stmt = $pdo->query("SELECT COUNT(DISTINCT categoria) as categorias FROM suministros");
        $categorias = $stmt->fetch(PDO::FETCH_ASSOC)['categorias'];
        
        return [
            'success' => true,
            'estadisticas' => [
                'total_suministros' => $total,
                'valor_inventario' => $valorTotal,
                'stock_bajo' => $stockBajo,
                'categorias_activas' => $categorias
            ]
        ];
    } catch(PDOException $e) {
        return [
            'success' => false,
            'message' => 'Error al obtener estadísticas: ' . $e->getMessage()
        ];
    }
}

// ============================================
// ROUTER DE ACCIONES
// ============================================

try {
    switch ($action) {
        case 'listar':
            echo json_encode(listarSuministros());
            break;
            
        case 'obtener':
            $id = $_GET['id'] ?? '';
            if (empty($id)) {
                echo json_encode(['success' => false, 'message' => 'ID no proporcionado']);
            } else {
                echo json_encode(obtenerSuministro($id));
            }
            break;
            
        case 'crear':
            $datos = json_decode(file_get_contents('php://input'), true);
            if (!$datos) {
                echo json_encode(['success' => false, 'message' => 'Datos inválidos']);
            } else {
                echo json_encode(crearSuministro($datos));
            }
            break;
            
        case 'actualizar':
            $datos = json_decode(file_get_contents('php://input'), true);
            if (!$datos) {
                echo json_encode(['success' => false, 'message' => 'Datos inválidos']);
            } else {
                echo json_encode(actualizarSuministro($datos));
            }
            break;
            
        case 'eliminar':
            $datos = json_decode(file_get_contents('php://input'), true);
            $id = $datos['id'] ?? '';
            if (empty($id)) {
                echo json_encode(['success' => false, 'message' => 'ID no proporcionado']);
            } else {
                echo json_encode(eliminarSuministro($id));
            }
            break;
            
        case 'actualizar_stock':
            $datos = json_decode(file_get_contents('php://input'), true);
            $id = $datos['id'] ?? '';
            $cantidad = $datos['cantidad'] ?? 0;
            $operacion = $datos['operacion'] ?? 'restar';
            
            if (empty($id) || $cantidad <= 0) {
                echo json_encode(['success' => false, 'message' => 'Datos incompletos']);
            } else {
                echo json_encode(actualizarStock($id, $cantidad, $operacion));
            }
            break;
            
        case 'estadisticas':
            echo json_encode(obtenerEstadisticas());
            break;
            
        default:
            echo json_encode([
                'success' => false,
                'message' => 'Acción no válida',
                'acciones_disponibles' => ['listar', 'obtener', 'crear', 'actualizar', 'eliminar', 'actualizar_stock', 'estadisticas']
            ]);
            break;
    }
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Error del servidor: ' . $e->getMessage()
    ]);
}
?>
