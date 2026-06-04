<?php
// ============================================
// TEST_COTIZACION_OFFLINE.PHP — Verifica la lógica matemática sin BD
// Reimplementa calcularPrecios() con los mismos algoritmos pero sin consultas SQL,
// usando los valores de depreciación directamente del input.
// Ejecutar con: php api/test_cotizacion_offline.php
// ============================================

// ── Reimplementación standalone de calcularPrecios ──────────────────────────
function calcularPreciosOffline(array $input): array {
    $costoCarrete    = floatval($input['costoCarrete'] ?? 0);
    $pesoCarrete     = max(0.001, floatval($input['pesoCarrete'] ?? 1));
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

    $costoUnitario    = $costoCarrete / ($pesoCarrete * 1000);
    $costoFabricacion = $factorSeguridad * $costoUnitario * $pesoPieza;
    $costoEnergia     = ($factorSeguridad * $usoElectricidad * $tiempoHoras) / $piezasPorLote;
    $costoDiseno      = ($costoHoraDiseno * $horasDiseno) / $cantidadPiezas;

    // Depreciación — modo múltiple (usando depreciacion del input como fallback)
    $depreciacionBatch = 0;
    $maquinaId = $input['maquina_id'] ?? null;
    $maquinasMultiples = $input['maquinas_multiples'] ?? null;

    if ($maquinaId) {
        $depreciacionBatch = floatval($input['_depreciacion_unica'] ?? 0) * $tiempoHoras;
    } elseif (!empty($maquinasMultiples)) {
        $distribucion = is_string($maquinasMultiples)
            ? json_decode($maquinasMultiples, true)
            : $maquinasMultiples;

        if (is_array($distribucion) && count($distribucion) > 0) {
            $totalPiezasDistrib = array_sum(array_column($distribucion, 'piezas'));
            if ($totalPiezasDistrib > 0) {
                $depPonderada = 0;
                foreach ($distribucion as $d) {
                    $piezasD  = intval($d['piezas'] ?? 0);
                    $depHoraD = floatval($d['depreciacion'] ?? 0);
                    $depPonderada += $depHoraD * ($piezasD / $totalPiezasDistrib);
                }
                $depreciacionBatch = $depPonderada * $tiempoHoras;
            }
        }
    }
    $depreciacionMaquina = $depreciacionBatch / $piezasPorLote;

    $subtotal       = $costoFabricacion + $costoEnergia + $costoDiseno + $depreciacionMaquina;
    $costoGIF       = $subtotal * ($gif / 100);
    $costoAIU       = ($subtotal + $costoGIF) * ($aiu / 100);
    $costoMarcaAgua = $incluirMarcaAgua
        ? ($subtotal + $costoGIF + $costoAIU) * ($porcentajeMarcaAgua / 100) : 0;

    $manoObra  = floatval($input['costo_mano_obra_postprocesado'] ?? 0);
    $alcance   = $input['alcance_postprocesado'] ?? 'por_pieza';
    $costoPost = ($alcance === 'todo_el_lote' && $cantidadPiezas > 1)
        ? $manoObra / $cantidadPiezas : $manoObra;
    $mostrablePost = ($alcance === 'todo_el_lote' && $cantidadPiezas > 1)
        ? round($manoObra / $cantidadPiezas, 2) : round($manoObra, 2);

    $precioFinal     = $subtotal + $costoGIF + $costoAIU + $costoMarcaAgua + $costoPost;
    $precioMinorista = $precioFinal * (1 + $margenMinorista / 100);
    $precioMayorista = $precioFinal * (1 + $margenMayorista / 100);

    $numeroLotes        = (int) ceil($cantidadPiezas / $piezasPorLote);
    $costoTotalPedido   = $precioFinal * $cantidadPiezas;
    $tiempoTotalMinutos = $numeroLotes * $tiempoImpresion;
    $tiempoTotalHoras   = $tiempoTotalMinutos / 60;
    $filamentoTotal     = $pesoPieza * $cantidadPiezas;
    $costoElectrico     = $factorSeguridad * $usoElectricidad * $tiempoTotalHoras;

    return [
        'costo_fabricacion'           => round($costoFabricacion, 2),
        'costo_energia'               => round($costoEnergia, 2),
        'costo_diseno'                => round($costoDiseno, 2),
        'depreciacion_maquina'        => round($depreciacionMaquina, 2),
        'subtotal'                    => round($subtotal, 2),
        'costo_gif'                   => round($costoGIF, 2),
        'costo_aiu'                   => round($costoAIU, 2),
        'precio_final'                => round($precioFinal, 2),
        'precio_minorista'            => round($precioMinorista, 2),
        'precio_mayorista'            => round($precioMayorista, 2),
        'costo_total_pedido'          => round($costoTotalPedido, 2),
        'numero_lotes'                => $numeroLotes,
        'tiempo_total_horas'          => round($tiempoTotalHoras, 2),
        'filamento_total_gramos'      => round($filamentoTotal, 2),
        'costo_electrico_total'       => round($costoElectrico, 2),
        'costo_mano_obra_postprocesado' => $mostrablePost,
        'costo_total_postprocesado'   => round($costoPost, 2),
    ];
}

