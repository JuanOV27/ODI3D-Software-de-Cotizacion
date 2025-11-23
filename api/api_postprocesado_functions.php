<?php
// ============================================
// EXTENSIÓN API COTIZACIONES - POSTPROCESADO
// ============================================
// Este archivo contiene las funciones para manejar el módulo de postprocesado
// Debe ser incluido en api_cotizaciones.php

/**
 * Guarda los insumos de postprocesado de una cotización
 * @param PDO $db Conexión a la base de datos
 * @param string $cotizacionId ID de la cotización
 * @param array $insumos Array de insumos del postprocesado
 * @return bool True si se guardó correctamente
 */
function guardarInsumosPostprocesado($db, $cotizacionId, $insumos) {
    try {
        // Primero eliminar insumos anteriores si existen
        $sqlDelete = "DELETE FROM postprocesado_insumos WHERE cotizacion_id = ?";
        $stmtDelete = $db->prepare($sqlDelete);
        $stmtDelete->execute([$cotizacionId]);
        
        if (empty($insumos)) {
            return true; // No hay insumos para guardar
        }
        
        // Preparar statement para inserción
        $sql = "INSERT INTO postprocesado_insumos (
            id, cotizacion_id, suministro_id, nombre_suministro,
            cantidad_requerida, porcentaje_uso, precio_unitario, costo_total_insumo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        
        $stmt = $db->prepare($sql);
        
        foreach ($insumos as $insumo) {
            $id = time() . '_' . bin2hex(random_bytes(5));
            
            $stmt->execute([
                $id,
                $cotizacionId,
                $insumo['suministro_id'],
                $insumo['nombre'],
                $insumo['cantidad_requerida'],
                $insumo['porcentaje_uso'] ?? null,
                $insumo['precio_unitario'],
                $insumo['costo_total']
            ]);
        }
        
        return true;
        
    } catch (PDOException $e) {
        error_log("Error al guardar insumos de postprocesado: " . $e->getMessage());
        return false;
    }
}

/**
 * Obtiene los insumos de postprocesado de una cotización
 * @param PDO $db Conexión a la base de datos
 * @param string $cotizacionId ID de la cotización
 * @return array Array de insumos
 */
function obtenerInsumosPostprocesado($db, $cotizacionId) {
    try {
        $sql = "SELECT * FROM postprocesado_insumos WHERE cotizacion_id = ? ORDER BY fecha_agregado";
        $stmt = $db->prepare($sql);
        $stmt->execute([$cotizacionId]);
        
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
        
    } catch (PDOException $e) {
        error_log("Error al obtener insumos de postprocesado: " . $e->getMessage());
        return [];
    }
}

/**
 * Calcula el costo total de postprocesado
 * @param float $costoManoObra Costo de mano de obra
 * @param array $insumos Array de insumos con sus costos
 * @return array Array con desglose de costos
 */
function calcularCostosPostprocesado($costoManoObra, $insumos) {
    $costoTotalInsumos = 0;
    
    foreach ($insumos as $insumo) {
        $costoTotalInsumos += $insumo['costo_total'];
    }
    
    return [
        'costo_mano_obra' => round($costoManoObra, 2),
        'costo_insumos' => round($costoTotalInsumos, 2),
        'costo_total' => round($costoManoObra + $costoTotalInsumos, 2)
    ];
}

/**
 * Actualiza el inventario de suministros después de usar insumos en postprocesado
 * @param PDO $db Conexión a la base de datos
 * @param array $insumos Array de insumos utilizados
 * @return bool True si se actualizó correctamente
 */
function descontarInsumosDeInventario($db, $insumos) {
    try {
        $sql = "UPDATE suministros 
                SET unidades = GREATEST(0, unidades - ?),
                    fecha_modificacion = NOW()
                WHERE id = ?";
        
        $stmt = $db->prepare($sql);
        
        foreach ($insumos as $insumo) {
            $cantidadADescontar = $insumo['cantidad_requerida'];
            
            // Si la cantidad es menor a 1, usar el porcentaje
            if ($cantidadADescontar < 1 && isset($insumo['porcentaje_uso'])) {
                $cantidadADescontar = $insumo['porcentaje_uso'] / 100;
            }
            
            $stmt->execute([
                $cantidadADescontar,
                $insumo['suministro_id']
            ]);
        }
        
        return true;
        
    } catch (PDOException $e) {
        error_log("Error al descontar insumos del inventario: " . $e->getMessage());
        return false;
    }
}

/**
 * Verifica la disponibilidad de insumos antes de crear la cotización
 * @param PDO $db Conexión a la base de datos
 * @param array $insumos Array de insumos requeridos
 * @return array Array con información de disponibilidad
 */
