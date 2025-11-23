<?php
// API_COTIZACIONES.PHP - VERSIÓN CON DEBUGGING
// Muestra errores detallados para diagnóstico

// *** ACTIVAR ERRORES PARA DEBUGGING ***
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
ini_set('log_errors', 1);

// Log de inicio
error_log("=== API COTIZACIONES - INICIO ===");

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

try {
    error_log("Intentando cargar config.php");
    require_once 'config.php';
    error_log("config.php cargado exitosamente");
    
    $db = Database::getInstance()->getConnection();
    error_log("Conexión a BD establecida");
    
    $action = $_GET['action'] ?? $_POST['action'] ?? 'list';
    error_log("Action recibida: " . $action);
    
    switch ($action) {
        case 'create':
            error_log("=== CASO CREATE ===");
            
            // Obtener datos del POST
            $rawInput = file_get_contents('php://input');
            error_log("Raw input recibido: " . substr($rawInput, 0, 200));
            
            $input = json_decode($rawInput, true);
            
            if (!$input) {
                error_log("ERROR: No se pudo decodificar JSON");
                throw new Exception('No se recibieron datos válidos. JSON Error: ' . json_last_error_msg());
            }
            
            error_log("Datos decodificados correctamente. Keys: " . implode(', ', array_keys($input)));
            
            // Validar campos requeridos
            $required = ['nombrePieza', 'pesoPieza', 'tiempoImpresion'];
            foreach ($required as $field) {
                if (!isset($input[$field])) {
                    error_log("ERROR: Campo faltante - $field");
                    throw new Exception("Campo requerido faltante: $field");
                }
            }
            
            error_log("Validación de campos OK");
            
            // Generar ID único
            $id = time() . '_' . substr(md5(rand()), 0, 9);
            error_log("ID generado: $id");
            
            // Iniciar transacción
            $db->beginTransaction();
            error_log("Transacción iniciada");
            
            // 1. INSERTAR COTIZACIÓN
            error_log("=== INSERTANDO COTIZACIÓN ===");
            $sqlCot = "INSERT INTO cotizaciones (
                id, nombre_pieza, perfil_filamento_id, carrete_id,
                peso_pieza, tiempo_impresion, cantidad_piezas, piezas_por_lote,
                horas_diseno, costo_hora_diseno, factor_seguridad,
                uso_electricidad, gif, aiu, margen_minorista, margen_mayorista,
                incluir_marca_agua, porcentaje_marca_agua, fecha
            ) VALUES (
                :id, :nombre_pieza, :perfil_id, :carrete_id,
                :peso_pieza, :tiempo_impresion, :cantidad_piezas, :piezas_por_lote,
                :horas_diseno, :costo_hora_diseno, :factor_seguridad,
                :uso_electricidad, :gif, :aiu, :margen_minorista, :margen_mayorista,
                :incluir_marca_agua, :porcentaje_marca_agua, NOW()
            )";
            
            $stmtCot = $db->prepare($sqlCot);
            $stmtCot->execute([
                'id' => $id,
                'nombre_pieza' => $input['nombrePieza'],
                'perfil_id' => $input['perfilFilamentoId'] ?? null,
                'carrete_id' => $input['carreteId'] ?? null,
                'peso_pieza' => $input['pesoPieza'],
                'tiempo_impresion' => $input['tiempoImpresion'],
                'cantidad_piezas' => $input['cantidadPiezas'] ?? 1,
                'piezas_por_lote' => $input['piezasPorLote'] ?? 1,
                'horas_diseno' => $input['horasDiseno'] ?? 0,
                'costo_hora_diseno' => $input['costoHoraDiseno'] ?? 0,
                'factor_seguridad' => $input['factorSeguridad'] ?? 1,
                'uso_electricidad' => $input['usoElectricidad'] ?? 0,
                'gif' => $input['gif'] ?? 0,
                'aiu' => $input['aiu'] ?? 0,
                'margen_minorista' => $input['margenMinorista'] ?? 0,
                'margen_mayorista' => $input['margenMayorista'] ?? 0,
                'incluir_marca_agua' => $input['incluirMarcaAgua'] ?? 0,
                'porcentaje_marca_agua' => $input['porcentajeMarcaAgua'] ?? 0
            ]);
            
            error_log("Cotización insertada exitosamente");
            
            // 2. CALCULAR PRECIOS
            error_log("=== CALCULANDO PRECIOS ===");
            
            $costoCarrete = $input['costoCarrete'] ?? 0;
            $pesoCarrete = $input['pesoCarrete'] ?? 1;
            
            error_log("Costo carrete: $costoCarrete, Peso carrete: $pesoCarrete");
            
            // Obtener datos del perfil si existe
            if (!empty($input['perfilFilamentoId'])) {
                error_log("Buscando perfil: " . $input['perfilFilamentoId']);
                $stmtPerfil = $db->prepare("SELECT costo, peso FROM perfiles_filamento WHERE id = ?");
                $stmtPerfil->execute([$input['perfilFilamentoId']]);
                $perfil = $stmtPerfil->fetch(PDO::FETCH_ASSOC);
                
                if ($perfil) {
                    $costoCarrete = $perfil['costo'];
                    $pesoCarrete = $perfil['peso'] * 1000; // Convertir a gramos
                    error_log("Perfil encontrado. Costo: $costoCarrete, Peso: $pesoCarrete g");
                } else {
                    error_log("Perfil no encontrado, usando valores por defecto");
                }
            }
            
            // Cálculos
            $pesoPieza = $input['pesoPieza'];
            $tiempoImpresion = $input['tiempoImpresion'];
            $cantidadPiezas = $input['cantidadPiezas'] ?? 1;
            $piezasPorLote = $input['piezasPorLote'] ?? 1;
            $factorSeguridad = $input['factorSeguridad'] ?? 1;
            
            // Costo de fabricación
            $costoPorGramo = $pesoCarrete > 0 ? $costoCarrete / $pesoCarrete : 0;
            $costoFabricacion = $costoPorGramo * $pesoPieza * $factorSeguridad;
            error_log("Costo fabricación: $costoFabricacion");
            
            // Costo de energía
            $usoElectricidad = $input['usoElectricidad'] ?? 0;
            $tiempoHoras = $tiempoImpresion / 60;
            $costoEnergia = $usoElectricidad * $tiempoHoras;
            error_log("Costo energía: $costoEnergia");
            
            // Costo de diseño
            $horasDiseno = $input['horasDiseno'] ?? 0;
            $costoHoraDiseno = $input['costoHoraDiseno'] ?? 0;
            $costoDiseno = $horasDiseno * $costoHoraDiseno;
            error_log("Costo diseño: $costoDiseno");
            
            // Depreciación de máquina
            $config = [
                'costo_inicial' => 1400000,
                'valor_residual' => 0.1,
                'vida_util' => 3,
                'horas_mensuales' => 210
            ];
            
            // Buscar configuración en BD
            $stmtConfig = $db->query("SELECT clave, valor FROM configuracion WHERE clave LIKE 'depreciacion_%'");
            while ($row = $stmtConfig->fetch(PDO::FETCH_ASSOC)) {
                $key = str_replace('depreciacion_', '', $row['clave']);
                $config[$key] = floatval($row['valor']);
            }
            
            error_log("Config depreciación: " . json_encode($config));
            
            $depreciacionAnual = ($config['costo_inicial'] * (1 - $config['valor_residual'])) / $config['vida_util'];
            $depreciacionMensual = $depreciacionAnual / 12;
            $depreciacionPorHora = $depreciacionMensual / $config['horas_mensuales'];
            $depreciacionMaquina = $depreciacionPorHora * $tiempoHoras;
            error_log("Depreciación máquina: $depreciacionMaquina");
            
            // Subtotal
            $subtotal = $costoFabricacion + $costoEnergia + $costoDiseno + $depreciacionMaquina;
            error_log("Subtotal: $subtotal");
            
            // GIF y AIU
            $gif = $input['gif'] ?? 0;
            $aiu = $input['aiu'] ?? 0;
            $costoGIF = $subtotal * ($gif / 100);
            $costoAIU = ($subtotal + $costoGIF) * ($aiu / 100);
            error_log("GIF: $costoGIF, AIU: $costoAIU");
            
            // Marca de agua
            $incluirMarcaAgua = $input['incluirMarcaAgua'] ?? 0;
            $porcentajeMarcaAgua = $input['porcentajeMarcaAgua'] ?? 0;
            $costoMarcaAgua = $incluirMarcaAgua ? ($subtotal + $costoGIF + $costoAIU) * ($porcentajeMarcaAgua / 100) : 0;
            error_log("Marca agua: $costoMarcaAgua");
            
            // Precio final
            $precioFinal = $subtotal + $costoGIF + $costoAIU + $costoMarcaAgua;
            error_log("Precio final: $precioFinal");
            
            // Márgenes
            $margenMinorista = $input['margenMinorista'] ?? 0;
            $margenMayorista = $input['margenMayorista'] ?? 0;
            $precioMinorista = $precioFinal * (1 + $margenMinorista / 100);
            $precioMayorista = $precioFinal * (1 + $margenMayorista / 100);
            error_log("Minorista: $precioMinorista, Mayorista: $precioMayorista");
            
            // Totales del pedido
            $numeroLotes = ceil($cantidadPiezas / $piezasPorLote);
            $costoPorLote = $precioFinal;
            $costoTotalPedido = $precioFinal * $cantidadPiezas;
            $tiempoTotalMinutos = $tiempoImpresion * $cantidadPiezas;
            $tiempoTotalHoras = $tiempoTotalMinutos / 60;
            $filamentoTotalGramos = $pesoPieza * $cantidadPiezas;
            $costoElectricoTotal = $costoEnergia * $cantidadPiezas;
            $costoTotalPedidoMinorista = $precioMinorista * $cantidadPiezas;
            $costoTotalPedidoMayorista = $precioMayorista * $cantidadPiezas;
            
            error_log("Totales calculados OK");
            
            // 3. INSERTAR CÁLCULOS
            error_log("=== INSERTANDO CÁLCULOS ===");
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
            
            $stmtCalc = $db->prepare($sqlCalc);
            $stmtCalc->execute([
                'cotizacion_id' => $id,
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
                'tiempo_total_horas' => round($tiempoTotalHoras, 2),
                'filamento_total_gramos' => round($filamentoTotalGramos, 2),
                'costo_electrico_total' => round($costoElectricoTotal, 2),
                'costo_total_pedido_minorista' => round($costoTotalPedidoMinorista, 2),
                'costo_total_pedido_mayorista' => round($costoTotalPedidoMayorista, 2)
            ]);
            
            error_log("Cálculos insertados exitosamente");
            
            // Commit
            $db->commit();
            error_log("Transacción completada");
            
            // 4. DEVOLVER RESPUESTA
            error_log("=== PREPARANDO RESPUESTA ===");
            $response = [
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
            ];
            
            error_log("Respuesta preparada. Keys: " . implode(', ', array_keys($response)));
            
            echo json_encode([
                'success' => true,
                'data' => $response,
                'message' => 'Cotización creada exitosamente'
            ]);
            
            error_log("=== API COTIZACIONES - FIN EXITOSO ===");
            break;
            
        case 'list':
            error_log("=== CASO LIST ===");
            $sql = "SELECT c.*, cc.* 
                    FROM cotizaciones c
                    LEFT JOIN calculos_cotizacion cc ON c.id = cc.cotizacion_id
                    ORDER BY c.fecha DESC";
            $stmt = $db->query($sql);
            $cotizaciones = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            error_log("Cotizaciones encontradas: " . count($cotizaciones));
            
            echo json_encode([
                'success' => true,
                'data' => $cotizaciones,
                'message' => ''
            ]);
            break;
            
        case 'get':
            $id = $_GET['id'] ?? null;
            if (!$id) {
                throw new Exception('ID no proporcionado');
            }
            
            $sql = "SELECT c.*, cc.* 
                    FROM cotizaciones c
                    LEFT JOIN calculos_cotizacion cc ON c.id = cc.cotizacion_id
                    WHERE c.id = ?";
            $stmt = $db->prepare($sql);
            $stmt->execute([$id]);
            $cotizacion = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$cotizacion) {
                throw new Exception('Cotización no encontrada');
            }
            
            echo json_encode([
                'success' => true,
                'data' => $cotizacion,
                'message' => ''
            ]);
            break;
            
        case 'delete':
            $id = $_GET['id'] ?? $_POST['id'] ?? null;
            if (!$id) {
                throw new Exception('ID no proporcionado');
            }
            
            $db->beginTransaction();
            
            // Eliminar cálculos primero
            $sqlCalc = "DELETE FROM calculos_cotizacion WHERE cotizacion_id = ?";
            $stmtCalc = $db->prepare($sqlCalc);
            $stmtCalc->execute([$id]);
            
            // Eliminar cotización
            $sqlCot = "DELETE FROM cotizaciones WHERE id = ?";
            $stmtCot = $db->prepare($sqlCot);
            $stmtCot->execute([$id]);
            
            $db->commit();
            
            echo json_encode([
                'success' => true,
                'data' => ['deleted' => true],
                'message' => 'Cotización eliminada'
            ]);
            break;
            
        default:
            throw new Exception('Acción no válida: ' . $action);
    }
    
} catch (Exception $e) {
    error_log("=== ERROR CAPTURADO ===");
    error_log("Mensaje: " . $e->getMessage());
    error_log("Archivo: " . $e->getFile());
    error_log("Línea: " . $e->getLine());
    error_log("Stack trace: " . $e->getTraceAsString());
    
    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
        error_log("Transacción revertida");
    }
    
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ]);
}

error_log("=== API COTIZACIONES - FIN ===");
?>
