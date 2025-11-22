<?php
/**
 * API - GestiÃ³n de Cotizaciones
 * Sistema de GestiÃ³n 3D
 */

require_once 'config.php';

class Cotizaciones extends BaseModel {
    
    public function __construct() {
        parent::__construct('cotizaciones');
    }
    
    /**
     * Crea una nueva cotizaciÃ³n con sus cÃ¡lculos
     * @param array $data
     * @return array|false
     */
    public function create($data) {
        try {
            $this->beginTransaction();
            
            $id = $this->generateId();
            
            // Insertar cotizaciÃ³n
            $sql = "INSERT INTO cotizaciones (
                id, nombre_pieza, perfil_filamento_id, carrete_id,
                peso_pieza, tiempo_impresion, cantidad_piezas, piezas_por_lote,
                costo_carrete, peso_carrete, horas_diseno, costo_hora_diseno,
                factor_seguridad, uso_electricidad, gif, aiu,
                incluir_marca_agua, porcentaje_marca_agua,
                margen_minorista, margen_mayorista, fecha, fecha_completa
            ) VALUES (
                :id, :nombre_pieza, :perfil_filamento_id, :carrete_id,
                :peso_pieza, :tiempo_impresion, :cantidad_piezas, :piezas_por_lote,
                :costo_carrete, :peso_carrete, :horas_diseno, :costo_hora_diseno,
                :factor_seguridad, :uso_electricidad, :gif, :aiu,
                :incluir_marca_agua, :porcentaje_marca_agua,
                :margen_minorista, :margen_mayorista, :fecha, NOW()
            )";
            
            $params = [
                'id' => $id,
                'nombre_pieza' => $data['nombrePieza'],
                'perfil_filamento_id' => $data['perfilFilamentoId'] ?? null,
                'carrete_id' => $data['carreteId'] ?? null,
                'peso_pieza' => $data['pesoPieza'],
                'tiempo_impresion' => $data['tiempoImpresion'],
                'cantidad_piezas' => $data['cantidadPiezas'] ?? 1,
                'piezas_por_lote' => $data['piezasPorLote'] ?? 1,
                'costo_carrete' => $data['costoCarrete'],
                'peso_carrete' => $data['pesoCarrete'],
                'horas_diseno' => $data['horasDiseno'] ?? 0,
                'costo_hora_diseno' => $data['costoHoraDiseno'],
                'factor_seguridad' => $data['factorSeguridad'],
                'uso_electricidad' => $data['usoElectricidad'],
                'gif' => $data['gif'],
                'aiu' => $data['aiu'],
                'incluir_marca_agua' => $data['incluirMarcaAgua'] ? 1 : 0,
                'porcentaje_marca_agua' => $data['porcentajeMarcaAgua'] ?? 0,
                'margen_minorista' => $data['margenMinorista'],
                'margen_mayorista' => $data['margenMayorista'],
                'fecha' => date('Y-m-d')
            ];
            
            $stmt = $this->query($sql, $params);
            
            if (!$stmt) {
                $this->rollback();
                return false;
            }
            
            // Calcular precios
            $calculos = $this->calcularPrecios($data);
            
            // Insertar cÃ¡lculos
            $sqlCalc = "INSERT INTO calculos_cotizacion (
                cotizacion_id, costo_fabricacion, costo_energia, costo_diseno,
                depreciacion_maquina, subtotal, costo_gif, costo_aiu, costo_marca_agua,
                precio_final, precio_minorista, precio_mayorista,
                numero_lotes, costo_por_lote, costo_total_pedido,
                tiempo_total_minutos, tiempo_total_horas, filamento_total_gramos,
                costo_electrico_total, costo_total_pedido_minorista, costo_total_pedido_mayorista
            ) VALUES (
                :cotizacion_id, :costo_fabricacion, :costo_energia, :costo_diseno,
                :depreciacion_maquina, :subtotal, :costo_gif, :costo_aiu, :costo_marca_agua,
                :precio_final, :precio_minorista, :precio_mayorista,
                :numero_lotes, :costo_por_lote, :costo_total_pedido,
                :tiempo_total_minutos, :tiempo_total_horas, :filamento_total_gramos,
                :costo_electrico_total, :costo_total_pedido_minorista, :costo_total_pedido_mayorista
            )";
            
