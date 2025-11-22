<?php
/**
 * API - Gestión de Inventario de Carretes
 * Sistema de Gestión 3D
 */

require_once 'config.php';

class InventarioCarretes extends BaseModel {
    
    public function __construct() {
        parent::__construct('inventario_carretes');
    }
    
    /**
     * Crea un nuevo carrete en el inventario
     * @param array $data
     * @return array|false
     */
    public function create($data) {
        try {
            $id = $this->generateId();
            
            $sql = "INSERT INTO inventario_carretes (
                id, perfil_id, peso_inicial, peso_usado, estado, fecha_creacion
            ) VALUES (
                :id, :perfil_id, :peso_inicial, :peso_usado, :estado, NOW()
            )";
            
            $params = [
                'id' => $id,
                'perfil_id' => $data['perfilId'],
                'peso_inicial' => $data['pesoInicial'] ?? 1000,
                'peso_usado' => $data['pesoUsado'] ?? 0,
                'estado' => $data['estado'] ?? 'activo'
            ];
            
            $stmt = $this->query($sql, $params);
            
            if ($stmt) {
                return $this->findById($id);
            }
            
            return false;
            
        } catch (PDOException $e) {
            error_log("Error al crear carrete: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Actualiza el estado de un carrete
     * @param string $id
     * @param array $data
     * @return bool
     */
    public function update($id, $data) {
        try {
            $sql = "UPDATE inventario_carretes SET
                peso_usado = :peso_usado,
                estado = :estado
            WHERE id = :id";
            
            $params = [
                'id' => $id,
                'peso_usado' => $data['pesoUsado'],
                'estado' => $data['estado']
            ];
            
            $stmt = $this->query($sql, $params);
            return $stmt !== false;
            
        } catch (PDOException $e) {
            error_log("Error al actualizar carrete: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Obtiene carretes de un perfil específico
     * @param string $perfilId
     * @return array
     */
    public function findByPerfil($perfilId) {
        try {
            $sql = "SELECT * FROM vista_inventario_detallado WHERE perfil_id = :perfil_id ORDER BY fecha_creacion DESC";
            $stmt = $this->query($sql, ['perfil_id' => $perfilId]);
            return $stmt ? $stmt->fetchAll() : [];
        } catch (PDOException $e) {
            error_log("Error en findByPerfil: " . $e->getMessage());
            return [];
        }
    }
    
    /**
     * Obtiene carretes disponibles (activos)
     * @return array
     */
    public function findDisponibles() {
        try {
            $sql = "SELECT * FROM vista_inventario_detallado WHERE estado = 'activo' ORDER BY porcentaje_restante DESC";
            $stmt = $this->query($sql, []);
            return $stmt ? $stmt->fetchAll() : [];
        } catch (PDOException $e) {
            error_log("Error en findDisponibles: " . $e->getMessage());
            return [];
        }
    }
    
    /**
     * Obtiene carretes con bajo stock (< 20%)
     * @return array
     */
    public function findBajoStock() {
        try {
            $sql = "SELECT * FROM vista_inventario_detallado 
                    WHERE estado = 'activo' AND porcentaje_restante < 20 
                    ORDER BY porcentaje_restante ASC";
            $stmt = $this->query($sql, []);
            return $stmt ? $stmt->fetchAll() : [];
        } catch (PDOException $e) {
            error_log("Error en findBajoStock: " . $e->getMessage());
            return [];
        }
    }
    
    /**
     * Registra el uso de filamento
     * @param string $carreteId
     * @param float $gramosUsados
     * @param string $nombreProyecto
     * @return array|false
     */
    public function registrarUso($carreteId, $gramosUsados, $nombreProyecto = '') {
        try {
            // Validar que el carrete existe y tiene suficiente filamento
            $carrete = $this->findById($carreteId);
            if (!$carrete) {
                throw new Exception('Carrete no encontrado');
            }
            
            $pesoRestante = $carrete['peso_inicial'] - $carrete['peso_usado'];
            if ($gramosUsados > $pesoRestante) {
                throw new Exception('No hay suficiente filamento en el carrete');
            }
            
            // Actualizar peso usado del carrete
            $nuevoPesoUsado = $carrete['peso_usado'] + $gramosUsados;
            $nuevoEstado = ($pesoRestante - $gramosUsados) <= 0 ? 'agotado' : 'activo';
            
            $sql = "UPDATE inventario_carretes 
                    SET peso_usado = :peso_usado, estado = :estado 
                    WHERE id = :id";
            
            $stmt = $this->query($sql, [
                'peso_usado' => $nuevoPesoUsado,
                'estado' => $nuevoEstado,
                'id' => $carreteId
            ]);
            
            if (!$stmt) {
                throw new Exception('Error al actualizar carrete');
            }
            
            // Registrar en historial
            $usoId = $this->generateId();
            $pesoRestanteAnterior = $pesoRestante;
            $pesoRestanteActual = $pesoRestante - $gramosUsados;
            
            $sqlHistorial = "INSERT INTO historial_uso (
                id, carrete_id, perfil_id, gramos_usados,
                peso_restante_anterior, peso_restante_actual, nombre_proyecto
            ) VALUES (
                :id, :carrete_id, :perfil_id, :gramos_usados,
                :peso_restante_anterior, :peso_restante_actual, :nombre_proyecto
            )";
            
            $stmtHistorial = $this->query($sqlHistorial, [
                'id' => $usoId,
                'carrete_id' => $carreteId,
                'perfil_id' => $carrete['perfil_id'],
                'gramos_usados' => $gramosUsados,
                'peso_restante_anterior' => $pesoRestanteAnterior,
                'peso_restante_actual' => $pesoRestanteActual,
                'nombre_proyecto' => $nombreProyecto
            ]);
            
            if (!$stmtHistorial) {
                throw new Exception('Error al registrar en historial');
            }
            
            return [
                'id' => $usoId,
                'mensaje' => 'Uso registrado exitosamente',
                'peso_usado' => $nuevoPesoUsado,
                'peso_restante' => $pesoRestanteActual
            ];
            
        } catch (Exception $e) {
            error_log("Error en registrarUso: " . $e->getMessage());
            throw $e;
        }
    }
    
    /**
     * Obtiene estadísticas del inventario
     * @return array|null
     */
    public function getEstadisticas() {
        try {
            $sql = "CALL sp_estadisticas_inventario()";
            $stmt = $this->query($sql, []);
            return $stmt ? $stmt->fetch() : null;
        } catch (PDOException $e) {
            error_log("Error al obtener estadísticas: " . $e->getMessage());
            return null;
        }
    }
    
    /**
     * Sincroniza inventario con perfiles de filamento
     * @return int Número de carretes creados
     */
    public function sincronizarConPerfiles() {
        try {
            // Obtener perfiles sin carrete en inventario
            $sql = "SELECT pf.id, pf.peso 
                    FROM perfiles_filamento pf
                    LEFT JOIN inventario_carretes ic ON pf.id = ic.perfil_id
                    WHERE ic.id IS NULL";
            
            $stmt = $this->query($sql, []);
            $perfilesSinCarrete = $stmt ? $stmt->fetchAll() : [];
            
            $nuevosCarretes = 0;
            
            foreach ($perfilesSinCarrete as $perfil) {
                $data = [
                    'perfilId' => $perfil['id'],
                    'pesoInicial' => $perfil['peso'] * 1000, // Convertir kg a gramos
                    'pesoUsado' => 0,
                    'estado' => 'activo'
                ];
                
                if ($this->create($data)) {
                    $nuevosCarretes++;
                }
            }
            
            return $nuevosCarretes;
            
        } catch (PDOException $e) {
            error_log("Error al sincronizar: " . $e->getMessage());
            return 0;
        }
    }
}

// ============================================
// CONTROLADOR DE LA API
// ============================================

$inventario = new InventarioCarretes();
$action = $_GET['action'] ?? '';

switch ($action) {
    
    case 'list':
        // Listar todos los carretes con detalles
        Utils::validateMethod('GET');
        $sql = "SELECT * FROM vista_inventario_detallado ORDER BY fecha_creacion DESC";
        $stmt = Database::getInstance()->getConnection()->query($sql);
        $data = $stmt->fetchAll();
        Utils::sendJsonResponse(true, $data);
        break;
        
    case 'get':
        // Obtener un carrete específico
        Utils::validateMethod('GET');
        $id = $_GET['id'] ?? '';
        
        if (empty($id)) {
            Utils::sendJsonResponse(false, null, 'ID requerido');
        }
        
        $data = $inventario->findById($id);
        
        if ($data) {
            Utils::sendJsonResponse(true, $data);
        } else {
            Utils::sendJsonResponse(false, null, 'Carrete no encontrado');
        }
        break;
        
    case 'create':
        // Crear nuevo carrete
        Utils::validateMethod('POST');
        $input = Utils::getRequestBody();
        
        // Validar campos requeridos
        $required = ['perfilId'];
        $validation = Utils::validateRequired($input, $required);
        
        if (!$validation['valid']) {
            Utils::sendJsonResponse(false, null, 'Campos requeridos faltantes: ' . implode(', ', $validation['missing']));
        }
        
        $result = $inventario->create($input);
        
        if ($result) {
            Utils::sendJsonResponse(true, $result, 'Carrete creado exitosamente');
        } else {
            Utils::sendJsonResponse(false, null, 'Error al crear carrete');
        }
        break;
        
    case 'update':
        // Actualizar carrete
        Utils::validateMethod('PUT');
        $input = Utils::getRequestBody();
        $id = $input['id'] ?? '';
        
        if (empty($id)) {
            Utils::sendJsonResponse(false, null, 'ID requerido');
        }
        
        $result = $inventario->update($id, $input);
        
        if ($result) {
            $data = $inventario->findById($id);
            Utils::sendJsonResponse(true, $data, 'Carrete actualizado exitosamente');
        } else {
            Utils::sendJsonResponse(false, null, 'Error al actualizar carrete');
        }
        break;
        
    case 'delete':
        // Eliminar carrete
        Utils::validateMethod('DELETE');
        $input = Utils::getRequestBody();
        $id = $input['id'] ?? $_GET['id'] ?? '';
        
        if (empty($id)) {
            Utils::sendJsonResponse(false, null, 'ID requerido');
        }
        
        $result = $inventario->delete($id);
        
        if ($result) {
            Utils::sendJsonResponse(true, null, 'Carrete eliminado exitosamente');
        } else {
            Utils::sendJsonResponse(false, null, 'Error al eliminar carrete');
        }
        break;
        
    case 'byPerfil':
        // Obtener carretes de un perfil específico
        Utils::validateMethod('GET');
        $perfilId = $_GET['perfilId'] ?? '';
        
        if (empty($perfilId)) {
            Utils::sendJsonResponse(false, null, 'ID de perfil requerido');
        }
        
        $data = $inventario->findByPerfil($perfilId);
        Utils::sendJsonResponse(true, $data);
        break;
        
    case 'disponibles':
        // Obtener carretes disponibles
        Utils::validateMethod('GET');
        $data = $inventario->findDisponibles();
        Utils::sendJsonResponse(true, $data);
        break;
        
    case 'bajoStock':
        // Obtener carretes con bajo stock
        Utils::validateMethod('GET');
        $data = $inventario->findBajoStock();
        Utils::sendJsonResponse(true, $data);
        break;
        
    case 'registrarUso':
        // Registrar uso de filamento
        Utils::validateMethod('POST');
        $input = Utils::getRequestBody();
        
        $required = ['carreteId', 'gramosUsados'];
        $validation = Utils::validateRequired($input, $required);
        
        if (!$validation['valid']) {
            Utils::sendJsonResponse(false, null, 'Campos requeridos faltantes: ' . implode(', ', $validation['missing']));
        }
        
        try {
            $result = $inventario->registrarUso(
                $input['carreteId'],
                $input['gramosUsados'],
                $input['nombreProyecto'] ?? ''
            );
            
            if ($result) {
                Utils::sendJsonResponse(true, $result, 'Uso registrado exitosamente');
            } else {
                Utils::sendJsonResponse(false, null, 'Error al registrar uso');
            }
        } catch (Exception $e) {
            error_log("Error al registrar uso: " . $e->getMessage());
            Utils::sendJsonResponse(false, null, 'Error al registrar uso: ' . $e->getMessage());
        }
        break;
        
    case 'estadisticas':
        // Obtener estadísticas del inventario
        Utils::validateMethod('GET');
        $data = $inventario->getEstadisticas();
        
        if ($data) {
            Utils::sendJsonResponse(true, $data);
        } else {
            Utils::sendJsonResponse(false, null, 'Error al obtener estadísticas');
        }
        break;
        
    case 'sincronizar':
        // Sincronizar inventario con perfiles
        Utils::validateMethod('POST');
        $nuevosCarretes = $inventario->sincronizarConPerfiles();
        Utils::sendJsonResponse(true, ['nuevosCarretes' => $nuevosCarretes], "Se crearon $nuevosCarretes carretes nuevos");
        break;
        
    default:
        Utils::sendJsonResponse(false, null, 'Acción no válida');
}