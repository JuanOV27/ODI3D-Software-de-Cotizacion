<?php
// TEST_API.PHP - Script de diagnóstico

// Habilitar errores para debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);

echo "<h1>🔍 Diagnóstico de API</h1>";
echo "<hr>";

// Test 1: Verificar que PHP funciona
echo "<h2>✅ Test 1: PHP Funciona</h2>";
echo "PHP Version: " . phpversion() . "<br>";
echo "<hr>";

// Test 2: Verificar que config.php se puede cargar
echo "<h2>Test 2: Cargando config.php</h2>";
try {
    require_once 'config.php';
    echo "✅ config.php cargado correctamente<br>";
} catch (Exception $e) {
    echo "❌ Error al cargar config.php: " . $e->getMessage() . "<br>";
    exit;
}
echo "<hr>";

// Test 3: Verificar conexión a base de datos
echo "<h2>Test 3: Conexión a Base de Datos</h2>";
try {
    $db = Database::getInstance()->getConnection();
    echo "✅ Conexión a base de datos exitosa<br>";
    
    // Probar una consulta simple
    $stmt = $db->query("SELECT COUNT(*) as total FROM cotizaciones");
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    echo "✅ Total de cotizaciones en BD: " . $result['total'] . "<br>";
    
} catch (Exception $e) {
    echo "❌ Error de conexión: " . $e->getMessage() . "<br>";
}
echo "<hr>";

// Test 4: Simular creación de cotización
echo "<h2>Test 4: Simulación de Creación de Cotización</h2>";
try {
    // Datos de prueba mínimos
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
        'horasDiseno' => 0,
        'costoHoraDiseno' => 0,
        'costoCarrete' => 120000,
        'pesoCarrete' => 1000
    ];
    
    echo "📦 Datos de prueba preparados<br>";
    
    // Generar ID
    $id = time() . '_test';
    echo "🆔 ID generado: $id<br>";
    
    // Calcular costo de fabricación
    $costoPorGramo = $testData['costoCarrete'] / $testData['pesoCarrete'];
    $costoFabricacion = $costoPorGramo * $testData['pesoPieza'] * $testData['factorSeguridad'];
    
    echo "💰 Costo de fabricación calculado: $" . number_format($costoFabricacion, 2) . "<br>";
    
    // Calcular costo de energía
    $tiempoHoras = $testData['tiempoImpresion'] / 60;
    $costoEnergia = $testData['usoElectricidad'] * $tiempoHoras;
    
    echo "⚡ Costo de energía calculado: $" . number_format($costoEnergia, 2) . "<br>";
    
    echo "✅ Cálculos básicos funcionan correctamente<br>";
    
} catch (Exception $e) {
    echo "❌ Error en simulación: " . $e->getMessage() . "<br>";
}
echo "<hr>";

// Test 5: Verificar estructura de tablas
echo "<h2>Test 5: Verificar Estructura de Tablas</h2>";
try {
    $db = Database::getInstance()->getConnection();
    
    // Verificar tabla cotizaciones
    $stmt = $db->query("DESCRIBE cotizaciones");
    $columns = $stmt->fetchAll(PDO::FETCH_COLUMN);
    echo "✅ Tabla 'cotizaciones' existe con " . count($columns) . " columnas<br>";
    
    // Verificar tabla calculos_cotizacion
    $stmt = $db->query("DESCRIBE calculos_cotizacion");
    $columns = $stmt->fetchAll(PDO::FETCH_COLUMN);
    echo "✅ Tabla 'calculos_cotizacion' existe con " . count($columns) . " columnas<br>";
    
    // Verificar tabla configuracion
    $stmt = $db->query("SELECT COUNT(*) as total FROM configuracion");
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    echo "✅ Tabla 'configuracion' tiene " . $result['total'] . " registros<br>";
    
} catch (Exception $e) {
    echo "❌ Error al verificar tablas: " . $e->getMessage() . "<br>";
}

echo "<hr>";
echo "<h2>🏁 Diagnóstico Completo</h2>";
echo "<p>Si todos los tests anteriores pasaron ✅, entonces el problema está en el archivo api_cotizaciones.php</p>";
?>
