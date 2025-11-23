<?php
// API_COTIZACIONES.PHP - VERSIÓN SIMPLIFICADA SIN UTILS
// No depende de Utils::sendSuccess, usa echo json_encode directamente
require_once 'api_postprocesado_functions.php';
error_reporting(E_ALL);
ini_set('display_errors', 0); // No mostrar errores en output, solo en log
ini_set('log_errors', 1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Función para enviar respuesta exitosa
function sendSuccess($data, $message = '') {
    echo json_encode([
        'success' => true,
        'data' => $data,
        'message' => $message
    ]);
    exit;
}

// Función para enviar error
function sendError($message) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $message
    ]);
    exit;
}

try {
    require_once 'config.php';
    
    $db = Database::getInstance()->getConnection();
    $action = $_GET['action'] ?? $_POST['action'] ?? 'list';
    
    switch ($action) {
        case 'create':
            // Obtener datos del POST
            $rawInput = file_get_contents('php://input');
            $input = json_decode($rawInput, true);
            
            if (!$input) {
                sendError('No se recibieron datos válidos');
            }
            
            // Validar campos requeridos
            if (!isset($input['nombrePieza']) || !isset($input['pesoPieza']) || !isset($input['tiempoImpresion'])) {
                sendError('Campos requeridos faltantes');
            }
            
            // Generar ID único
            $id = time() . '_' . substr(md5(rand()), 0, 9);
            
            // Iniciar transacción
            $db->beginTransaction();
            
            // 1. INSERTAR COTIZACIÓN
            $sqlCot = "INSERT INTO cotizaciones (
                id, nombre_pieza, perfil_filamento_id, carrete_id,
                peso_pieza, tiempo_impresion, cantidad_piezas, piezas_por_lote,
                costo_carrete, peso_carrete, horas_diseno, costo_hora_diseno,
                factor_seguridad, uso_electricidad, gif, aiu,
                incluir_marca_agua, porcentaje_marca_agua,
                margen_minorista, margen_mayorista,
                maquina_id,
                incluir_postprocesado, nivel_dificultad_postprocesado, costo_mano_obra_postprocesado,
                fecha, fecha_completa
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW()
            )";
            
            $stmtCot = $db->prepare($sqlCot);
            $stmtCot->execute([
                $id,
                $input['nombrePieza'],
                $input['perfilFilamentoId'] ?? null,
                $input['carreteId'] ?? null,
                $input['pesoPieza'],
                $input['tiempoImpresion'],
                $input['cantidadPiezas'] ?? 1,
                $input['piezasPorLote'] ?? 1,
                $input['costoCarrete'] ?? 0,  // FALTABA
                $input['pesoCarrete'] ?? 1,   // FALTABA
                $input['horasDiseno'] ?? 0,
                $input['costoHoraDiseno'] ?? 0,
                $input['factorSeguridad'] ?? 1,
                $input['usoElectricidad'] ?? 0,
                $input['gif'] ?? 0,
                $input['aiu'] ?? 0,
                $input['incluirMarcaAgua'] ?? 0,
                $input['porcentajeMarcaAgua'] ?? 0,
                $input['margenMinorista'] ?? 0,
                $input['margenMayorista'] ?? 0,
                $input['maquinaId'] ?? null,
                $input['incluir_postprocesado'] ?? 0,
                $input['nivel_dificultad_postprocesado'] ?? null,
                $input['costo_mano_obra_postprocesado'] ?? 0
            ]);
            
            // 2. CALCULAR PRECIOS
            $costoCarrete = $input['costoCarrete'] ?? 0;
            $pesoCarrete = $input['pesoCarrete'] ?? 1;
            


            // Obtener datos del perfil si existe
            if (!empty($input['perfilFilamentoId'])) {
                $stmtPerfil = $db->prepare("SELECT costo, peso FROM perfiles_filamento WHERE id = ?");
                $stmtPerfil->execute([$input['perfilFilamentoId']]);
                $perfil = $stmtPerfil->fetch(PDO::FETCH_ASSOC);
                
                if ($perfil) {
                    $costoCarrete = $perfil['costo'];
                    $pesoCarrete = $perfil['peso'];
                }
            }

            if (!empty($input['insumos_postprocesado'])) {
            guardarInsumosPostprocesado($db, $id, $input['insumos_postprocesado']);
}
            
            // Variables
            $pesoPieza = floatval($input['pesoPieza']);
            $tiempoImpresion = floatval($input['tiempoImpresion']);
            $cantidadPiezas = intval($input['cantidadPiezas'] ?? 1);
            $piezasPorLote = intval($input['piezasPorLote'] ?? 1);
            $factorSeguridad = floatval($input['factorSeguridad'] ?? 1);
            $horasDiseno = floatval($input['horasDiseno'] ?? 0);
            $costoHoraDiseno = floatval($input['costoHoraDiseno'] ?? 0);
            $usoElectricidad = floatval($input['usoElectricidad'] ?? 0);
            $gif = floatval($input['gif'] ?? 0);
            $aiu = floatval($input['aiu'] ?? 0);
            $margenMinorista = floatval($input['margenMinorista'] ?? 0);
            $margenMayorista = floatval($input['margenMayorista'] ?? 0);
            $incluirMarcaAgua = intval($input['incluirMarcaAgua'] ?? 0);
            $porcentajeMarcaAgua = floatval($input['porcentajeMarcaAgua'] ?? 0);
            
            // Cálculos
            $costoUnitario = $costoCarrete / ($pesoCarrete * 1000);
            $costoFabricacion = $factorSeguridad * $costoUnitario * $pesoPieza;
            
            $tiempoHoras = $tiempoImpresion / 60;
            $costoEnergia = $factorSeguridad * $usoElectricidad * $tiempoHoras;
            
            $costoDiseno = ($costoHoraDiseno * $horasDiseno) / $cantidadPiezas;
            
            $costosPostprocesado = calcularCostosPostprocesado(
            $input['costo_mano_obra_postprocesado'] ?? 0,
            $input['insumos_postprocesado'] ?? []
            );

            // Depreciación
            $depreciacionMaquina = (1400000 * 0.9 / (3 * 12 * 210)) * $pesoPieza;
            
            $subtotal = $costoFabricacion + $costoEnergia + $costoDiseno + $depreciacionMaquina;
            
            $costoGIF = $subtotal * ($gif / 100);
            $costoAIU = ($subtotal + $costoGIF) * ($aiu / 100);
            
            $costoMarcaAgua = $incluirMarcaAgua ? ($subtotal + $costoGIF + $costoAIU) * ($porcentajeMarcaAgua / 100) : 0;
            
            $costoTotalPostprocesado = $costosPostprocesado['costo_total'];

            $precioFinal = ($subtotal + $costoGIF + $costoAIU + $costoMarcaAgua + $costoTotalPostprocesado) / $piezasPorLote;
            
            $precioMinorista = $precioFinal * (1 + $margenMinorista / 100);
            $precioMayorista = $precioFinal * (1 + $margenMayorista / 100);
            
            $numeroLotes = ceil($cantidadPiezas / $piezasPorLote);
            $costoPorLote = $precioFinal * $piezasPorLote;
            $costoTotalPedido = $precioFinal * $cantidadPiezas;
            $tiempoTotalMinutos = $numeroLotes * $tiempoImpresion;
            $tiempoTotalHoras = $tiempoTotalMinutos / 60;
            
            $filamentoTotalGramos = ($pesoPieza / $piezasPorLote) * $cantidadPiezas;
            $costoElectricoTotal = $usoElectricidad * $tiempoTotalHoras;
            
            $costoTotalPedidoMinorista = $costoTotalPedido * (1 + $margenMinorista / 100);
            $costoTotalPedidoMayorista = $costoTotalPedido * (1 + $margenMayorista / 100);
            
            // 3. INSERTAR CÁLCULOS
            $sqlCalc = "INSERT INTO calculos_cotizacion (
                cotizacion_id, costo_fabricacion, costo_energia, costo_diseno,
    depreciacion_maquina, subtotal, costo_gif, costo_aiu, costo_marca_agua,
    precio_final, precio_minorista, precio_mayorista,
    numero_lotes, costo_por_lote, costo_total_pedido,
    tiempo_total_minutos, tiempo_total_horas, filamento_total_gramos,
    costo_electrico_total, costo_total_pedido_minorista, costo_total_pedido_mayorista,
    costo_mano_obra_postprocesado, costo_insumos_postprocesado, costo_total_postprocesado  // NUEVO
) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
)";
            
            $stmtCalc = $db->prepare($sqlCalc);
            $stmtCalc->execute([
                $id,
                round($costoFabricacion, 2),
                round($costoEnergia, 2),
                round($costoDiseno, 2),
                round($depreciacionMaquina, 2),
                round($subtotal, 2),
                round($costoGIF, 2),
                round($costoAIU, 2),
                round($costoMarcaAgua, 2),
                round($precioFinal, 2),
                round($precioMinorista, 2),
                round($precioMayorista, 2),
                $numeroLotes,
                round($costoPorLote, 2),
                round($costoTotalPedido, 2),
                round($tiempoTotalMinutos, 2),
                round($tiempoTotalHoras, 2),
                round($filamentoTotalGramos, 2),
                round($costoElectricoTotal, 2),
                round($costoTotalPedidoMinorista, 2),
                round($costoTotalPedidoMayorista, 2),
                $costosPostprocesado['costo_mano_obra'],      // NUEVO
    $costosPostprocesado['costo_insumos'],        // NUEVO
    $costosPostprocesado['costo_total']           // NUEVO
            ]);
            
            $db->commit();
            
            // Respuesta
            sendSuccess([
                'id' => $id,
                'nombre_pieza' => $input['nombrePieza'],
                'peso_pieza' => $pesoPieza,
                'tiempo_impresion' => $tiempoImpresion,
                'cantidad_piezas' => $cantidadPiezas,
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
                'tiempo_total_horas' => round($tiempoTotalHoras, 2),
                'filamento_total_gramos' => round($filamentoTotalGramos, 2)
            ], 'Cotización creada exitosamente');
            break;
            
        case 'list':
            $sql = "SELECT c.*, cc.* 
                    FROM cotizaciones c
                    LEFT JOIN calculos_cotizacion cc ON c.id = cc.cotizacion_id
                    ORDER BY c.fecha DESC";
            $stmt = $db->query($sql);
            $cotizaciones = $stmt->fetchAll(PDO::FETCH_ASSOC);
            sendSuccess($cotizaciones);
            break;
            
        case 'get':
            $id = $_GET['id'] ?? null;
            if (!$id) {
                sendError('ID no proporcionado');
            }
            
            $sql = "SELECT c.*, cc.* 
                    FROM cotizaciones c
                    LEFT JOIN calculos_cotizacion cc ON c.id = cc.cotizacion_id
                    WHERE c.id = ?";
            $stmt = $db->prepare($sql);
            $stmt->execute([$id]);
            $cotizacion = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$cotizacion) {
                sendError('Cotización no encontrada');
            }
            
            sendSuccess($cotizacion);
            break;
            
        case 'delete':
            $id = $_GET['id'] ?? $_POST['id'] ?? null;
            if (!$id) {
                sendError('ID no proporcionado');
            }
            
            $db->beginTransaction();
            
            $sqlCalc = "DELETE FROM calculos_cotizacion WHERE cotizacion_id = ?";
            $stmtCalc = $db->prepare($sqlCalc);
            $stmtCalc->execute([$id]);
            
            $sqlCot = "DELETE FROM cotizaciones WHERE id = ?";
            $stmtCot = $db->prepare($sqlCot);
            $stmtCot->execute([$id]);
            
            $db->commit();
            
            sendSuccess(['deleted' => true], 'Cotización eliminada');
            break;
            
        default:
            sendError('Acción no válida');
    }
    
} catch (Exception $e) {
    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }
    
    error_log("ERROR en api_cotizaciones: " . $e->getMessage());
    error_log("Archivo: " . $e->getFile() . " Línea: " . $e->getLine());
    
    sendError($e->getMessage());
}
?>