function verificarDisponibilidadInsumos($db, $insumos) {
    $faltantes = [];
    
    try {
        foreach ($insumos as $insumo) {
            $sql = "SELECT unidades FROM suministros WHERE id = ?";
            $stmt = $db->prepare($sql);
            $stmt->execute([$insumo['suministro_id']]);
            $resultado = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($resultado) {
                $disponible = $resultado['unidades'];
                $requerido = $insumo['cantidad_requerida'];
                
                if ($requerido > $disponible) {
                    $faltantes[] = [
                        'suministro_id' => $insumo['suministro_id'],
                        'nombre' => $insumo['nombre'],
                        'disponible' => $disponible,
                        'requerido' => $requerido,
                        'faltante' => $requerido - $disponible,
                        'costo_faltante' => ($requerido - $disponible) * $insumo['precio_unitario']
                    ];
                }
            }
        }
        
        return [
            'disponible' => empty($faltantes),
            'faltantes' => $faltantes
        ];
        
    } catch (PDOException $e) {
        error_log("Error al verificar disponibilidad: " . $e->getMessage());
        return [
            'disponible' => false,
            'faltantes' => [],
            'error' => $e->getMessage()
        ];
    }
}

/**
 * Formatea los datos de postprocesado para incluir en la respuesta de la cotización
 * @param PDO $db Conexión a la base de datos
 * @param string $cotizacionId ID de la cotización
 * @param array $datosCotizacion Datos de la cotización
 * @return array Datos formateados
 */
function formatearDatosPostprocesado($db, $cotizacionId, $datosCotizacion) {
    $insumos = obtenerInsumosPostprocesado($db, $cotizacionId);
    
    return [
        'incluir_postprocesado' => $datosCotizacion['incluir_postprocesado'] == 1,
        'nivel_dificultad' => $datosCotizacion['nivel_dificultad_postprocesado'],
        'costo_mano_obra' => round($datosCotizacion['costo_mano_obra_postprocesado'], 2),
        'insumos' => $insumos,
        'costo_total_insumos' => array_sum(array_column($insumos, 'costo_total_insumo')),
        'costo_total_postprocesado' => round(
            $datosCotizacion['costo_mano_obra_postprocesado'] + 
            array_sum(array_column($insumos, 'costo_total_insumo')),
            2
        )
    ];
}

/**
 * Genera el HTML para el panel de resultados (versión simple)
 * @param array $datosPostprocesado Datos del postprocesado
 * @return string HTML del panel
 */
function generarPanelPostprocesadoSimple($datosPostprocesado) {
    if (!$datosPostprocesado['incluir_postprocesado']) {
        return '';
    }
    
    $nivelLabels = [
        'facil' => 'Nivel 1 - Fácil',
        'intermedio' => 'Nivel 2 - Intermedio',
        'dificil' => 'Nivel 3 - Difícil'
    ];
    
    $nivelLabel = $nivelLabels[$datosPostprocesado['nivel_dificultad']] ?? 'Sin especificar';
    
    $html = '
    <div class="resultado-seccion" style="border-top: 2px solid #e5e7eb; padding-top: 15px; margin-top: 15px;">
        <h4 style="color: #4f46e5; margin-bottom: 10px;">🎨 Postprocesado</h4>
        <div style="display: grid; grid-template-columns: auto 1fr; gap: 8px; font-size: 0.9rem;">
            <span style="color: #6b7280;">Nivel:</span>
            <strong>' . htmlspecialchars($nivelLabel) . '</strong>
            
            <span style="color: #6b7280;">Mano de Obra:</span>
            <strong style="color: #059669;">' . number_format($datosPostprocesado['costo_mano_obra'], 0, ',', '.') . ' COP</strong>
            
            <span style="color: #6b7280;">Insumos:</span>
            <strong style="color: #059669;">' . number_format($datosPostprocesado['costo_total_insumos'], 0, ',', '.') . ' COP</strong>
            
            <span style="color: #1f2937; font-weight: 600;">Total Postprocesado:</span>
            <strong style="color: #4f46e5; font-size: 1.05rem;">' . number_format($datosPostprocesado['costo_total_postprocesado'], 0, ',', '.') . ' COP</strong>
        </div>
    </div>';
    
    return $html;
}

/**
 * Genera el HTML para el panel de resultados (versión avanzada/detallada)
 * @param array $datosPostprocesado Datos del postprocesado
 * @return string HTML del panel
 */
