<?php
// API_COTIZACIONES.PHP - VERSIÓN CORREGIDA
// Este archivo corrige el problema de que los cálculos aparezcan en 0

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once 'config.php';

try {
    $db = Database::getInstance()->getConnection();
    $action = $_GET['action'] ?? $_POST['action'] ?? 'list';
    
    switch ($action) {
        case 'create':
            // Obtener datos del POST
            $input = json_decode(file_get_contents('php://input'), true);
            
            if (!$input) {
                throw new Exception('No se recibieron datos');
            }
            
            // Validar campos requeridos
            $required = ['nombrePieza', 'pesoPieza', 'tiempoImpresion'];
            foreach ($required as $field) {
                if (!isset($input[$field])) {
                    throw new Exception("Campo requerido faltante: $field");
                }
            }
            
            // Generar ID único
            $id = time() . '_' . substr(md5(rand()), 0, 9);
            
            // Iniciar transacción
            $db->beginTransaction();
            
            // 1. INSERTAR COTIZACIÓN
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
            
            // 2. CALCULAR PRECIOS (usando la misma lógica que antes)
            $costoCarrete = 0;
            $pesoCarrete = 1;
            
            // Obtener datos del perfil si existe
            if (!empty($input['perfilFilamentoId'])) {
                $stmtPerfil = $db->prepare("SELECT costo, peso FROM perfiles_filamento WHERE id = ?");
                $stmtPerfil->execute([$input['perfilFilamentoId']]);
                $perfil = $stmtPerfil->fetch(PDO::FETCH_ASSOC);
                
                if ($perfil) {
                    $costoCarrete = $perfil['costo'];
                    $pesoCarrete = $perfil['peso'] * 1000; // Convertir a gramos
                }
            } else {
                // Usar valores del input si no hay perfil
                $costoCarrete = $input['costoCarrete'] ?? 0;
                $pesoCarrete = $input['pesoCarrete'] ?? 1;
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
            
            // Costo de energía
            $usoElectricidad = $input['usoElectricidad'] ?? 0;
            $tiempoHoras = $tiempoImpresion / 60;
            $costoEnergia = $usoElectricidad * $tiempoHoras;
            
            // Costo de diseño
            $horasDiseno = $input['horasDiseno'] ?? 0;
            $costoHoraDiseno = $input['costoHoraDiseno'] ?? 0;
            $costoDiseno = $horasDiseno * $costoHoraDiseno;
            
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
            
            $depreciacionAnual = ($config['costo_inicial'] * (1 - $config['valor_residual'])) / $config['vida_util'];
            $depreciacionMensual = $depreciacionAnual / 12;
            $depreciacionPorHora = $depreciacionMensual / $config['horas_mensuales'];
            $depreciacionMaquina = $depreciacionPorHora * $tiempoHoras;
            
            // Subtotal
            $subtotal = $costoFabricacion + $costoEnergia + $costoDiseno + $depreciacionMaquina;
            
            // GIF y AIU
            $gif = $input['gif'] ?? 0;
            $aiu = $input['aiu'] ?? 0;
            $costoGIF = $subtotal * ($gif / 100);
            $costoAIU = ($subtotal + $costoGIF) * ($aiu / 100);
            
            // Marca de agua
            $incluirMarcaAgua = $input['incluirMarcaAgua'] ?? 0;
            $porcentajeMarcaAgua = $input['porcentajeMarcaAgua'] ?? 0;
            $costoMarcaAgua = $incluirMarcaAgua ? ($subtotal + $costoGIF + $costoAIU) * ($porcentajeMarcaAgua / 100) : 0;
            
            // Precio final
            $precioFinal = $subtotal + $costoGIF + $costoAIU + $costoMarcaAgua;
            
            // Márgenes
            $margenMinorista = $input['margenMinorista'] ?? 0;
            $margenMayorista = $input['margenMayorista'] ?? 0;
            $precioMinorista = $precioFinal * (1 + $margenMinorista / 100);
            $precioMayorista = $precioFinal * (1 + $margenMayorista / 100);
            
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
            
            // 3. INSERTAR CÁLCULOS
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
            
            // Commit
            $db->commit();
            
            // 4. *** AQUÍ ESTÁ LA CORRECCIÓN ***
            // DEVOLVER LOS DATOS COMPLETOS INCLUYENDO LOS CÁLCULOS
            $response = [
                'id' => $id,
                'nombre_pieza' => $input['nombrePieza'],
                'peso_pieza' => $pesoPieza,
                'tiempo_impresion' => $tiempoImpresion,
                'cantidad_piezas' => $cantidadPiezas,
                // *** DATOS DE CÁLCULOS ***
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
            
            Utils::sendSuccess($response, 'Cotización creada exitosamente');
            break;
            
        case 'list':
            $sql = "SELECT c.*, cc.* 
                    FROM cotizaciones c
                    LEFT JOIN calculos_cotizacion cc ON c.id = cc.cotizacion_id
                    ORDER BY c.fecha DESC";
            $stmt = $db->query($sql);
            $cotizaciones = $stmt->fetchAll(PDO::FETCH_ASSOC);
            Utils::sendSuccess($cotizaciones);
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
            
            Utils::sendSuccess($cotizacion);
            break;
            
        case 'delete':
            $id = $_GET['id'] ?? $_POST['id'] ?? null;
            if (!$id) {
                throw new Exception('ID no proporcionado');
            }
            
            $db->beginTransaction();
            
            // Eliminar cálculos primero (clave foránea)
            $sqlCalc = "DELETE FROM calculos_cotizacion WHERE cotizacion_id = ?";
            $stmtCalc = $db->prepare($sqlCalc);
            $stmtCalc->execute([$id]);
            
            // Eliminar cotización
            $sqlCot = "DELETE FROM cotizaciones WHERE id = ?";
            $stmtCot = $db->prepare($sqlCot);
            $stmtCot->execute([$id]);
            
            $db->commit();
            
            Utils::sendSuccess(['deleted' => true], 'Cotización eliminada');
            break;
            
        default:
            throw new Exception('Acción no válida');
    }
    
} catch (Exception $e) {
    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }
    Utils::sendError($e->getMessage());
}