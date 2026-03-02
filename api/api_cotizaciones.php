<?php
// API_COTIZACIONES.PHP - VERSIÓN CORREGIDA CON MEJOR DEBUG
require_once 'api_postprocesado_functions.php';
error_reporting(E_ALL);
ini_set('display_errors', 0);
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

// Función para enviar error MEJORADA
function sendError($message, $details = null) {
    http_response_code(400);
    $response = [
        'success' => false,
        'error' => $message
    ];
    
    if ($details !== null) {
        $response['details'] = $details;
    }
    
    error_log("❌ ERROR API: " . $message);
    if ($details) {
        error_log("   Detalles: " . print_r($details, true));
    }
    
    echo json_encode($response);
    exit;
}

// ============================================
// HELPER: Realiza todos los cálculos de precio
// ============================================
function calcularPrecios($input, $db) {
    $costoCarrete = floatval($input['costoCarrete'] ?? 0);
    $pesoCarrete  = max(0.001, floatval($input['pesoCarrete'] ?? 1));

    // Cargar costos desde el perfil si existe
    if (!empty($input['perfilFilamentoId'])) {
        $stmt = $db->prepare("SELECT costo, peso FROM perfiles_filamento WHERE id = ?");
        $stmt->execute([$input['perfilFilamentoId']]);
        $perfil = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($perfil) {
            $costoCarrete = $perfil['costo'];
            $pesoCarrete  = $perfil['peso'];
        }
    }

    $pesoPieza      = floatval($input['pesoPieza'] ?? 0);
    $tiempoImpresion = floatval($input['tiempoImpresion'] ?? 0);
    $cantidadPiezas  = max(1, intval($input['cantidadPiezas'] ?? 1));
    $piezasPorLote   = max(1, intval($input['piezasPorLote'] ?? 1));
    $factorSeguridad = floatval($input['factorSeguridad'] ?? 1);
    $horasDiseno     = floatval($input['horasDiseno'] ?? 0);
    $costoHoraDiseno = floatval($input['costoHoraDiseno'] ?? 0);
    $usoElectricidad = floatval($input['usoElectricidad'] ?? 0);
    $gif             = floatval($input['gif'] ?? 0);
    $aiu             = floatval($input['aiu'] ?? 0);
    $margenMinorista = floatval($input['margenMinorista'] ?? 0);
    $margenMayorista = floatval($input['margenMayorista'] ?? 0);
    $incluirMarcaAgua    = intval($input['incluirMarcaAgua'] ?? 0);
    $porcentajeMarcaAgua = floatval($input['porcentajeMarcaAgua'] ?? 0);

    $tiempoHoras = $tiempoImpresion / 60;

    // ── Costos POR PIEZA ──────────────────────────────────────────────────
    // Filamento: costo por gramo × peso de la pieza
    $costoUnitario   = $costoCarrete / ($pesoCarrete * 1000); // COP/g
    $costoFabricacion = $factorSeguridad * $costoUnitario * $pesoPieza;

    // Energía: el lote completo consume la misma energía; se reparte entre
    // las piezas del lote.
    $costoEnergia = ($factorSeguridad * $usoElectricidad * $tiempoHoras) / $piezasPorLote;

    // Diseño: costo total dividido entre todas las piezas del pedido
    $costoDiseno = ($costoHoraDiseno * $horasDiseno) / $cantidadPiezas;

    // Depreciación: el lote usa la máquina durante tiempoHoras; se reparte
    // entre las piezas del lote.
    $depreciacionBatch = 0;
    $maquinaId = $input['maquina_id'] ?? null;
    if ($maquinaId) {
        $stmtMaq = $db->prepare("SELECT depreciacion_por_hora FROM maquinas WHERE id = ? AND activa = 1");
        $stmtMaq->execute([$maquinaId]);
        $maquina = $stmtMaq->fetch(PDO::FETCH_ASSOC);
        $depreciacionBatch = $maquina
            ? $tiempoHoras * floatval($maquina['depreciacion_por_hora'])
            : $tiempoHoras * 280;
    } else {
        // Genérico: depreciación basada en tiempo de uso
        $depreciacionBatch = (1400000 * 0.9 / (3 * 12 * 210)) * $tiempoHoras;
    }
    $depreciacionMaquina = $depreciacionBatch / $piezasPorLote;

    // ── Subtotal y gastos ─────────────────────────────────────────────────
    $subtotal    = $costoFabricacion + $costoEnergia + $costoDiseno + $depreciacionMaquina;
    $costoGIF    = $subtotal * ($gif / 100);
    $costoAIU    = ($subtotal + $costoGIF) * ($aiu / 100);
    $costoMarcaAgua = $incluirMarcaAgua
        ? ($subtotal + $costoGIF + $costoAIU) * ($porcentajeMarcaAgua / 100)
        : 0;

    // ── Postprocesado ─────────────────────────────────────────────────────
    $costosPost = calcularCostosPostprocesado(
        $input['costo_mano_obra_postprocesado'] ?? 0,
        $input['insumos_postprocesado'] ?? []
    );
    // alcance: 'por_pieza' → el costo ingresado es por cada pieza
    //          'todo_el_lote' → el costo ingresado cubre todo el pedido
    $alcance = $input['alcance_postprocesado'] ?? 'por_pieza';
    $costoPostPorPieza = ($alcance === 'todo_el_lote' && $cantidadPiezas > 1)
        ? $costosPost['costo_total'] / $cantidadPiezas
        : $costosPost['costo_total'];

    // ── Precio final por pieza ────────────────────────────────────────────
    $precioFinal     = $subtotal + $costoGIF + $costoAIU + $costoMarcaAgua + $costoPostPorPieza;
    $precioMinorista = $precioFinal * (1 + $margenMinorista / 100);
    $precioMayorista = $precioFinal * (1 + $margenMayorista / 100);

    // ── Totales del pedido ────────────────────────────────────────────────
    $numeroLotes        = (int) ceil($cantidadPiezas / $piezasPorLote);
    $costoTotalPedido   = $precioFinal * $cantidadPiezas;
    $tiempoTotalMinutos = $numeroLotes * $tiempoImpresion;
    $tiempoTotalHoras   = $tiempoTotalMinutos / 60;
    $filamentoTotalGramos = $pesoPieza * $cantidadPiezas; // CORREGIDO: gramos totales reales

    return [
        'costo_fabricacion'            => round($costoFabricacion, 2),
        'costo_energia'                => round($costoEnergia, 2),
        'costo_diseno'                 => round($costoDiseno, 2),
        'depreciacion_maquina'         => round($depreciacionMaquina, 2),
        'subtotal'                     => round($subtotal, 2),
        'costo_gif'                    => round($costoGIF, 2),
        'costo_aiu'                    => round($costoAIU, 2),
        'costo_marca_agua'             => round($costoMarcaAgua, 2),
        'precio_final'                 => round($precioFinal, 2),
        'precio_minorista'             => round($precioMinorista, 2),
        'precio_mayorista'             => round($precioMayorista, 2),
        'numero_lotes'                 => $numeroLotes,
        'costo_por_lote'               => round($precioFinal * $piezasPorLote, 2),
        'costo_total_pedido'           => round($costoTotalPedido, 2),
        'tiempo_total_minutos'         => round($tiempoTotalMinutos, 2),
        'tiempo_total_horas'           => round($tiempoTotalHoras, 2),
        'filamento_total_gramos'       => round($filamentoTotalGramos, 2),
        'costo_electrico_total'        => round($usoElectricidad * $tiempoTotalHoras, 2),
        'costo_total_pedido_minorista' => round($costoTotalPedido * (1 + $margenMinorista / 100), 2),
        'costo_total_pedido_mayorista' => round($costoTotalPedido * (1 + $margenMayorista / 100), 2),
        'costo_mano_obra_postprocesado' => $costosPost['costo_mano_obra'],
        'costo_insumos_postprocesado'   => $costosPost['costo_insumos'],
        'costo_total_postprocesado'     => round($costoPostPorPieza, 2),
        // Para el INSERT en calculos_cotizacion
        '_costoCarrete'    => $costoCarrete,
        '_pesoCarrete'     => $pesoCarrete,
        '_cantidadPiezas'  => $cantidadPiezas,
        '_piezasPorLote'   => $piezasPorLote,
        '_margenMinorista' => $margenMinorista,
        '_margenMayorista' => $margenMayorista,
    ];
}