// ── Input de prueba ─────────────────────────────────────────────────────────
$input = [
    'pesoPieza'              => 80,
    'tiempoImpresion'        => 180,
    'costoCarrete'           => 120000,
    'pesoCarrete'            => 1,
    'cantidadPiezas'         => 5,
    'piezasPorLote'          => 2,
    'factorSeguridad'        => 1.2,
    'usoElectricidad'        => 600,
    'horasDiseno'            => 2,
    'costoHoraDiseno'        => 25000,
    'gif'                    => 15,
    'aiu'                    => 25,
    'margenMinorista'        => 30,
    'margenMayorista'        => 20,
    'incluirMarcaAgua'       => 0,
    'porcentajeMarcaAgua'    => 0,
    'maquina_id'             => null,
    'maquinas_multiples'     => [
        ['maquinaId' => 'A', 'piezas' => 3, 'depreciacion' => 500],
        ['maquinaId' => 'B', 'piezas' => 2, 'depreciacion' => 800],
    ],
    'costo_mano_obra_postprocesado' => 20000,
    'insumos_postprocesado'         => [],
    'alcance_postprocesado'         => 'todo_el_lote',
];

// ── Valores esperados ───────────────────────────────────────────────────────
$th      = 180 / 60;
$E = [
    'costo_fabricacion'             => round(1.2 * (120000/1000) * 80, 2),          // 11520
    'costo_energia'                 => round((1.2 * 600 * $th) / 2, 2),             // 1080
    'costo_diseno'                  => round((25000 * 2) / 5, 2),                   // 10000
    'depreciacion_maquina'          => round(((500*3+800*2)/5 * $th) / 2, 2),       // 930
    'subtotal'                      => 23530.0,
    'costo_gif'                     => round(23530 * 0.15, 2),                      // 3529.5
    'costo_aiu'                     => round((23530 + 23530*0.15) * 0.25, 2),       // 6764.88
    'precio_final'                  => round(23530 + 23530*0.15 + (23530+23530*0.15)*0.25 + 4000, 2),
    'precio_minorista'              => null, // se calcula de precio_final
    'costo_total_pedido'            => null,
    'numero_lotes'                  => 3,
    'tiempo_total_horas'            => round((3 * 180) / 60, 2),                    // 9
    'filamento_total_gramos'        => 400.0,
    'costo_electrico_total'         => round(1.2 * 600 * 9, 2),                     // 6480
    'costo_mano_obra_postprocesado' => round(20000 / 5, 2),                         // 4000 por pieza
    'costo_total_postprocesado'     => round(20000 / 5, 2),                         // 4000
];
$E['precio_minorista']   = round($E['precio_final'] * 1.30, 2);
$E['precio_mayorista']   = round($E['precio_final'] * 1.20, 2);
$E['costo_total_pedido'] = round($E['precio_final'] * 5, 2);

// ── Ejecutar ─────────────────────────────────────────────────────────────────
$R    = calcularPreciosOffline($input);
$pass = 0;
$fail = 0;

function check(string $k, float $esp, float $obt, float $tol = 1.0): void {
    global $pass, $fail;
    $diff = abs($esp - $obt);
    if ($diff <= $tol) {
        printf("✅ PASS  %-42s esp=%-12.2f  obt=%-12.2f\n", $k, $esp, $obt);
        $pass++;
    } else {
        printf("❌ FAIL  %-42s esp=%-12.2f  obt=%-12.2f  diff=%.2f\n", $k, $esp, $obt, $diff);
        $fail++;
    }
}

echo "=======================================================\n";
echo "  TEST OFFLINE — Motor de Cálculo de Cotización\n";
echo "=======================================================\n\n";

check('costo_fabricacion',             $E['costo_fabricacion'],             $R['costo_fabricacion']);
check('costo_energia',                 $E['costo_energia'],                 $R['costo_energia']);
check('costo_diseno',                  $E['costo_diseno'],                  $R['costo_diseno']);
check('depreciacion_maquina',          $E['depreciacion_maquina'],          $R['depreciacion_maquina']);
check('subtotal',                      $E['subtotal'],                      $R['subtotal']);
check('costo_gif',                     $E['costo_gif'],                     $R['costo_gif']);
check('costo_aiu',                     $E['costo_aiu'],                     $R['costo_aiu']);
check('precio_final',                  $E['precio_final'],                  $R['precio_final']);
check('precio_minorista (+30%)',        $E['precio_minorista'],              $R['precio_minorista']);
check('precio_mayorista (+20%)',        $E['precio_mayorista'],              $R['precio_mayorista']);
check('costo_total_pedido (×5)',        $E['costo_total_pedido'],            $R['costo_total_pedido']);
check('numero_lotes',                  $E['numero_lotes'],                  $R['numero_lotes'],     0);
check('tiempo_total_horas',            $E['tiempo_total_horas'],            $R['tiempo_total_horas']);
check('filamento_total_gramos',        $E['filamento_total_gramos'],        $R['filamento_total_gramos'], 0);
check('costo_electrico_total (×fs)',   $E['costo_electrico_total'],         $R['costo_electrico_total']);
check('mano_obra_postprocesado/pieza', $E['costo_mano_obra_postprocesado'], $R['costo_mano_obra_postprocesado']);
check('costo_total_postprocesado',     $E['costo_total_postprocesado'],     $R['costo_total_postprocesado']);

echo "\n=======================================================\n";
printf("  RESULTADO: %d PASS  /  %d FAIL\n", $pass, $fail);
echo "=======================================================\n";
if ($fail > 0) exit(1);
