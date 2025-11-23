<?php
// TEST_CREATE.PHP - Probar creación de cotización paso a paso

error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: text/html; charset=utf-8');

echo "<h1>🧪 Test de Creación de Cotización</h1><hr>";

// Paso 1: Cargar config
echo "<h2>Paso 1: Cargar config.php</h2>";
try {
    require_once 'config.php';
    echo "✅ config.php cargado<br>";
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "<br>";
    exit;
}

// Paso 2: Conectar a BD
echo "<h2>Paso 2: Conectar a Base de Datos</h2>";
try {
    $db = Database::getInstance()->getConnection();
    echo "✅ Conexión establecida<br>";
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "<br>";
    exit;
}

// Paso 3: Datos de prueba
echo "<h2>Paso 3: Preparar Datos de Prueba</h2>";
$testData = [
    'nombrePieza' => 'Test Pieza',
    'pesoPieza' => 50,
    'tiempoImpresion' => 120,
    'cantidadPiezas' => 1,
    'piezasPorLote' => 1,
    'factorSeguridad' => 1.1,
    'usoElectricidad' => 600,
    'gif' => 15,
    'aiu' => 25,
    'margenMinorista' => 30,
    'margenMayorista' => 20,
    'horasDiseno' => 2,
    'costoHoraDiseno' => 25000,
    'costoCarrete' => 80000,
    'pesoCarrete' => 1
];
echo "✅ Datos preparados<br>";
echo "<pre>" . print_r($testData, true) . "</pre>";

// Paso 4: Generar ID
echo "<h2>Paso 4: Generar ID</h2>";
$id = time() . '_test';
echo "✅ ID: $id<br>";

// Paso 5: Insertar Cotización
echo "<h2>Paso 5: Insertar en tabla cotizaciones</h2>";
try {
    $db->beginTransaction();
    
    $sql = "INSERT INTO cotizaciones (
        id, nombre_pieza, peso_pieza, tiempo_impresion, 
        cantidad_piezas, piezas_por_lote, horas_diseno, costo_hora_diseno,
        factor_seguridad, uso_electricidad, gif, aiu, 
        margen_minorista, margen_mayorista, fecha
    ) VALUES (
        :id, :nombre_pieza, :peso_pieza, :tiempo_impresion,
        :cantidad_piezas, :piezas_por_lote, :horas_diseno, :costo_hora_diseno,
        :factor_seguridad, :uso_electricidad, :gif, :aiu,
        :margen_minorista, :margen_mayorista, NOW()
    )";
    
    $stmt = $db->prepare($sql);
    $result = $stmt->execute([
        'id' => $id,
        'nombre_pieza' => $testData['nombrePieza'],
        'peso_pieza' => $testData['pesoPieza'],
        'tiempo_impresion' => $testData['tiempoImpresion'],
        'cantidad_piezas' => $testData['cantidadPiezas'],
        'piezas_por_lote' => $testData['piezasPorLote'],
        'horas_diseno' => $testData['horasDiseno'],
        'costo_hora_diseno' => $testData['costoHoraDiseno'],
        'factor_seguridad' => $testData['factorSeguridad'],
        'uso_electricidad' => $testData['usoElectricidad'],
        'gif' => $testData['gif'],
        'aiu' => $testData['aiu'],
        'margen_minorista' => $testData['margenMinorista'],
        'margen_mayorista' => $testData['margenMayorista']
    ]);
    
    echo "✅ Cotización insertada<br>";
    
} catch (Exception $e) {
    echo "❌ Error al insertar cotización: " . $e->getMessage() . "<br>";
    echo "SQL State: " . $e->getCode() . "<br>";
    $db->rollBack();
    exit;
}

// Paso 6: Calcular valores
echo "<h2>Paso 6: Calcular Valores</h2>";

$pesoPieza = $testData['pesoPieza'];
$costoCarrete = $testData['costoCarrete'];
$pesoCarrete = $testData['pesoCarrete'];

// Costo unitario
$costoUnitario = $costoCarrete / ($pesoCarrete * 1000);
echo "Costo unitario: $costoUnitario COP/gramo<br>";

