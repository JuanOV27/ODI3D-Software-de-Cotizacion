<?php
/**
 * Archivo de Configuración de Base de Datos
 * Sistema de Gestión 3D
 * Versión: 1.1 - Mejorado para XAMPP
 */

// ============================================
// CONFIGURACIÓN DE LA BASE DE DATOS
// ============================================

// Opción 1: Si MySQL tiene contraseña
// define('DB_HOST', 'localhost');
// define('DB_USER', 'root');
// define('DB_PASS', 'tu_contraseña_aqui');  // Pon tu contraseña aquí

// Opción 2: Si MySQL NO tiene contraseña (recomendado para desarrollo con XAMPP)
define('DB_HOST', '127.0.0.1');  // Usar IP en lugar de localhost
define('DB_USER', 'root');
define('DB_PASS', '');  // Sin contraseña

define('DB_NAME', 'sistema_gestion_3d');
define('DB_CHARSET', 'utf8mb4');
define('DB_PORT', '3307');  // Puerto configurado en XAMPP

// ============================================
// CLASE DE CONEXIÓN
// ============================================

class Database {
    private static $instance = null;
    private $connection;
    
    /**
     * Constructor privado para patrón Singleton
     */
    private function __construct() {
        try {
            // Construir DSN con puerto
            $dsn = sprintf(
                "mysql:host=%s;port=%s;dbname=%s;charset=%s",
                DB_HOST,
                DB_PORT,
                DB_NAME,
                DB_CHARSET
            );
            
            $options = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES " . DB_CHARSET,
                PDO::ATTR_PERSISTENT         => false
            ];
            
            $this->connection = new PDO($dsn, DB_USER, DB_PASS, $options);
            
            // Log de conexión exitosa
            error_log("✓ Conexión exitosa a MySQL");
            
        } catch (PDOException $e) {
            // Log detallado del error
            error_log("✗ Error de conexión a MySQL:");
            error_log("  - Host: " . DB_HOST);
            error_log("  - Puerto: " . DB_PORT);
            error_log("  - Base de datos: " . DB_NAME);
            error_log("  - Usuario: " . DB_USER);
            error_log("  - Error: " . $e->getMessage());
            
            // Mensaje amigable para el usuario
            $errorResponse = [
                'success' => false,
                'error' => 'Error de conexión a la base de datos',
                'message' => $e->getMessage(),
                'hint' => $this->getConnectionHint($e->getMessage())
            ];
            
            header('Content-Type: application/json; charset=utf-8');
            die(json_encode($errorResponse, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        }
    }
    
    /**
     * Proporciona sugerencias según el tipo de error
     */
    private function getConnectionHint($errorMessage) {
        if (strpos($errorMessage, 'Access denied') !== false) {
            if (strpos($errorMessage, 'using password: NO') !== false) {
                return "La base de datos requiere contraseña. Actualiza DB_PASS en config.php o configura MySQL sin contraseña.";
            } else {
                return "Usuario o contraseña incorrectos. Verifica DB_USER y DB_PASS en config.php.";
            }
        } elseif (strpos($errorMessage, 'Unknown database') !== false) {
            return "La base de datos '" . DB_NAME . "' no existe. Ejecuta database_setup.sql en phpMyAdmin primero.";
        } elseif (strpos($errorMessage, 'Connection refused') !== false) {
            return "MySQL no está corriendo. Inicia MySQL desde el Panel de Control de XAMPP.";
        } elseif (strpos($errorMessage, "Can't connect") !== false) {
            return "No se puede conectar a MySQL. Verifica que MySQL esté corriendo y que DB_HOST y DB_PORT sean correctos.";
        }
        
        return "Verifica la configuración de MySQL en XAMPP y los valores en config.php.";
    }
    
    /**
     * Obtiene la instancia única de la conexión
     * @return Database
     */
    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    /**
     * Obtiene la conexión PDO
     * @return PDO
     */
    public function getConnection() {
        return $this->connection;
    }
    
    /**
     * Prueba la conexión y retorna información
     * @return array
     */
    public function testConnection() {
        try {
            $stmt = $this->connection->query("SELECT VERSION() as version, DATABASE() as db_name");
            $info = $stmt->fetch();
            
            return [
                'success' => true,
                'connected' => true,
                'mysql_version' => $info['version'],
                'database' => $info['db_name'],
                'host' => DB_HOST,
                'port' => DB_PORT,
                'charset' => DB_CHARSET,
                'user' => DB_USER
            ];
        } catch (PDOException $e) {
            return [
                'success' => false,
                'connected' => false,
                'error' => $e->getMessage()
            ];
        }
    }
    
    /**
     * Previene la clonación del objeto
     */
    private function __clone() {}
    
    /**
     * Previene la deserialización del objeto
     */
    public function __wakeup() {
        throw new Exception("No se puede deserializar un singleton.");
    }
}

/**
 * Clase base para operaciones CRUD
 */
class BaseModel {
    protected $db;
    protected $table;
    
