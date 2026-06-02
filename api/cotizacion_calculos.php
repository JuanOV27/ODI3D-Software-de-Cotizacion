<?php
// ============================================
// COTIZACION_CALCULOS.PHP — Función central de cálculo de precios
// Incluida tanto por api_cotizaciones.php como por test_cotizacion.php
// ============================================
require_once __DIR__ . '/api_postprocesado_functions.php';

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

    $pesoPieza       = floatval($input['pesoPieza'] ?? 0);
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
    $costoUnitario    = $costoCarrete / ($pesoCarrete * 1000); // COP/g
    $costoFabricacion = $factorSeguridad * $costoUnitario * $pesoPieza;

    // Energía: el lote completo consume la misma energía; se reparte entre las piezas del lote
    $costoEnergia = ($factorSeguridad * $usoElectricidad * $tiempoHoras) / $piezasPorLote;

    // Diseño: costo total dividido entre todas las piezas del pedido
    $costoDiseno = ($costoHoraDiseno * $horasDiseno) / $cantidadPiezas;

    // Depreciación: el lote usa la(s) máquina(s) durante tiempoHoras; se reparte entre las piezas del lote
    $depreciacionBatch = 0;
    $maquinaId         = $input['maquina_id'] ?? null;
    $maquinasMultiples = $input['maquinas_multiples'] ?? null;

    if ($maquinaId) {
        // Modo máquina única — obtener tasa desde la BD
        $stmtMaq = $db->prepare("SELECT depreciacion_por_hora FROM maquinas WHERE id = ? AND activa = 1");
        $stmtMaq->execute([$maquinaId]);
        $maquina = $stmtMaq->fetch(PDO::FETCH_ASSOC);
        $depreciacionBatch = $maquina
            ? $tiempoHoras * floatval($maquina['depreciacion_por_hora'])
            : $tiempoHoras * 280;
    } elseif (!empty($maquinasMultiples)) {
        // Modo múltiples máquinas — calcular depreciación promedio ponderada por piezas
        $distribucion = is_string($maquinasMultiples)
            ? json_decode($maquinasMultiples, true)
            : $maquinasMultiples;

        if (is_array($distribucion) && count($distribucion) > 0) {
            $totalPiezasDistrib = array_sum(array_column($distribucion, 'piezas'));
            if ($totalPiezasDistrib > 0) {
                $depPonderada = 0;
                foreach ($distribucion as $d) {
                    $piezasD = intval($d['piezas'] ?? 0);
                    $maqIdD  = $d['maquinaId'] ?? null;
                    if ($piezasD <= 0 || !$maqIdD) continue;

                    // Obtener depreciación real desde la BD; si no hay registro, usar el valor enviado por el cliente
                    $stmtD = $db->prepare("SELECT depreciacion_por_hora FROM maquinas WHERE id = ? AND activa = 1");
                    $stmtD->execute([$maqIdD]);
                    $maqD     = $stmtD->fetch(PDO::FETCH_ASSOC);
                    $depHoraD = $maqD ? floatval($maqD['depreciacion_por_hora']) : floatval($d['depreciacion'] ?? 0);

                    $depPonderada += $depHoraD * ($piezasD / $totalPiezasDistrib);
                }
                $depreciacionBatch = $depPonderada * $tiempoHoras;
            }
        }

        if ($depreciacionBatch <= 0) {
            $depreciacionBatch = (1400000 * 0.9 / (3 * 12 * 210)) * $tiempoHoras;
        }
    } else {
        // Sin máquina especificada — genérico
        $depreciacionBatch = (1400000 * 0.9 / (3 * 12 * 210)) * $tiempoHoras;
    }
    $depreciacionMaquina = $depreciacionBatch / $piezasPorLote;

    // ── Subtotal y gastos ─────────────────────────────────────────────────
    $subtotal       = $costoFabricacion + $costoEnergia + $costoDiseno + $depreciacionMaquina;
    $costoGIF       = $subtotal * ($gif / 100);
    $costoAIU       = ($subtotal + $costoGIF) * ($aiu / 100);
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
    $numeroLotes          = (int) ceil($cantidadPiezas / $piezasPorLote);
    $costoTotalPedido     = $precioFinal * $cantidadPiezas;
    $tiempoTotalMinutos   = $numeroLotes * $tiempoImpresion;
    $tiempoTotalHoras     = $tiempoTotalMinutos / 60;
    $filamentoTotalGramos = $pesoPieza * $cantidadPiezas;

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
        'costo_electrico_total'        => round($factorSeguridad * $usoElectricidad * $tiempoTotalHoras, 2),
        'costo_total_pedido_minorista' => round($costoTotalPedido * (1 + $margenMinorista / 100), 2),
        'costo_total_pedido_mayorista' => round($costoTotalPedido * (1 + $margenMayorista / 100), 2),
        // Cuando el alcance es todo_el_lote, se devuelven los valores ya divididos
        // para que el desglose de la UI coincida con el precio por pieza calculado.
        'costo_mano_obra_postprocesado' => ($alcance === 'todo_el_lote' && $cantidadPiezas > 1)
            ? round($costosPost['costo_mano_obra'] / $cantidadPiezas, 2)
            : round($costosPost['costo_mano_obra'], 2),
        'costo_insumos_postprocesado'   => ($alcance === 'todo_el_lote' && $cantidadPiezas > 1)
            ? round($costosPost['costo_insumos'] / $cantidadPiezas, 2)
            : round($costosPost['costo_insumos'], 2),
        'costo_total_postprocesado'     => round($costoPostPorPieza, 2),
        'alcance_postprocesado'         => $alcance,
        // Para el INSERT en calculos_cotizacion
        '_costoCarrete'    => $costoCarrete,
        '_pesoCarrete'     => $pesoCarrete,
        '_cantidadPiezas'  => $cantidadPiezas,
        '_piezasPorLote'   => $piezasPorLote,
        '_margenMinorista' => $margenMinorista,
        '_margenMayorista' => $margenMayorista,
    ];
}