// Costo fabricación
$costoFabricacion = $testData['factorSeguridad'] * $costoUnitario * $pesoPieza;
echo "Costo fabricación: " . round($costoFabricacion, 2) . "<br>";

// Costo energía
$tiempoHoras = $testData['tiempoImpresion'] / 60;
$costoEnergia = $testData['factorSeguridad'] * $testData['usoElectricidad'] * $tiempoHoras;
echo "Costo energía: " . round($costoEnergia, 2) . "<br>";

// Costo diseño
$costoDiseno = ($testData['costoHoraDiseno'] * $testData['horasDiseno']) / $testData['cantidadPiezas'];
echo "Costo diseño: " . round($costoDiseno, 2) . "<br>";

// Depreciación
$depreciacionMaquina = (1400000 * 0.9 / (3 * 12 * 210)) * $pesoPieza;
echo "Depreciación: " . round($depreciacionMaquina, 2) . "<br>";

// Subtotal
$subtotal = $costoFabricacion + $costoEnergia + $costoDiseno + $depreciacionMaquina;
echo "Subtotal: " . round($subtotal, 2) . "<br>";

// GIF y AIU
$costoGIF = $subtotal * ($testData['gif'] / 100);
$costoAIU = ($subtotal + $costoGIF) * ($testData['aiu'] / 100);
echo "GIF: " . round($costoGIF, 2) . "<br>";
echo "AIU: " . round($costoAIU, 2) . "<br>";

// Precio final
$precioFinal = ($subtotal + $costoGIF + $costoAIU) / $testData['piezasPorLote'];
echo "Precio final: " . round($precioFinal, 2) . "<br>";

// Paso 7: Insertar cálculos
echo "<h2>Paso 7: Insertar en tabla calculos_cotizacion</h2>";
try {
    $sql = "INSERT INTO calculos_cotizacion (
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
    
    $stmt = $db->prepare($sql);
    
    $precioMinorista = $precioFinal * (1 + $testData['margenMinorista'] / 100);
    $precioMayorista = $precioFinal * (1 + $testData['margenMayorista'] / 100);
    
    $stmt->execute([
        'cotizacion_id' => $id,
        'costo_fabricacion' => round($costoFabricacion, 2),
        'costo_energia' => round($costoEnergia, 2),
        'costo_diseno' => round($costoDiseno, 2),
        'depreciacion_maquina' => round($depreciacionMaquina, 2),
        'subtotal' => round($subtotal, 2),
        'costo_gif' => round($costoGIF, 2),
        'costo_aiu' => round($costoAIU, 2),
        'costo_marca_agua' => 0,
        'precio_final' => round($precioFinal, 2),
        'precio_minorista' => round($precioMinorista, 2),
        'precio_mayorista' => round($precioMayorista, 2),
        'numero_lotes' => 1,
        'costo_por_lote' => round($precioFinal, 2),
        'costo_total_pedido' => round($precioFinal, 2),
        'tiempo_total_minutos' => $testData['tiempoImpresion'],
        'tiempo_total_horas' => $tiempoHoras,
        'filamento_total_gramos' => $pesoPieza,
        'costo_electrico_total' => round($costoEnergia, 2),
        'costo_total_pedido_minorista' => round($precioMinorista, 2),
        'costo_total_pedido_mayorista' => round($precioMayorista, 2)
    ]);
    
    echo "✅ Cálculos insertados<br>";
    
    $db->commit();
    echo "✅ Transacción completada<br>";
    
} catch (Exception $e) {
    echo "❌ Error al insertar cálculos: " . $e->getMessage() . "<br>";
    echo "SQL State: " . $e->getCode() . "<br>";
    $db->rollBack();
    exit;
}

echo "<hr><h2>✅ PRUEBA COMPLETADA EXITOSAMENTE</h2>";
echo "<p>ID de cotización creada: <strong>$id</strong></p>";
echo "<p>Puedes verificarla en phpMyAdmin o hacer un SELECT</p>";
?>