function generarPanelPostprocesadoAvanzado($datosPostprocesado) {
    if (!$datosPostprocesado['incluir_postprocesado']) {
        return '';
    }
    
    $nivelLabels = [
        'facil' => 'Nivel 1 - Fácil',
        'intermedio' => 'Nivel 2 - Intermedio',
        'dificil' => 'Nivel 3 - Difícil'
    ];
    
    $nivelLabel = $nivelLabels[$datosPostprocesado['nivel_dificultad']] ?? 'Sin especificar';
    
    $html = '
    <div class="costo-detalle" style="border-top: 2px solid #e5e7eb; padding-top: 15px; margin-top: 15px;">
        <h4 style="color: #4f46e5; margin-bottom: 12px; font-weight: 600;">🎨 Costos de Postprocesado</h4>
        
        <div style="margin-bottom: 12px; padding: 10px; background: #f3f4f6; border-radius: 6px;">
            <strong>Nivel de Dificultad:</strong> ' . htmlspecialchars($nivelLabel) . '
        </div>
        
        <div style="margin-bottom: 15px;">
            <div style="display: grid; grid-template-columns: auto 1fr; gap: 8px; font-size: 0.9rem;">
                <span style="color: #6b7280;">Mano de Obra:</span>
                <strong style="color: #059669;">' . number_format($datosPostprocesado['costo_mano_obra'], 0, ',', '.') . ' COP</strong>
            </div>
        </div>';
    
    // Desglose de insumos
    if (!empty($datosPostprocesado['insumos'])) {
        $html .= '
        <div style="margin-top: 15px;">
            <h5 style="color: #1f2937; margin-bottom: 8px; font-size: 0.95rem;">📦 Insumos Utilizados:</h5>
            <div style="background: #f9fafb; padding: 10px; border-radius: 6px; border: 1px solid #e5e7eb;">';
        
        foreach ($datosPostprocesado['insumos'] as $insumo) {
            $cantidad = $insumo['cantidad_requerida'];
            $porcentaje = isset($insumo['porcentaje_uso']) && $cantidad < 1 ? 
                ' (' . $insumo['porcentaje_uso'] . '%)' : '';
            
            $html .= '
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 0.85rem;">
                    <span style="color: #4b5563;">
                        ' . htmlspecialchars($insumo['nombre_suministro']) . ' 
                        <span style="color: #9ca3af;">x ' . $cantidad . $porcentaje . '</span>
                    </span>
                    <strong style="color: #059669;">' . number_format($insumo['costo_total_insumo'], 0, ',', '.') . ' COP</strong>
                </div>';
        }
        
        $html .= '
            </div>
        </div>';
    }
    
    // Total
    $html .= '
        <div style="margin-top: 15px; padding-top: 12px; border-top: 2px solid #d1d5db;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <strong style="color: #1f2937; font-size: 1rem;">Total Postprocesado:</strong>
                <strong style="color: #4f46e5; font-size: 1.15rem;">' . 
                    number_format($datosPostprocesado['costo_total_postprocesado'], 0, ',', '.') . ' COP</strong>
            </div>
        </div>
    </div>';
    
    return $html;
}

// ============================================
// FUNCIONES AUXILIARES
// ============================================

/**
 * Valida los datos de postprocesado antes de guardar
 * @param array $datos Datos del postprocesado
 * @return array Array con 'valido' (bool) y 'errores' (array)
 */
function validarDatosPostprocesado($datos) {
    $errores = [];
    
    if ($datos['incluir_postprocesado']) {
        // Validar nivel de dificultad
        $nivelesValidos = ['facil', 'intermedio', 'dificil'];
        if (!in_array($datos['nivel_dificultad_postprocesado'], $nivelesValidos)) {
            $errores[] = 'Nivel de dificultad de postprocesado inválido';
        }
        
        // Validar costo de mano de obra
        if ($datos['costo_mano_obra_postprocesado'] < 0) {
            $errores[] = 'El costo de mano de obra no puede ser negativo';
        }
        
        // Validar insumos
        if (isset($datos['insumos_postprocesado']) && is_array($datos['insumos_postprocesado'])) {
            foreach ($datos['insumos_postprocesado'] as $index => $insumo) {
                if (empty($insumo['suministro_id'])) {
                    $errores[] = "Insumo #{$index}: ID de suministro requerido";
                }
                if (!isset($insumo['cantidad_requerida']) || $insumo['cantidad_requerida'] <= 0) {
                    $errores[] = "Insumo #{$index}: Cantidad requerida inválida";
                }
                if (!isset($insumo['precio_unitario']) || $insumo['precio_unitario'] < 0) {
                    $errores[] = "Insumo #{$index}: Precio unitario inválido";
                }
            }
        }
    }
    
    return [
        'valido' => empty($errores),
        'errores' => $errores
    ];
}

?>
