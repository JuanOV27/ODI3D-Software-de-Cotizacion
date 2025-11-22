<?php
/**
 * API - Gestión de Perfiles de Filamento
 * Sistema de Gestión 3D
 */

require_once 'config.php';

class PerfilesFilamento extends BaseModel {
    
    public function __construct() {
        parent::__construct('perfiles_filamento');
    }
    
    /**
     * Crea un nuevo perfil de filamento
     * @param array $data
     * @return array|false
     */
    public function create($data) {
        try {
            $id = $this->generateId();
            
            $sql = "INSERT INTO perfiles_filamento (
                id, tipo, marca, color_nombre, color_codigo, peso, costo,
                temperatura, calidad, calidad_nota, fecha_compra, fecha_creacion
            ) VALUES (
                :id, :tipo, :marca, :color_nombre, :color_codigo, :peso, :costo,
                :temperatura, :calidad, :calidad_nota, :fecha_compra, NOW()
            )";
            
            $params = [
                'id' => $id,
                'tipo' => $data['tipo'],
                'marca' => $data['marca'],
                'color_nombre' => $data['colorNombre'],
                'color_codigo' => $data['colorCodigo'],
                'peso' => $data['peso'],
                'costo' => $data['costo'],
                'temperatura' => $data['temperatura'] ?? null,
                'calidad' => $data['calidad'] ?? 0,
                'calidad_nota' => $data['calidadNota'] ?? null,
                'fecha_compra' => $data['fechaCompra'] ?? date('Y-m-d')
            ];
            
            $stmt = $this->query($sql, $params);
            
            if ($stmt) {
                return $this->findById($id);
            }
            
            return false;
            
        } catch (PDOException $e) {
            error_log("Error al crear perfil: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Actualiza un perfil de filamento
     * @param string $id
     * @param array $data
     * @return bool
     */
    public function update($id, $data) {
        try {
            $sql = "UPDATE perfiles_filamento SET
                tipo = :tipo,
                marca = :marca,
                color_nombre = :color_nombre,
                color_codigo = :color_codigo,
                peso = :peso,
                costo = :costo,
                temperatura = :temperatura,
                calidad = :calidad,
                calidad_nota = :calidad_nota,
                fecha_compra = :fecha_compra
            WHERE id = :id";
            
            $params = [
                'id' => $id,
                'tipo' => $data['tipo'],
                'marca' => $data['marca'],
                'color_nombre' => $data['colorNombre'],
                'color_codigo' => $data['colorCodigo'],
                'peso' => $data['peso'],
                'costo' => $data['costo'],
                'temperatura' => $data['temperatura'] ?? null,
                'calidad' => $data['calidad'] ?? 0,
                'calidad_nota' => $data['calidadNota'] ?? null,
                'fecha_compra' => $data['fechaCompra'] ?? null
            ];
            
            $stmt = $this->query($sql, $params);
            return $stmt !== false;
            
        } catch (PDOException $e) {
            error_log("Error al actualizar perfil: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Obtiene perfiles por tipo de filamento
     * @param string $tipo
     * @return array
     */
    public function findByTipo($tipo) {
        try {
            $sql = "SELECT * FROM perfiles_filamento WHERE tipo = :tipo ORDER BY marca, color_nombre";
            $stmt = $this->query($sql, ['tipo' => $tipo]);
            return $stmt ? $stmt->fetchAll() : [];
        } catch (PDOException $e) {
            error_log("Error en findByTipo: " . $e->getMessage());
            return [];
        }
    }
    
    /**
     * Busca perfiles por marca
     * @param string $marca
     * @return array
     */
    public function findByMarca($marca) {
        try {
            $sql = "SELECT * FROM perfiles_filamento WHERE marca LIKE :marca ORDER BY tipo, color_nombre";
            $stmt = $this->query($sql, ['marca' => "%$marca%"]);
            return $stmt ? $stmt->fetchAll() : [];
        } catch (PDOException $e) {
            error_log("Error en findByMarca: " . $e->getMessage());
            return [];
        }
    }
}

// ============================================
// CONTROLADOR DE LA API
// ============================================

$perfiles = new PerfilesFilamento();
$action = $_GET['action'] ?? '';

switch ($action) {
    
    case 'list':
        // Listar todos los perfiles
        Utils::validateMethod('GET');
        $data = $perfiles->findAll();
        Utils::sendJsonResponse(true, $data);
        break;
        
    case 'get':
        // Obtener un perfil específico
        Utils::validateMethod('GET');
        $id = $_GET['id'] ?? '';
        
        if (empty($id)) {
            Utils::sendJsonResponse(false, null, 'ID requerido');
        }
        
        $data = $perfiles->findById($id);
        
        if ($data) {
            Utils::sendJsonResponse(true, $data);
        } else {
            Utils::sendJsonResponse(false, null, 'Perfil no encontrado');
        }
        break;
        
    case 'create':
        // Crear nuevo perfil
        Utils::validateMethod('POST');
        $input = Utils::getRequestBody();
        
        // Validar campos requeridos
        $required = ['tipo', 'marca', 'colorNombre', 'colorCodigo', 'peso', 'costo'];
        $validation = Utils::validateRequired($input, $required);
        
        if (!$validation['valid']) {
            Utils::sendJsonResponse(false, null, 'Campos requeridos faltantes: ' . implode(', ', $validation['missing']));
        }
        
        $result = $perfiles->create($input);
        
        if ($result) {
            Utils::sendJsonResponse(true, $result, 'Perfil creado exitosamente');
        } else {
            Utils::sendJsonResponse(false, null, 'Error al crear perfil');
        }
        break;
        
    case 'update':
        // Actualizar perfil
        Utils::validateMethod('PUT');
        $input = Utils::getRequestBody();
        $id = $input['id'] ?? '';
        
        if (empty($id)) {
            Utils::sendJsonResponse(false, null, 'ID requerido');
        }
        
        // Validar campos requeridos
        $required = ['tipo', 'marca', 'colorNombre', 'colorCodigo', 'peso', 'costo'];
        $validation = Utils::validateRequired($input, $required);
        
        if (!$validation['valid']) {
            Utils::sendJsonResponse(false, null, 'Campos requeridos faltantes: ' . implode(', ', $validation['missing']));
        }
        
        $result = $perfiles->update($id, $input);
        
        if ($result) {
            $data = $perfiles->findById($id);
            Utils::sendJsonResponse(true, $data, 'Perfil actualizado exitosamente');
        } else {
            Utils::sendJsonResponse(false, null, 'Error al actualizar perfil');
        }
        break;
        
    case 'delete':
        // Eliminar perfil
        Utils::validateMethod('DELETE');
        $input = Utils::getRequestBody();
        $id = $input['id'] ?? $_GET['id'] ?? '';
        
        if (empty($id)) {
            Utils::sendJsonResponse(false, null, 'ID requerido');
        }
        
        $result = $perfiles->delete($id);
        
        if ($result) {
            Utils::sendJsonResponse(true, null, 'Perfil eliminado exitosamente');
        } else {
            Utils::sendJsonResponse(false, null, 'Error al eliminar perfil');
        }
        break;
        
    case 'byTipo':
        // Filtrar por tipo de filamento
        Utils::validateMethod('GET');
        $tipo = $_GET['tipo'] ?? '';
        
        if (empty($tipo)) {
            Utils::sendJsonResponse(false, null, 'Tipo de filamento requerido');
        }
        
        $data = $perfiles->findByTipo($tipo);
        Utils::sendJsonResponse(true, $data);
        break;
        
    case 'byMarca':
        // Buscar por marca
        Utils::validateMethod('GET');
        $marca = $_GET['marca'] ?? '';
        
        if (empty($marca)) {
            Utils::sendJsonResponse(false, null, 'Marca requerida');
        }
        
        $data = $perfiles->findByMarca($marca);
        Utils::sendJsonResponse(true, $data);
        break;
        
    default:
        Utils::sendJsonResponse(false, null, 'Acción no válida');
}