            $paramsCalc = array_merge(['cotizacion_id' => $id], $calculos);
            $stmtCalc = $this->query($sqlCalc, $paramsCalc);
            
            if (!$stmtCalc) {
                $this->rollback();
                return false;
            }
            
            $this->commit();
            
            // Retornar cotizaciÃ³n completa
            return $this->findByIdCompleto($id);
            
        } catch (PDOException $e) {
            $this->rollback();
            error_log("Error al crear cotizaciÃ³n: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Calcula los precios de una cotizaciÃ³n
     * @param array $datos
     * @return array
     */
    private function calcularPrecios($datos) {
        // Convertir peso de kg a gramos para cálculos
        $pesoCarreteGramos = $datos['pesoCarrete'] * 1000;
        
        // Costo unitario del filamento (COP por gramo)
        $costoUnitario = $datos['costoCarrete'] / $pesoCarreteGramos;
        
        // 1. COSTO DE FABRICACIÓN (material)
        $costoFabricacion = $datos['factorSeguridad'] * $costoUnitario * $datos['pesoPieza'];
        
        // 2. COSTO DE ENERGÍA
        $tiempoEnHoras = $datos['tiempoImpresion'] / 60;
        $costoEnergia = $datos['factorSeguridad'] * $datos['usoElectricidad'] * $tiempoEnHoras;
        
        // 3. COSTO DE DISEÑO (distribuido entre todas las piezas)
        $cantidadPiezas = max(1, $datos['cantidadPiezas'] ?? 1);
        $horasDiseno = $datos['horasDiseno'] ?? 0;
        $costoDiseno = ($datos['costoHoraDiseno'] * $horasDiseno) / $cantidadPiezas;
        
        // 4. DEPRECIACIÓN DE MÁQUINA
        $costoInicial = 1400000; // COP
        $valorResidual = 0.1; // 10%
        $vidaUtil = 3; // años
        $horasMensuales = 210; // horas de trabajo por mes
        
        // Depreciación por hora
        $depreciacionPorHora = ($costoInicial * (1 - $valorResidual)) / 
                               ($vidaUtil * 12 * $horasMensuales);
        
        // Depreciación para esta pieza
        $depreciacionMaquina = $depreciacionPorHora * $tiempoEnHoras;
        
        // 5. SUBTOTAL (costos directos por pieza)
        $subtotal = $costoFabricacion + $costoEnergia + $costoDiseno + $depreciacionMaquina;
        
        // 6. GASTOS INDIRECTOS DE FABRICACIÓN (GIF)
        $costoGIF = $subtotal * ($datos['gif'] / 100);
        
        // 7. ADMINISTRACIÓN E IMPREVISTOS (AIU)
        $costoAIU = ($subtotal + $costoGIF) * ($datos['aiu'] / 100);
        
        // 8. MARCA DE AGUA (opcional)
        $incluirMarcaAgua = $datos['incluirMarcaAgua'] ?? false;
        $costoMarcaAgua = 0;
        if ($incluirMarcaAgua) {
            $porcentajeMarcaAgua = $datos['porcentajeMarcaAgua'] ?? 0;
            $costoMarcaAgua = ($subtotal + $costoGIF + $costoAIU) * ($porcentajeMarcaAgua / 100);
        }
        
        // 9. PRECIO FINAL POR PIEZA
        $piezasPorLote = max(1, $datos['piezasPorLote'] ?? 1);
        $costoTotalPorLote = $subtotal + $costoGIF + $costoAIU + $costoMarcaAgua;
        $precioFinal = $costoTotalPorLote / $piezasPorLote;
        
        // 10. PRECIOS POR CANAL
        $precioMinorista = $precioFinal * (1 + $datos['margenMinorista'] / 100);
        $precioMayorista = $precioFinal * (1 + $datos['margenMayorista'] / 100);
        
        // 11. CÁLCULOS DE LOTES Y TOTALES
        $numeroLotes = ceil($cantidadPiezas / $piezasPorLote);
        $costoPorLote = $costoTotalPorLote; // Costo de un lote completo
        $costoTotalPedido = $precioFinal * $cantidadPiezas;
        
        // 12. TIEMPOS TOTALES
        $tiempoTotalMinutos = $numeroLotes * $datos['tiempoImpresion'];
        $tiempoTotalHoras = round($tiempoTotalMinutos / 60, 1);
        
        // 13. TOTALES DE MATERIALES Y ENERGÍA
        $filamentoTotalGramos = $datos['pesoPieza'] * $cantidadPiezas;
        $costoElectricoTotal = $datos['usoElectricidad'] * $tiempoTotalHoras;
        
        // 14. COSTOS TOTALES POR CANAL
        $costoTotalPedidoMinorista = $precioMinorista * $cantidadPiezas;
        $costoTotalPedidoMayorista = $precioMayorista * $cantidadPiezas;
        
        return [
            'costo_fabricacion' => round($costoFabricacion, 2),
            'costo_energia' => round($costoEnergia, 2),
            'costo_diseno' => round($costoDiseno, 2),
            'depreciacion_maquina' => round($depreciacionMaquina, 2),
            'subtotal' => round($subtotal, 2),
            'costo_gif' => round($costoGIF, 2),
            'costo_aiu' => round($costoAIU, 2),
            'costo_marca_agua' => round($costoMarcaAgua, 2),
            'precio_final' => round($precioFinal, 2),
            'precio_minorista' => round($precioMinorista, 2),
            'precio_mayorista' => round($precioMayorista, 2),
            'numero_lotes' => $numeroLotes,
            'costo_por_lote' => round($costoPorLote, 2),
            'costo_total_pedido' => round($costoTotalPedido, 2),
            'tiempo_total_minutos' => round($tiempoTotalMinutos, 2),
            'tiempo_total_horas' => $tiempoTotalHoras,
            'filamento_total_gramos' => round($filamentoTotalGramos, 2),
            'costo_electrico_total' => round($costoElectricoTotal, 2),
            'costo_total_pedido_minorista' => round($costoTotalPedidoMinorista, 2),
            'costo_total_pedido_mayorista' => round($costoTotalPedidoMayorista, 2)
        ];
    }

    /**
     * Obtiene una cotizaciÃ³n completa con sus cÃ¡lculos
     * @param string $id
     * @return array|null
     */
    public function findByIdCompleto($id) {
        try {
            $sql = "SELECT * FROM vista_cotizaciones_completas WHERE id = :id";
            $stmt = $this->query($sql, ['id' => $id]);
            return $stmt ? $stmt->fetch() : null;
        } catch (PDOException $e) {
            error_log("Error en findByIdCompleto: " . $e->getMessage());
            return null;
        }
    }
    
    /**
     * Obtiene todas las cotizaciones con sus cÃ¡lculos
     * @return array
     */
    public function findAllCompleto() {
        try {
            $sql = "SELECT * FROM vista_cotizaciones_completas ORDER BY fecha_completa DESC";
            $stmt = $this->query($sql, []);
            return $stmt ? $stmt->fetchAll() : [];
        } catch (PDOException $e) {
            error_log("Error en findAllCompleto: " . $e->getMessage());
            return [];
        }
    }
    
    /**
     * Busca cotizaciones por nombre de pieza
     * @param string $nombre
     * @return array
     */
    public function findByNombre($nombre) {
        try {
            $sql = "SELECT * FROM vista_cotizaciones_completas 
                    WHERE nombre_pieza LIKE :nombre 
                    ORDER BY fecha_completa DESC";
            $stmt = $this->query($sql, ['nombre' => "%$nombre%"]);
            return $stmt ? $stmt->fetchAll() : [];
        } catch (PDOException $e) {
            error_log("Error en findByNombre: " . $e->getMessage());
            return [];
        }
    }
    
    /**
     * Obtiene cotizaciones por rango de fechas
     * @param string $fechaInicio
     * @param string $fechaFin
     * @return array
     */
    public function findByRangoFechas($fechaInicio, $fechaFin) {
        try {
            $sql = "SELECT * FROM vista_cotizaciones_completas 
                    WHERE fecha BETWEEN :fecha_inicio AND :fecha_fin 
                    ORDER BY fecha DESC";
            $stmt = $this->query($sql, [
                'fecha_inicio' => $fechaInicio,
                'fecha_fin' => $fechaFin
            ]);
            return $stmt ? $stmt->fetchAll() : [];
        } catch (PDOException $e) {
            error_log("Error en findByRangoFechas: " . $e->getMessage());
            return [];
        }
    }
}

// ============================================
// CONTROLADOR DE LA API
// ============================================

$cotizaciones = new Cotizaciones();
$action = $_GET['action'] ?? '';

switch ($action) {
    
    case 'list':
        // Listar todas las cotizaciones
        Utils::validateMethod('GET');
        $data = $cotizaciones->findAllCompleto();
        Utils::sendJsonResponse(true, $data);
        break;
        
    case 'get':
        // Obtener una cotizaciÃ³n especÃ­fica
        Utils::validateMethod('GET');
        $id = $_GET['id'] ?? '';
        
        if (empty($id)) {
            Utils::sendJsonResponse(false, null, 'ID requerido');
        }
        
        $data = $cotizaciones->findByIdCompleto($id);
        
        if ($data) {
            Utils::sendJsonResponse(true, $data);
        } else {
            Utils::sendJsonResponse(false, null, 'CotizaciÃ³n no encontrada');
        }
        break;
        
    case 'create':
        // Crear nueva cotizaciÃ³n
        Utils::validateMethod('POST');
        $input = Utils::getRequestBody();
        
        // Validar campos requeridos
        $required = [
            'nombrePieza', 'pesoPieza', 'tiempoImpresion', 
            'costoCarrete', 'pesoCarrete', 'costoHoraDiseno',
            'factorSeguridad', 'usoElectricidad', 'gif', 'aiu',
            'margenMinorista', 'margenMayorista'
        ];
        $validation = Utils::validateRequired($input, $required);
        
        if (!$validation['valid']) {
            Utils::sendJsonResponse(false, null, 'Campos requeridos faltantes: ' . implode(', ', $validation['missing']));
        }
        
        $result = $cotizaciones->create($input);
        
        if ($result) {
            Utils::sendJsonResponse(true, $result, 'CotizaciÃ³n creada exitosamente');
        } else {
            Utils::sendJsonResponse(false, null, 'Error al crear cotizaciÃ³n');
        }
        break;
        
    case 'delete':
        // Eliminar cotizaciÃ³n
        Utils::validateMethod('DELETE');
        $input = Utils::getRequestBody();
        $id = $input['id'] ?? $_GET['id'] ?? '';
        
        if (empty($id)) {
            Utils::sendJsonResponse(false, null, 'ID requerido');
        }
        
        $result = $cotizaciones->delete($id);
        
        if ($result) {
            Utils::sendJsonResponse(true, null, 'CotizaciÃ³n eliminada exitosamente');
        } else {
            Utils::sendJsonResponse(false, null, 'Error al eliminar cotizaciÃ³n');
        }
        break;
        
    case 'byNombre':
        // Buscar por nombre de pieza
        Utils::validateMethod('GET');
        $nombre = $_GET['nombre'] ?? '';
        
        if (empty($nombre)) {
            Utils::sendJsonResponse(false, null, 'Nombre de pieza requerido');
        }
        
        $data = $cotizaciones->findByNombre($nombre);
        Utils::sendJsonResponse(true, $data);
        break;
        
    case 'byFechas':
        // Buscar por rango de fechas
        Utils::validateMethod('GET');
        $fechaInicio = $_GET['fechaInicio'] ?? '';
        $fechaFin = $_GET['fechaFin'] ?? '';
        
        if (empty($fechaInicio) || empty($fechaFin)) {
            Utils::sendJsonResponse(false, null, 'Rango de fechas requerido');
        }
        
        $data = $cotizaciones->findByRangoFechas($fechaInicio, $fechaFin);
        Utils::sendJsonResponse(true, $data);
        break;
        
    default:
        Utils::sendJsonResponse(false, null, 'AcciÃ³n no vÃ¡lida');
}