    public function __construct($table) {
        $this->db = Database::getInstance()->getConnection();
        $this->table = $table;
    }
    
    /**
     * Genera un ID único
     * @return string
     */
    protected function generateId() {
        return time() . '_' . substr(md5(uniqid(rand(), true)), 0, 9);
    }
    
    /**
     * Encuentra un registro por ID
     * @param string $id
     * @return array|null
     */
    public function findById($id) {
        try {
            $sql = "SELECT * FROM {$this->table} WHERE id = :id";
            $stmt = $this->db->prepare($sql);
            $stmt->execute(['id' => $id]);
            return $stmt->fetch();
        } catch (PDOException $e) {
            error_log("Error en findById: " . $e->getMessage());
            return null;
        }
    }
    
    /**
     * Obtiene todos los registros
     * @return array
     */
    public function findAll() {
        try {
            $sql = "SELECT * FROM {$this->table} ORDER BY fecha_creacion DESC";
            $stmt = $this->db->query($sql);
            return $stmt->fetchAll();
        } catch (PDOException $e) {
            error_log("Error en findAll: " . $e->getMessage());
            return [];
        }
    }
    
    /**
     * Elimina un registro por ID
     * @param string $id
     * @return bool
     */
    public function delete($id) {
        try {
            $sql = "DELETE FROM {$this->table} WHERE id = :id";
            $stmt = $this->db->prepare($sql);
            return $stmt->execute(['id' => $id]);
        } catch (PDOException $e) {
            error_log("Error en delete: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Ejecuta una consulta SQL con parámetros
     * @param string $sql
     * @param array $params
     * @return PDOStatement|false
     */
    protected function query($sql, $params = []) {
        try {
            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
            return $stmt;
        } catch (PDOException $e) {
            error_log("Error en query: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Inicia una transacción
     */
    public function beginTransaction() {
        $this->db->beginTransaction();
    }
    
    /**
     * Confirma una transacción
     */
    public function commit() {
        $this->db->commit();
    }
    
    /**
     * Revierte una transacción
     */
    public function rollback() {
        $this->db->rollBack();
    }
}

/**
 * Clase de utilidades
 */
class Utils {
    /**
     * Envía una respuesta JSON
     * @param bool $success
     * @param mixed $data
     * @param string $message
     */
    public static function sendJsonResponse($success, $data = null, $message = '') {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'success' => $success,
            'data' => $data,
            'message' => $message
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        exit;
    }
    
    /**
     * Valida campos requeridos
     * @param array $data
     * @param array $required
     * @return array
     */
    public static function validateRequired($data, $required) {
        $missing = [];
        foreach ($required as $field) {
            if (!isset($data[$field]) || $data[$field] === '' || $data[$field] === null) {
                $missing[] = $field;
            }
        }
        
        return [
            'valid' => empty($missing),
            'missing' => $missing
        ];
    }
    
    /**
     * Limpia y valida datos de entrada
     * @param mixed $data
     * @return mixed
     */
    public static function sanitizeInput($data) {
        if (is_array($data)) {
            return array_map([self::class, 'sanitizeInput'], $data);
        }
        return htmlspecialchars(strip_tags(trim($data)), ENT_QUOTES, 'UTF-8');
    }
    
    /**
     * Valida método HTTP
     * @param string $method
     */
    public static function validateMethod($method) {
        if ($_SERVER['REQUEST_METHOD'] !== $method) {
            self::sendJsonResponse(false, null, "Método HTTP inválido. Se esperaba $method");
        }
    }
    
    /**
     * Obtiene el body de la petición como array
     * @return array
     */
    public static function getRequestBody() {
        $input = file_get_contents('php://input');
        return json_decode($input, true) ?? [];
    }
}

// ============================================
// CONFIGURACIÓN GENERAL
// ============================================

// Configuración de zona horaria
date_default_timezone_set('America/Bogota');

// Habilitar CORS para desarrollo local
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Manejar peticiones OPTIONS (preflight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Configuración de errores
error_reporting(E_ALL);
ini_set('display_errors', 0);  // No mostrar errores en producción
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/logs/php_errors.log');

// Crear directorio de logs si no existe
if (!file_exists(__DIR__ . '/logs')) {
    mkdir(__DIR__ . '/logs', 0755, true);
}

// ============================================
// TEST DE CONEXIÓN (solo cuando se llama directamente)
// ============================================

// Si se accede directamente a config.php, mostrar información de conexión
if (basename($_SERVER['PHP_SELF']) === 'config.php') {
    try {
        $db = Database::getInstance();
        $info = $db->testConnection();
        
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($info, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        
    } catch (Exception $e) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'success' => false,
            'error' => $e->getMessage()
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    }
}