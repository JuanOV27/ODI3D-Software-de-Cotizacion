<?php
// ============================================
// TEST_COTIZACION.PHP — Prueba automatizada del motor de cálculo
// Inyecta datos controlados y verifica que cada resultado sea matemáticamente correcto.
// Ejecutar en XAMPP: http://localhost/gestion3d/api/test_cotizacion.php
// ============================================
header('Content-Type: text/plain; charset=utf-8');
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/cotizacion_calculos.php';

$db = Database::getInstance()->getConnection();

// ──────────────────────────────────────────────────────────────────────────────
// DATOS DE ENTRADA CONTROLADOS
// Dos máquinas ficticias insertadas temporalmente para no depender de la BD real.
// ──────────────────────────────────────────────────────────────────────────────

// Insertar máquinas temporales de prueba
$idMaqA = 'TEST_MAQ_A_' . time();
$idMaqB = 'TEST_MAQ_B_' . time();

$db->exec("INSERT INTO maquinas (id, nombre, tipo, depreciacion_por_hora, activa)
           VALUES ('$idMaqA', 'Maquina Test A', 'FDM', 500, 1)");
$db->exec("INSERT INTO maquinas (id, nombre, tipo, depreciacion_por_hora, activa)
           VALUES ('$idMaqB', 'Maquina Test B', 'FDM', 800, 1)");

$input = [
    'pesoPieza'              => 80,
    'tiempoImpresion'        => 180,   // minutos
    'costoCarrete'           => 120000,
    'pesoCarrete'            => 1,     // kg
    'cantidadPiezas'         => 5,
    'piezasPorLote'          => 2,
    'factorSeguridad'        => 1.2,
    'usoElectricidad'        => 600,   // COP/h
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
        ['maquinaId' => $idMaqA, 'piezas' => 3, 'depreciacion' => 500],
        ['maquinaId' => $idMaqB, 'piezas' => 2, 'depreciacion' => 800],
    ],
    'costo_mano_obra_postprocesado' => 20000,
    'insumos_postprocesado'         => [],
    'alcance_postprocesado'         => 'todo_el_lote',
    'incluir_postprocesado'         => 1,
];

// ──────────────────────────────────────────────────────────────────────────────
// VALORES ESPERADOS (calculados manualmente)
// ──────────────────────────────────────────────────────────────────────────────
$tiempoHoras       = 180 / 60;               // 3 h
$costoUnitario     = 120000 / (1 * 1000);    // 120 COP/g
$costoFab          = 1.2 * $costoUnitario * 80;                  // 11520
$costoEnergia      = (1.2 * 600 * $tiempoHoras) / 2;            // 1080
$costoDiseno       = (25000 * 2) / 5;                            // 10000
$depPonderada      = (500 * 3 + 800 * 2) / 5;                   // 620 COP/h
$depMaquina        = ($depPonderada * $tiempoHoras) / 2;         // 930
$subtotal          = $costoFab + $costoEnergia + $costoDiseno + $depMaquina; // 23530
$costoGIF          = $subtotal * 0.15;                           // 3529.5
$costoAIU          = ($subtotal + $costoGIF) * 0.25;             // 6764.875
$costoPostPorPieza = 20000 / 5;                                  // 4000
$precioFinal       = $subtotal + $costoGIF + $costoAIU + $costoPostPorPieza; // 37824.375
$precioMinorista   = $precioFinal * 1.30;
$precioMayorista   = $precioFinal * 1.20;
$costoTotalPedido  = $precioFinal * 5;
$numeroLotes       = ceil(5 / 2);  // 3 lotes
$tiempoTotalHoras  = ($numeroLotes * 180) / 60; // 9 h
$filamentoTotal    = 80 * 5;       // 400 g
$costoElectrico    = 1.2 * 600 * $tiempoTotalHoras;              // 6480
$monoObraPorPieza  = 20000 / 5;                                  // 4000

// ──────────────────────────────────────────────────────────────────────────────
// EJECUTAR EL CÁLCULO
// ──────────────────────────────────────────────────────────────────────────────
$resultado = calcularPrecios($input, $db);

// ──────────────────────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────────────────────
$pass = 0;
$fail = 0;

function assert_eq(string $nombre, float $esperado, float $obtenido, float $tolerancia = 1.0): void {
    global $pass, $fail;
    $diff = abs($esperado - $obtenido);
    if ($diff <= $tolerancia) {
        echo "✅ PASS  $nombre\n       esperado=" . round($esperado, 2) . "  obtenido=" . round($obtenido, 2) . "\n";
        $pass++;
    } else {
        echo "❌ FAIL  $nombre\n       esperado=" . round($esperado, 2) . "  obtenido=" . round($obtenido, 2) . "  diferencia=$diff\n";
        $fail++;
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// ASSERTIONS
// ──────────────────────────────────────────────────────────────────────────────
echo "=======================================================\n";
echo "  TEST: Motor de Cálculo — Cotización\n";
echo "=======================================================\n\n";

assert_eq('costo_fabricacion',          $costoFab,          $resultado['costo_fabricacion']);
assert_eq('costo_energia',              $costoEnergia,      $resultado['costo_energia']);
assert_eq('costo_diseno',               $costoDiseno,       $resultado['costo_diseno']);
assert_eq('depreciacion_maquina',       $depMaquina,        $resultado['depreciacion_maquina']);
assert_eq('subtotal',                   $subtotal,          $resultado['subtotal']);
assert_eq('costo_gif',                  $costoGIF,          $resultado['costo_gif']);
assert_eq('costo_aiu',                  $costoAIU,          $resultado['costo_aiu']);
assert_eq('precio_final',               $precioFinal,       $resultado['precio_final']);
assert_eq('precio_minorista',           $precioMinorista,   $resultado['precio_minorista']);
assert_eq('precio_mayorista',           $precioMayorista,   $resultado['precio_mayorista']);
assert_eq('costo_total_pedido',         $costoTotalPedido,  $resultado['costo_total_pedido']);
assert_eq('numero_lotes',               $numeroLotes,       $resultado['numero_lotes'],        0);
assert_eq('tiempo_total_horas',         $tiempoTotalHoras,  $resultado['tiempo_total_horas']);
assert_eq('filamento_total_gramos',     $filamentoTotal,    $resultado['filamento_total_gramos'], 0);
assert_eq('costo_electrico_total',      $costoElectrico,    $resultado['costo_electrico_total']);
assert_eq('costo_mano_obra_postprocesado (por pieza)', $monoObraPorPieza, $resultado['costo_mano_obra_postprocesado']);
assert_eq('costo_total_postprocesado (por pieza)', $costoPostPorPieza, $resultado['costo_total_postprocesado']);

echo "\n=======================================================\n";
echo "  RESULTADO: $pass PASS  /  $fail FAIL\n";
echo "=======================================================\n";

// ──────────────────────────────────────────────────────────────────────────────
// LIMPIEZA — eliminar máquinas temporales
// ──────────────────────────────────────────────────────────────────────────────
$db->exec("DELETE FROM maquinas WHERE id IN ('$idMaqA', '$idMaqB')");