try {
    require_once 'config.php';

    $db = Database::getInstance()->getConnection();
    $action = $_GET['action'] ?? $_POST['action'] ?? 'list';
    
    switch ($action) {
        case 'create':
            // Obtener datos del POST
            $rawInput = file_get_contents('php://input');
            error_log("📥 RAW INPUT RECIBIDO");
            
            $input = json_decode($rawInput, true);
            
            if (!$input) {
                $jsonError = json_last_error_msg();
                sendError('No se recibieron datos válidos', [
                    'json_error' => $jsonError,
                    'raw_input_length' => strlen($rawInput)
                ]);
            }
            
            error_log("📦 INPUT DECODIFICADO CORRECTAMENTE");
            
            // Debug logging MEJORADO
            error_log("=== CREAR COTIZACIÓN ===");
            error_log("Máquina ID recibida: " . ($input['maquina_id'] ?? 'NULL'));
            error_log("Nombre: " . ($input['nombrePieza'] ?? 'NULL'));
            error_log("Peso: " . ($input['pesoPieza'] ?? 'NULL') . 'g');
            error_log("Tiempo: " . ($input['tiempoImpresion'] ?? 'NULL') . ' min');
            
            // Validar campos requeridos
            $camposFaltantes = [];
            if (!isset($input['nombrePieza'])) $camposFaltantes[] = 'nombrePieza';
            if (!isset($input['pesoPieza'])) $camposFaltantes[] = 'pesoPieza';
            if (!isset($input['tiempoImpresion'])) $camposFaltantes[] = 'tiempoImpresion';
            
            if (!empty($camposFaltantes)) {
                sendError('Campos requeridos faltantes', [
                    'campos_faltantes' => $camposFaltantes,
                    'campos_recibidos' => array_keys($input)
                ]);
            }
            
            // Generar ID único
            $id = time() . '_' . substr(md5(rand()), 0, 9);
            error_log("🆔 ID generado: " . $id);
            
            // Iniciar transacción
            $db->beginTransaction();
            error_log("🔄 Transacción iniciada");
            
            try {
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
    incluir_paqueteria, suministro_paqueteria_id, unidades_por_paquete, 
    cantidad_paquetes_necesarios, costo_total_paqueteria,
    requiere_delivery, tipo_delivery, costo_delivery, 
    aplicar_recargo_delivery, porcentaje_recargo_delivery, costo_delivery_total,
    fecha, fecha_completa
) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), NOW()
)";
                
                $stmtCot = $db->prepare($sqlCot);
                
                $parametros = [
                    $id,
                    $input['nombrePieza'],
                    $input['perfilFilamentoId'] ?? null,
                    $input['carreteId'] ?? null,
                    $input['pesoPieza'],
                    $input['tiempoImpresion'],
                    $input['cantidadPiezas'] ?? 1,
                    $input['piezasPorLote'] ?? 1,
                    $input['costoCarrete'] ?? 0,
                    $input['pesoCarrete'] ?? 1,
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
                    $input['maquina_id'] ?? null,  // CORREGIDO: era 'maquinaId'
                    $input['incluir_postprocesado'] ?? 0,
                    $input['nivel_dificultad_postprocesado'] ?? null,
                    $input['costo_mano_obra_postprocesado'] ?? 0,
                    $input['incluir_paqueteria'] ?? 0,
                    $input['suministro_paqueteria_id'] ?? null,
                    $input['unidades_por_paquete'] ?? 1,
                    $input['cantidad_paquetes_necesarios'] ?? 0,
                    $input['costo_total_paqueteria'] ?? 0,
                    // NUEVOS: Delivery
                    $input['requiere_delivery'] ?? 0,
                    $input['tipo_delivery'] ?? null,
                    $input['costo_delivery'] ?? 0,
                    $input['aplicar_recargo_delivery'] ?? 0,
                    $input['porcentaje_recargo_delivery'] ?? 20,
                    $input['costo_delivery_total'] ?? 0
                ];
                
                $stmtCot->execute($parametros);
                error_log("✅ Cotización insertada en BD");
                
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
                        error_log("📋 Perfil filamento cargado: Costo={$costoCarrete}, Peso={$pesoCarrete}");
                    }
                }

                if (!empty($input['insumos_postprocesado'])) {
                    guardarInsumosPostprocesado($db, $id, $input['insumos_postprocesado']);
                    error_log("✅ Insumos de postprocesado guardados");
                }

                // Calcular precios usando la función helper
                $c = calcularPrecios($input, $db);
                error_log("💰 Cálculos completados — precio/pieza: " . $c['precio_final']);

                // Alias para el INSERT
                $costoFabricacion  = $c['costo_fabricacion'];
                $costoEnergia      = $c['costo_energia'];
                $costoDiseno       = $c['costo_diseno'];
                $depreciacionMaquina = $c['depreciacion_maquina'];
                $subtotal          = $c['subtotal'];
                $costoGIF          = $c['costo_gif'];
                $costoAIU          = $c['costo_aiu'];
                $costoMarcaAgua    = $c['costo_marca_agua'];
                $precioFinal       = $c['precio_final'];
                $precioMinorista   = $c['precio_minorista'];
                $precioMayorista   = $c['precio_mayorista'];
                $numeroLotes       = $c['numero_lotes'];
                $costoPorLote      = $c['costo_por_lote'];
                $costoTotalPedido  = $c['costo_total_pedido'];
                $tiempoTotalMinutos = $c['tiempo_total_minutos'];
                $tiempoTotalHoras  = $c['tiempo_total_horas'];
                $filamentoTotalGramos = $c['filamento_total_gramos'];
                $costoElectricoTotal  = $c['costo_electrico_total'];
                $costoTotalPedidoMinorista = $c['costo_total_pedido_minorista'];
                $costoTotalPedidoMayorista = $c['costo_total_pedido_mayorista'];
                $costosPostprocesado = [
                    'costo_mano_obra' => $c['costo_mano_obra_postprocesado'],
                    'costo_insumos'   => $c['costo_insumos_postprocesado'],
                    'costo_total'     => $c['costo_total_postprocesado'],
                ];
                
                // 3. INSERTAR CÁLCULOS
                $sqlCalc = "INSERT INTO calculos_cotizacion (
                    cotizacion_id, costo_fabricacion, costo_energia, costo_diseno,
                    depreciacion_maquina, subtotal, costo_gif, costo_aiu, costo_marca_agua,
                    precio_final, precio_minorista, precio_mayorista,
                    numero_lotes, costo_por_lote, costo_total_pedido,
                    tiempo_total_minutos, tiempo_total_horas, filamento_total_gramos,
                    costo_electrico_total, costo_total_pedido_minorista, costo_total_pedido_mayorista,
                    costo_mano_obra_postprocesado, costo_insumos_postprocesado, costo_total_postprocesado
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
                    $costosPostprocesado['costo_mano_obra'],
                    $costosPostprocesado['costo_insumos'],
                    $costosPostprocesado['costo_total']
                ]);
                
                error_log("✅ Cálculos insertados en BD");
                
                $db->commit();
                error_log("✅ Transacción confirmada (COMMIT)");
                
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
                    'filamento_total_gramos' => round($filamentoTotalGramos, 2),
                    'costo_mano_obra_postprocesado' => $costosPostprocesado['costo_mano_obra'],
                    'costo_insumos_postprocesado' => $costosPostprocesado['costo_insumos'],
                    'costo_total_postprocesado' => $costosPostprocesado['costo_total']
                ], 'Cotización creada exitosamente');
                
            } catch (PDOException $e) {
                $db->rollBack();
                error_log("❌ Error PDO: " . $e->getMessage());
                sendError('Error en la base de datos', [
                    'pdo_error' => $e->getMessage(),
                    'pdo_code' => $e->getCode()
                ]);
            }
            break;
            
        case 'calcular':
            // Calcula precios sin guardar en la base de datos
            $rawInput = file_get_contents('php://input');
            $input = json_decode($rawInput, true);
            if (!$input) sendError('No se recibieron datos válidos');

            if (!isset($input['pesoPieza']) || !isset($input['tiempoImpresion'])) {
                sendError('Campos requeridos: pesoPieza, tiempoImpresion');
            }

            $resultado = calcularPrecios($input, $db);

            // Quitar claves internas antes de enviar
            unset($resultado['_costoCarrete'], $resultado['_pesoCarrete'],
                  $resultado['_cantidadPiezas'], $resultado['_piezasPorLote'],
                  $resultado['_margenMinorista'], $resultado['_margenMayorista']);

            sendSuccess($resultado, 'Cálculo realizado');
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
    
    error_log("ERROR GENERAL en api_cotizaciones: " . $e->getMessage());
    error_log("Archivo: " . $e->getFile() . " Línea: " . $e->getLine());
    error_log("Stack trace: " . $e->getTraceAsString());
    
    sendError('Error del servidor', [
        'message' => $e->getMessage(),
        'file' => basename($e->getFile()),
        'line' => $e->getLine()
    ]);
}
?>