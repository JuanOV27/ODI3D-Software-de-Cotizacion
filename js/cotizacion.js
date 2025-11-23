// ============================================
// COTIZACION.JS - IntegraciÃ³n con API MySQL
// ============================================

// Variables locales
let ultimoCalculo = null;

// ============================================
// FUNCIÃ“N PRINCIPAL - DISPONIBLE GLOBALMENTE
// ============================================


function validarSeleccionMaquina() {
    if (EstadoMaquinasCotizacion.modoActual === 'unica') {
        if (!EstadoMaquinasCotizacion.maquinaSeleccionada) {
            mostrarNotificacion('Debes seleccionar una máquina', 'warning');
            return false;
        }
    } else {
        const distribucionesValidas = EstadoMaquinasCotizacion.distribucionMaquinas.filter(
            d => d.maquinaId && d.piezas > 0
        );
        
        if (distribucionesValidas.length === 0) {
            mostrarNotificacion('Debes distribuir las piezas entre las máquinas', 'warning');
            return false;
        }
        
        const totalDistribuido = distribucionesValidas.reduce((sum, d) => sum + d.piezas, 0);
        const cantidadTotal = parseInt(document.getElementById('cantidadPiezas')?.value || 0);
        
        if (totalDistribuido !== cantidadTotal) {
            mostrarNotificacion('La distribución de piezas no coincide con la cantidad total', 'warning');
            return false;
        }
    }
    
    return true;
}

// Inicializar el módulo cuando se cargue la página
    document.addEventListener('DOMContentLoaded', function() {
        inicializarModuloPostprocesado();
        renderizarSelectorInsumos();
        
        // Actualizar resumen cuando cambien los valores
        setInterval(function() {
            const datos = obtenerDatosPostprocesado();
            if (datos.incluir_postprocesado) {
                document.getElementById('resumenManoObraPostprocesado').textContent = 
                    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(datos.costo_mano_obra);
                
                document.getElementById('resumenInsumosPostprocesado').textContent = 
                    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(datos.costo_total_insumos);
                
                document.getElementById('resumenTotalPostprocesado').textContent = 
                    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(datos.costo_total_postprocesado);
            }
        }, 500);
    });

// ============================================
// UTILIDADES
// ============================================

function formatearNumero(numero) {
    return parseFloat(numero).toLocaleString('es-CO', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });
}

function mostrarNotificacion(mensaje, tipo) {
    // Implementar según tu sistema de notificaciones existente
    console.log(`[${tipo.toUpperCase()}] ${mensaje}`);
    alert(mensaje); // Temporal - reemplazar con tu sistema
}

console.log('✅ Módulo de selección de máquinas cargado');

async function calcularPrecio() {
    console.log('ðŸŽ¯ Iniciando cÃ¡lculo de precio...');
    if (!validarSeleccionMaquina()) {
           return;
       }

    // NUEVO: Obtener datos de máquina seleccionada
    const datosMaquina = obtenerDatosMaquinaCotizacion();
     console.log('🏭 Máquina seleccionada:', datosMaquina);
    // Obtener valores del formulario
    const datos = {
        nombrePieza: document.getElementById('nombrePieza').value || 'Pieza sin nombre',
        costoCarrete: parseFloat(document.getElementById('costoCarrete').value) || 0,
        pesoCarrete: parseFloat(document.getElementById('pesoCarrete').value) || 1,
        pesoPieza: parseFloat(document.getElementById('pesoPieza').value) || 0,
        tiempoImpresion: parseFloat(document.getElementById('tiempoImpresion').value) || 0,
        horasDiseno: parseFloat(document.getElementById('horasDiseno').value) || 0,
        costoHoraDiseno: parseFloat(document.getElementById('costoHoraDiseno').value) || 0,
        factorSeguridad: parseFloat(document.getElementById('factorSeguridad').value) || 1,
        usoElectricidad: parseFloat(document.getElementById('usoElectricidad').value) || 0,
        gif: parseFloat(document.getElementById('gif').value) || 0,
        aiu: parseFloat(document.getElementById('aiu').value) || 0,
        margenMinorista: parseFloat(document.getElementById('margenMinorista').value) || 0,
        margenMayorista: parseFloat(document.getElementById('margenMayorista').value) || 0,
        incluirMarcaAgua: document.getElementById('incluirMarcaAgua').checked,
        porcentajeMarcaAgua: parseFloat(document.getElementById('porcentajeMarcaAgua').value) || 0,
        cantidadPiezas: parseInt(document.getElementById('cantidadPiezas').value) || 1,
        piezasPorLote: parseInt(document.getElementById('piezasPorLote').value) || 1,

         // NUEVO: Datos de máquina
        maquina_id: datosMaquina.modo === 'unica' ? datosMaquina.maquinaId : null,
        maquinas_multiples: datosMaquina.modo === 'multiple' 
            ? JSON.stringify(datosMaquina.maquinas) 
            : null,
        depreciacion_por_hora: datosMaquina.depreciacionPorHora
    };

    // NUEVO: Obtener datos de postprocesado
    const datosPostprocesado = obtenerDatosPostprocesado();
    
    // Agregar los datos de postprocesado al objeto datos
    datos.incluir_postprocesado = datosPostprocesado.incluir_postprocesado;
    datos.nivel_dificultad_postprocesado = datosPostprocesado.nivel_dificultad;
    datos.costo_mano_obra_postprocesado = datosPostprocesado.costo_mano_obra;
    datos.insumos_postprocesado = datosPostprocesado.insumos;
    
    console.log('ðŸ“ Datos capturados:', datos);
    
    // Validar que GestionCotizaciones existe
    if (typeof GestionCotizaciones === 'undefined') {
        console.error('âŒ GestionCotizaciones no estÃ¡ definido. AsegÃºrate de cargar main.js primero.');
        alert('Error: El sistema de cotizaciones no estÃ¡ cargado correctamente. Por favor, recarga la pÃ¡gina.');
        return;
    }
    
    try {
        // Crear cotizaciÃ³n usando el sistema central (ahora es async)
        const cotizacion = await GestionCotizaciones.crearCotizacion(datos);
        
        // Los cÃ¡lculos vienen en diferentes formatos segÃºn la BD
        const calculos = {
            costoFabricacion: cotizacion.costo_fabricacion || 0,
            costoEnergia: cotizacion.costo_energia || 0,
            costoDiseno: cotizacion.costo_diseno || 0,
            depreciacionMaquina: cotizacion.depreciacion_maquina || 0,
            costoGIF: cotizacion.costo_gif || 0,
            costoAIU: cotizacion.costo_aiu || 0,
            costoMarcaAgua: cotizacion.costo_marca_agua || 0,
            precioFinal: cotizacion.precio_final || 0,
            precioMinorista: cotizacion.precio_minorista || 0,
            precioMayorista: cotizacion.precio_mayorista || 0,
            numeroLotes: cotizacion.numero_lotes || 1,
            costoTotalPedido: cotizacion.costo_total_pedido || 0,
            tiempoTotalHoras: cotizacion.tiempo_total_horas || 0,
            filamentoTotalGramos: cotizacion.filamento_total_gramos || 0,
            
            costoManoObraPostprocesado: cotizacion.costo_mano_obra_postprocesado || 0,
            costoInsumosPostprocesado: cotizacion.costo_insumos_postprocesado || 0,
            costoTotalPostprocesado: cotizacion.costo_total_postprocesado || 0
        };
        
        console.log('âœ… CÃ¡lculos realizados:', calculos);
        
        // Actualizar interfaz - Solo elementos que existen
        actualizarElemento('costoFabricacion', calculos.costoFabricacion);
        actualizarElemento('costoEnergia', calculos.costoEnergia);
        actualizarElemento('costoDiseno', calculos.costoDiseno);
        actualizarElemento('depreciacionMaquina', calculos.depreciacionMaquina);
        actualizarElemento('costoGIF', calculos.costoGIF);
        actualizarElemento('costoAIU', calculos.costoAIU);
        actualizarElemento('precioFinal', calculos.precioFinal);
        actualizarElemento('precioMinorista', calculos.precioMinorista);
        actualizarElemento('precioMayorista', calculos.precioMayorista);
        
        // Actualizar marca de agua si estÃ¡ incluida
        if (datos.incluirMarcaAgua) {
            actualizarElemento('costoMarcaAguaDisplay', calculos.costoMarcaAgua);
            const itemMarcaAgua = document.getElementById('itemMarcaAgua');
            if (itemMarcaAgua) itemMarcaAgua.style.display = 'flex';
        } else {
            const itemMarcaAgua = document.getElementById('itemMarcaAgua');
            if (itemMarcaAgua) itemMarcaAgua.style.display = 'none';
        }
        
        // Actualizar resumen del pedido
        const resumenCantidad = document.getElementById('resumenCantidad');
        if (resumenCantidad) {
            resumenCantidad.textContent = datos.cantidadPiezas + (datos.cantidadPiezas === 1 ? ' pieza' : ' piezas');
        }
        
        const resumenLotes = document.getElementById('resumenLotes');
        if (resumenLotes) {
            resumenLotes.textContent = calculos.numeroLotes + (calculos.numeroLotes === 1 ? ' lote' : ' lotes');
        }
        
        actualizarElemento('resumenCostoTotal', calculos.costoTotalPedido);
        
        // Actualizar informaciÃ³n adicional
        const resumenTiempo = document.getElementById('resumenTiempo');
        if (resumenTiempo) {
            resumenTiempo.textContent = calculos.tiempoTotalHoras + ' horas';
        }
        
        const resumenFilamento = document.getElementById('resumenFilamento');
        if (resumenFilamento) {
            resumenFilamento.textContent = Math.round(calculos.filamentoTotalGramos) + 'g';
        }
        
        // Guardar Ãºltimo cÃ¡lculo
        ultimoCalculo = cotizacion;

        actualizarCostosAvanzados(datos, calculos);

        
        // NUEVO: Verificar disponibilidad de filamento si hay uno seleccionado
        if (typeof verificarMaterialDespuesDeCalcular === 'function') {
            const gramosNecesarios = calculos.filamentoTotalGramos || (datos.pesoPieza * datos.cantidadPiezas);
            verificarMaterialDespuesDeCalcular(gramosNecesarios);
        }
        
        // Mostrar notificaciÃ³n de Ã©xito
        if (typeof Utilidades !== 'undefined' && Utilidades.mostrarNotificacion) {
            Utilidades.mostrarNotificacion('âœ… CÃ¡lculo realizado y guardado en MySQL', 'success');
        } else {
            console.log('âœ… CÃ¡lculo completado exitosamente');
            mostrarNotificacionSimple('CÃ¡lculo realizado exitosamente', 'success');
        }
        
    } catch (error) {
        console.error('âŒ Error al calcular:', error);
        alert('Error al realizar el cÃ¡lculo: ' + error.message);
    }
}

// ============================================
// FUNCIÓN: Toggle Costos Avanzados
// ============================================
function toggleCostosAvanzados() {
    const content = document.getElementById('costosAvanzadosContent');
    const icon = document.getElementById('toggleIconAvanzados');
    
    if (content.classList.contains('show')) {
        content.classList.remove('show');
        icon.classList.remove('expanded');
        icon.classList.add('collapsed');
    } else {
        content.classList.add('show');
        icon.classList.remove('collapsed');
        icon.classList.add('expanded');
    }
}

// ============================================
// FUNCIÓN: Actualizar Costos Avanzados
// ============================================
function actualizarCostosAvanzados(datos, calculos) {
    console.log('📊 Actualizando panel de costos avanzados...');
    
    try {
        // Sección 1: Costos por Unidad
        document.getElementById('desgloseCostoFabricacion').textContent = formatearMoneda(calculos.costoFabricacion || 0);
        
        const costoUnitario = (datos.costoCarrete || 0) / ((datos.pesoCarrete || 1) * 1000);
        document.getElementById('desgloseCostoUnitario').textContent = formatearMoneda(costoUnitario) + '/g';
        document.getElementById('desgloseFactorSeguridad').textContent = (datos.factorSeguridad || 1) + 'x';
        
        document.getElementById('desgloseCostoEnergia').textContent = formatearMoneda(calculos.costoEnergia || 0);
        document.getElementById('desgloseTiempoImpresion').textContent = (datos.tiempoImpresion || 0) + ' min';
        document.getElementById('desgloseCostoKWH').textContent = formatearMoneda(datos.usoElectricidad || 0) + '/h';
        
        document.getElementById('desgloseCostoDiseno').textContent = formatearMoneda(calculos.costoDiseno || 0);
        document.getElementById('desgloseHorasDiseno').textContent = (datos.horasDiseno || 0) + 'h';
        document.getElementById('desglosePiezasDiseno').textContent = (datos.cantidadPiezas || 1) + ' pieza' + ((datos.cantidadPiezas || 1) > 1 ? 's' : '');
        
        document.getElementById('desgloseDepreciacion').textContent = formatearMoneda(calculos.depreciacionMaquina || 0);
        
        // Sección 2: Subtotal y Gastos
        document.getElementById('desgloseSubtotal').textContent = formatearMoneda(calculos.subtotal || 0);
        document.getElementById('desgloseCostoGIF').textContent = formatearMoneda(calculos.costoGIF || 0);
        document.getElementById('desglosePorcentajeGIF').textContent = (datos.gif || 0) + '%';
        document.getElementById('desgloseCostoAIU').textContent = formatearMoneda(calculos.costoAIU || 0);
        document.getElementById('desglosePorcentajeAIU').textContent = (datos.aiu || 0) + '%';
        
        // Marca de agua (mostrar/ocultar según corresponda)
        if (datos.incluirMarcaAgua) {
            document.getElementById('desgloseMarcaAguaItem').style.display = 'flex';
            document.getElementById('desgloseMarcaAguaPorcentaje').style.display = 'flex';
            document.getElementById('desgloseCostoMarcaAgua').textContent = formatearMoneda(calculos.costoMarcaAgua || 0);
            document.getElementById('desglosePorcentajeMarcaAgua').textContent = (datos.porcentajeMarcaAgua || 0) + '%';
        } else {
            document.getElementById('desgloseMarcaAguaItem').style.display = 'none';
            document.getElementById('desgloseMarcaAguaPorcentaje').style.display = 'none';
        }
        
        // Sección 3: Precio Final por Unidad
        document.getElementById('desglosePrecioBase').textContent = formatearMoneda(calculos.precioFinal || 0);
        document.getElementById('desglosePiezasPorLote').textContent = datos.piezasPorLote || 1;
        
        // Sección 4: Costos por Lote
        document.getElementById('desglosePiezasLote').textContent = datos.piezasPorLote || 1;
        document.getElementById('desgloseCostoPorLote').textContent = formatearMoneda((calculos.precioFinal || 0) * (datos.piezasPorLote || 1));
        
        // Sección 5: Precios por Canal
        document.getElementById('desglosePrecioMinorista').textContent = formatearMoneda(calculos.precioMinorista || 0);
        document.getElementById('desgloseMargenMinorista').textContent = (datos.margenMinorista || 0) + '%';
        document.getElementById('desglosePrecioMayorista').textContent = formatearMoneda(calculos.precioMayorista || 0);
        document.getElementById('desgloseMargenMayorista').textContent = (datos.margenMayorista || 0) + '%';
        
        // Sección 6: Totales del Pedido
        document.getElementById('desgloseCantidadTotal').textContent = datos.cantidadPiezas || 1;
        document.getElementById('desgloseNumeroLotes').textContent = calculos.numeroLotes || 1;
        document.getElementById('desgloseTiempoTotal').textContent = ((calculos.tiempoTotalHoras || 0).toFixed(1)) + 'h';
        document.getElementById('desgloseFilamentoTotal').textContent = ((calculos.filamentoTotalGramos || 0).toFixed(1)) + 'g';
        document.getElementById('desgloseCostoTotalPedido').textContent = formatearMoneda(calculos.costoTotalPedido || 0);
        
        // Calcular totales por canal
        const totalMinorista = (calculos.costoTotalPedido || 0) * (1 + (datos.margenMinorista || 0) / 100);
        const totalMayorista = (calculos.costoTotalPedido || 0) * (1 + (datos.margenMayorista || 0) / 100);
        
        document.getElementById('desgloseTotalMinorista').textContent = formatearMoneda(totalMinorista);
        document.getElementById('desgloseTotalMayorista').textContent = formatearMoneda(totalMayorista);
        
        console.log('✅ Panel de costos avanzados actualizado correctamente');
        
    } catch (error) {
        console.error('❌ Error actualizando costos avanzados:', error);
    }
}

// ============================================
// FUNCIÓN AUXILIAR: Formatear Moneda
// (Solo agregar si no existe ya en tu código)
// ============================================
function formatearMoneda(valor) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(valor);
}

// ============================================
// FUNCIÃ“N AUXILIAR PARA ACTUALIZAR ELEMENTOS
// ============================================

function actualizarElemento(id, valor) {
    const elemento = document.getElementById(id);
    if (elemento) {
        if (typeof Utilidades !== 'undefined' && Utilidades.formatearMoneda) {
            elemento.textContent = Utilidades.formatearMoneda(valor);
        } else {
            // Fallback si Utilidades no estÃ¡ disponible
            elemento.textContent = '$' + Math.round(valor).toLocaleString('es-CO');
        }
        console.log(`âœ” Actualizado ${id}: ${elemento.textContent}`);
    } else {
        console.warn(`âš ï¸ Elemento con ID '${id}' no encontrado en el DOM`);
    }
}

// ============================================
// NOTIFICACIÃ“N SIMPLE (FALLBACK)
// ============================================

function mostrarNotificacionSimple(mensaje, tipo = 'success') {
    // Crear elemento de notificaciÃ³n si no existe el sistema de Utilidades
    const notif = document.createElement('div');
    notif.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        background: ${tipo === 'success' ? '#10b981' : '#ef4444'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 10000;
        font-family: system-ui, -apple-system, sans-serif;
        animation: slideIn 0.3s ease-out;
    `;
    notif.textContent = mensaje;
    
    // Agregar animaciÃ³n
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    if (!document.getElementById('notif-style')) {
        style.id = 'notif-style';
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notif);
    
    // Auto-remover despuÃ©s de 3 segundos
    setTimeout(() => {
        notif.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => notif.remove(), 300);
    }, 3000);
}

// ============================================
// LIMPIAR FORMULARIO
// ============================================

function limpiarFormulario() {
    // Limpiar campos del formulario
    document.getElementById('nombrePieza').value = '';
    document.getElementById('pesoPieza').value = '';
    document.getElementById('tiempoImpresion').value = '';
    document.getElementById('horasDiseno').value = '0';
    document.getElementById('cantidadPiezas').value = '1';
    document.getElementById('piezasPorLote').value = '1';
    
    // Limpiar resultados
    const resultados = [
        'costoFabricacion', 'costoEnergia', 'costoDiseno', 'depreciacionMaquina',
        'costoGIF', 'costoAIU', 'precioFinal', 'precioMinorista', 'precioMayorista',
        'resumenCostoTotal'
    ];
    
    resultados.forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) elemento.textContent = '$0';
    });
    
    // Ocultar marca de agua
    const itemMarcaAgua = document.getElementById('itemMarcaAgua');
    if (itemMarcaAgua) itemMarcaAgua.style.display = 'none';
    
    // Limpiar Ãºltimo cÃ¡lculo
    ultimoCalculo = null;
    
    console.log('ðŸ§¹ Formulario limpiado');
}

// ============================================
// TOGGLE MARCA DE AGUA
// ============================================

function toggleMarcaAgua() {
    const checkbox = document.getElementById('incluirMarcaAgua');
    const inputPorcentaje = document.getElementById('porcentajeMarcaAgua');
    
    if (checkbox && inputPorcentaje) {
        inputPorcentaje.disabled = !checkbox.checked;
        
        if (!checkbox.checked) {
            inputPorcentaje.value = '0';
        }
        
        console.log(`ðŸŽ¨ Marca de agua: ${checkbox.checked ? 'Activada' : 'Desactivada'}`);
    }
}

// ============================================
// VALIDAR LOTE
// ============================================

function validarLote() {
    const cantidadPiezas = parseInt(document.getElementById('cantidadPiezas').value) || 1;
    const piezasPorLote = parseInt(document.getElementById('piezasPorLote').value) || 1;
    
    if (piezasPorLote > cantidadPiezas) {
        alert(`El nÃºmero de piezas por lote (${piezasPorLote}) no puede ser mayor que la cantidad total de piezas (${cantidadPiezas})`);
        document.getElementById('piezasPorLote').value = cantidadPiezas;
        return false;
    }
    
    return true;
}

// ============================================
// CARGAR HISTORIAL DE COTIZACIONES
// ============================================

async function cargarHistorial() {
    const container = document.getElementById('historialCotizaciones');
    if (!container) return;
    
    container.innerHTML = '<p style="text-align: center; padding: 20px;">â³ Cargando historial...</p>';
    
    try {
        const cotizaciones = await GestionCotizaciones.obtenerHistorial();
        
        container.innerHTML = '';
        
        if (cotizaciones.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #6b7280; padding: 20px;">No hay cotizaciones guardadas</p>';
            return;
        }
        
        cotizaciones.forEach(cotizacion => {
            const div = document.createElement('div');
            div.className = 'cotizacion-item';
            
            const fecha = new Date(cotizacion.fecha_completa || cotizacion.fecha);
            const fechaFormateada = fecha.toLocaleDateString('es-CO', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div>
                        <h4 style="margin: 0 0 5px 0;">${cotizacion.nombre_pieza || cotizacion.nombrePieza}</h4>
                        <p style="margin: 0; font-size: 0.9em; color: #6b7280;">${fechaFormateada}</p>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 1.2em; font-weight: bold; color: #059669;">
                            ${Utilidades.formatearMoneda(cotizacion.precio_final || cotizacion.precioFinal || 0)}
                        </div>
                        <div style="font-size: 0.9em; color: #6b7280;">
                            ${cotizacion.cantidad_piezas || cotizacion.cantidadPiezas || 1} piezas
                        </div>
                    </div>
                </div>
                <button onclick="eliminarCotizacion('${cotizacion.id}')" 
                        style="margin-top: 10px; background: #ef4444; color: white; border: none; padding: 5px 15px; border-radius: 5px; cursor: pointer;">
                    ðŸ—‘ï¸ Eliminar
                </button>
            `;
            
            container.appendChild(div);
        });
        
    } catch (error) {
        console.error('Error al cargar historial:', error);
        container.innerHTML = '<p style="text-align: center; color: #ef4444; padding: 20px;">Error al cargar historial</p>';
    }
}

// ============================================
// ELIMINAR COTIZACIÃ“N
// ============================================

async function eliminarCotizacion(id) {
    if (!confirm('Â¿EstÃ¡s seguro de que quieres eliminar esta cotizaciÃ³n?')) {
        return;
    }
    
    try {
        await GestionCotizaciones.eliminarCotizacion(id);
        await cargarHistorial();
        
        if (typeof Utilidades !== 'undefined' && Utilidades.mostrarNotificacion) {
            Utilidades.mostrarNotificacion('CotizaciÃ³n eliminada', 'success');
        } else {
            mostrarNotificacionSimple('CotizaciÃ³n eliminada', 'success');
        }
    } catch (error) {
        console.error('Error al eliminar:', error);
        alert('Error al eliminar cotizaciÃ³n');
    }
}

// ============================================
// INICIALIZACIÃ“N
// ============================================

document.addEventListener('DOMContentLoaded', async function() {
    console.log('ðŸš€ Inicializando mÃ³dulo de cotizaciÃ³n...');
    
    // Esperar a que el sistema principal se inicialice
    await new Promise(resolve => {
        if (typeof SistemaGestion3D !== 'undefined') {
            resolve();
        } else {
            const interval = setInterval(() => {
                if (typeof SistemaGestion3D !== 'undefined') {
                    clearInterval(interval);
                    resolve();
                }
            }, 100);
        }
    });
    
    // Configurar event listeners
    const incluirMarcaAgua = document.getElementById('incluirMarcaAgua');
    if (incluirMarcaAgua) {
        incluirMarcaAgua.addEventListener('change', toggleMarcaAgua);
        toggleMarcaAgua(); // Inicializar estado
        console.log('âœ“ Event listener para marca de agua configurado');
    }
    
    const cantidadPiezas = document.getElementById('cantidadPiezas');
    if (cantidadPiezas) {
        cantidadPiezas.addEventListener('change', validarLote);
        console.log('âœ“ Event listener para cantidad de piezas configurado');
    }
    
    const piezasPorLote = document.getElementById('piezasPorLote');
    if (piezasPorLote) {
        piezasPorLote.addEventListener('change', validarLote);
        console.log('âœ“ Event listener para piezas por lote configurado');
    }
    
    // Cargar historial si existe el contenedor
    if (document.getElementById('historialCotizaciones')) {
        await cargarHistorial();
    }
    
    console.log('âœ… MÃ³dulo de cotizaciÃ³n inicializado correctamente (MySQL)');
});

// ============================================
// ESTADO DE MÁQUINAS
// ============================================

const EstadoMaquinasCotizacion = {
    maquinasDisponibles: [],
    modoActual: 'unica', // 'unica' o 'multiple'
    maquinaSeleccionada: null,
    distribucionMaquinas: [],
    contadorDistribucion: 0
};

// ============================================
// INICIALIZACIÓN
// ============================================

// Cargar máquinas al cargar la página
document.addEventListener('DOMContentLoaded', function() {
    cargarMaquinasDisponibles();
});

// ============================================
// CARGAR MÁQUINAS DISPONIBLES
// ============================================

async function cargarMaquinasDisponibles() {
    try {
        const maquinas = await apiClient.get('api_maquinas.php', { action: 'list' });
        
        // Filtrar solo máquinas activas
        EstadoMaquinasCotizacion.maquinasDisponibles = maquinas.filter(m => m.activa);
        
        // Llenar selector
        llenarSelectorMaquinas();
        
        console.log(`✅ ${EstadoMaquinasCotizacion.maquinasDisponibles.length} máquinas cargadas`);
    } catch (error) {
        console.error('❌ Error al cargar máquinas:', error);
        mostrarNotificacion('Error al cargar las máquinas disponibles', 'error');
    }
}

function llenarSelectorMaquinas() {
    const select = document.getElementById('maquinaSeleccionada');
    if (!select) return;
    
    // Limpiar opciones existentes (excepto la primera)
    select.innerHTML = '<option value="">-- Seleccionar máquina --</option>';
    
    // Agregar máquinas
    EstadoMaquinasCotizacion.maquinasDisponibles.forEach(maquina => {
        const option = document.createElement('option');
        option.value = maquina.id;
        option.textContent = `${maquina.nombre} - $${formatearNumero(maquina.depreciacion_por_hora)}/h`;
        option.dataset.maquina = JSON.stringify(maquina);
        select.appendChild(option);
    });
}

// ============================================
// CAMBIAR MODO DE MÁQUINA
// ============================================

function cambiarModoMaquina(modo) {
    EstadoMaquinasCotizacion.modoActual = modo;
    
    const selectorUnica = document.getElementById('selectorMaquinaUnica');
    const selectorMultiple = document.getElementById('selectorMaquinasMultiples');
    
    if (modo === 'unica') {
        selectorUnica.style.display = 'block';
        selectorMultiple.style.display = 'none';
        actualizarInfoMaquina();
    } else {
        selectorUnica.style.display = 'none';
        selectorMultiple.style.display = 'block';
        inicializarDistribucionMultiple();
    }
}

// ============================================
// MODO: MÁQUINA ÚNICA
// ============================================

function actualizarInfoMaquina() {
    const select = document.getElementById('maquinaSeleccionada');
    const infoDiv = document.getElementById('infoMaquinaUnica');
    
    if (!select.value) {
        infoDiv.style.display = 'none';
        EstadoMaquinasCotizacion.maquinaSeleccionada = null;
        return;
    }
    
    const option = select.options[select.selectedIndex];
    const maquina = JSON.parse(option.dataset.maquina);
    EstadoMaquinasCotizacion.maquinaSeleccionada = maquina;
    
    // Mostrar información
    document.getElementById('infoModelo').textContent = maquina.modelo || '-';
    document.getElementById('infoTipo').textContent = maquina.tipo;
    document.getElementById('infoDepreciacion').textContent = `$${formatearNumero(maquina.depreciacion_por_hora)}`;
    document.getElementById('infoHorasUso').textContent = `${parseFloat(maquina.horas_uso_total || 0).toFixed(1)}h`;
    
    // Calcular depreciación estimada
    calcularDepreciacionEstimada();
    
    infoDiv.style.display = 'block';
}

function calcularDepreciacionEstimada() {
    if (!EstadoMaquinasCotizacion.maquinaSeleccionada) return;
    
    const tiempoImpresion = parseFloat(document.getElementById('tiempoImpresion')?.value || 0);
    const cantidadPiezas = parseFloat(document.getElementById('cantidadPiezas')?.value || 1);
    
    const tiempoHoras = tiempoImpresion / 60;
    const depreciacionPorPieza = EstadoMaquinasCotizacion.maquinaSeleccionada.depreciacion_por_hora * tiempoHoras;
    const depreciacionTotal = depreciacionPorPieza * cantidadPiezas;
    
    document.getElementById('depreciacionEstimada').textContent = `$${formatearNumero(depreciacionTotal)}`;
}

// Actualizar depreciación estimada cuando cambien inputs
if (document.getElementById('tiempoImpresion')) {
    document.getElementById('tiempoImpresion').addEventListener('change', calcularDepreciacionEstimada);
}
if (document.getElementById('cantidadPiezas')) {
    document.getElementById('cantidadPiezas').addEventListener('change', function() {
        calcularDepreciacionEstimada();
        if (EstadoMaquinasCotizacion.modoActual === 'multiple') {
            actualizarResumenDistribucion();
        }
    });
}

// ============================================
// MODO: MÚLTIPLES MÁQUINAS
// ============================================

function inicializarDistribucionMultiple() {
    EstadoMaquinasCotizacion.distribucionMaquinas = [];
    EstadoMaquinasCotizacion.contadorDistribucion = 0;
    
    const contenedor = document.getElementById('distribucionMaquinas');
    contenedor.innerHTML = '';
    
    // Agregar primera máquina automáticamente
    agregarMaquinaDistribucion();
}

function agregarMaquinaDistribucion() {
    if (EstadoMaquinasCotizacion.maquinasDisponibles.length === 0) {
        mostrarNotificacion('No hay máquinas disponibles', 'warning');
        return;
    }
    
    EstadoMaquinasCotizacion.contadorDistribucion++;
    const id = EstadoMaquinasCotizacion.contadorDistribucion;
    
    const contenedor = document.getElementById('distribucionMaquinas');
    const item = document.createElement('div');
    item.className = 'maquina-distribucion-item';
    item.id = `distribucion-${id}`;
    item.dataset.id = id;
    
    item.innerHTML = `
        <div class="distribucion-header">
            <div class="distribucion-numero">${id}</div>
            <button type="button" class="btn-eliminar-maquina" onclick="eliminarMaquinaDistribucion(${id})">
                🗑️ Eliminar
            </button>
        </div>
        
        <div class="distribucion-inputs">
            <div class="form-group" style="margin: 0;">
                <label for="maquina-${id}">Máquina</label>
                <select id="maquina-${id}" onchange="actualizarDistribucionItem(${id})">
                    <option value="">-- Seleccionar --</option>
                    ${EstadoMaquinasCotizacion.maquinasDisponibles.map(m => 
                        `<option value="${m.id}" data-depreciacion="${m.depreciacion_por_hora}">
                            ${m.nombre} ($${formatearNumero(m.depreciacion_por_hora)}/h)
                        </option>`
                    ).join('')}
                </select>
            </div>
            
            <div class="form-group" style="margin: 0;">
                <label for="piezas-${id}">Número de Piezas</label>
                <input type="number" id="piezas-${id}" min="0" value="0" 
                       onchange="actualizarDistribucionItem(${id})">
            </div>
        </div>
        
        <div class="distribucion-info" id="info-${id}" style="display: none;">
            <div>
                <span class="label">Depreciación:</span>
                <span class="value" id="dep-${id}">$0</span>
            </div>
            <div>
                <span class="label">Tiempo total:</span>
                <span class="value" id="tiempo-${id}">0h</span>
            </div>
        </div>
    `;
    
    contenedor.appendChild(item);
    
    // Inicializar en el estado
    EstadoMaquinasCotizacion.distribucionMaquinas.push({
        id: id,
        maquinaId: null,
        piezas: 0,
        depreciacion: 0
    });
}

function actualizarDistribucionItem(id) {
    const selectMaquina = document.getElementById(`maquina-${id}`);
    const inputPiezas = document.getElementById(`piezas-${id}`);
    const infoDiv = document.getElementById(`info-${id}`);
    const itemDiv = document.getElementById(`distribucion-${id}`);
    
    const maquinaId = selectMaquina.value;
    const piezas = parseInt(inputPiezas.value) || 0;
    
    // Buscar en el estado
    const item = EstadoMaquinasCotizacion.distribucionMaquinas.find(d => d.id === id);
    if (!item) return;
    
    item.maquinaId = maquinaId;
    item.piezas = piezas;
    
    if (maquinaId && piezas > 0) {
        // Obtener depreciación de la máquina
        const option = selectMaquina.options[selectMaquina.selectedIndex];
        const depreciacionPorHora = parseFloat(option.dataset.depreciacion);
        item.depreciacion = depreciacionPorHora;
        
        // Calcular valores
        const tiempoImpresion = parseFloat(document.getElementById('tiempoImpresion')?.value || 0);
        const tiempoHoras = (tiempoImpresion / 60) * piezas;
        const costoDepreciacion = depreciacionPorHora * tiempoHoras;
        
        // Mostrar info
        document.getElementById(`dep-${id}`).textContent = `$${formatearNumero(costoDepreciacion)}`;
        document.getElementById(`tiempo-${id}`).textContent = `${tiempoHoras.toFixed(1)}h`;
        
        infoDiv.style.display = 'flex';
        itemDiv.classList.add('completa');
    } else {
        infoDiv.style.display = 'none';
        itemDiv.classList.remove('completa');
    }
    
    actualizarResumenDistribucion();
}

function eliminarMaquinaDistribucion(id) {
    // Remover del DOM
    const item = document.getElementById(`distribucion-${id}`);
    if (item) {
        item.remove();
    }
    
    // Remover del estado
    EstadoMaquinasCotizacion.distribucionMaquinas = 
        EstadoMaquinasCotizacion.distribucionMaquinas.filter(d => d.id !== id);
    
    actualizarResumenDistribucion();
}

function actualizarResumenDistribucion() {
    const resumen = document.getElementById('resumenDistribucion');
    const distribucionesValidas = EstadoMaquinasCotizacion.distribucionMaquinas.filter(
        d => d.maquinaId && d.piezas > 0
    );
    
    if (distribucionesValidas.length === 0) {
        resumen.style.display = 'none';
        return;
    }
    
    // Calcular totales
    const totalPiezas = distribucionesValidas.reduce((sum, d) => sum + d.piezas, 0);
    const totalMaquinas = distribucionesValidas.length;
    
    // Calcular depreciación promedio ponderada
    const tiempoImpresion = parseFloat(document.getElementById('tiempoImpresion')?.value || 0);
    const tiempoHoras = tiempoImpresion / 60;
    
    let depreciacionTotalPonderada = 0;
    distribucionesValidas.forEach(d => {
        const peso = d.piezas / totalPiezas;
        depreciacionTotalPonderada += d.depreciacion * peso;
    });
    
    const depreciacionTotal = depreciacionTotalPonderada * tiempoHoras * totalPiezas;
    
    // Actualizar UI
    document.getElementById('totalPiezasDistribucion').textContent = totalPiezas;
    document.getElementById('totalMaquinasUsadas').textContent = totalMaquinas;
    document.getElementById('depreciacionPromedio').textContent = `$${formatearNumero(depreciacionTotalPonderada)}`;
    document.getElementById('depreciacionTotalMultiple').textContent = `$${formatearNumero(depreciacionTotal)}`;
    
    resumen.style.display = 'block';
    
    // Validar con cantidad total
    validarDistribucionTotal(totalPiezas);
}

function validarDistribucionTotal(totalDistribuido) {
    const cantidadTotal = parseInt(document.getElementById('cantidadPiezas')?.value || 0);
    const errorDiv = document.getElementById('errorDistribucionMaquinas');
    
    // Crear div de error si no existe
    if (!errorDiv && cantidadTotal > 0) {
        const div = document.createElement('div');
        div.id = 'errorDistribucionMaquinas';
        div.className = 'error-distribucion';
        document.getElementById('selectorMaquinasMultiples').appendChild(div);
    }
    
    const errorElement = document.getElementById('errorDistribucionMaquinas');
    
    if (cantidadTotal > 0 && totalDistribuido !== cantidadTotal) {
        if (errorElement) {
            errorElement.style.display = 'flex';
            errorElement.textContent = totalDistribuido > cantidadTotal 
                ? `Has distribuido ${totalDistribuido} piezas, pero solo necesitas ${cantidadTotal}`
                : `Faltan ${cantidadTotal - totalDistribuido} piezas por distribuir`;
        }
        return false;
    } else {
        if (errorElement) {
            errorElement.style.display = 'none';
        }
        return true;
    }
}

// ============================================
// OBTENER DATOS DE MÁQUINA PARA COTIZACIÓN
// ============================================

function obtenerDatosMaquinaCotizacion() {
    if (EstadoMaquinasCotizacion.modoActual === 'unica') {
        return {
            modo: 'unica',
            maquinaId: EstadoMaquinasCotizacion.maquinaSeleccionada?.id || null,
            depreciacionPorHora: EstadoMaquinasCotizacion.maquinaSeleccionada?.depreciacion_por_hora || 2.00
        };
    } else {
        const distribucionesValidas = EstadoMaquinasCotizacion.distribucionMaquinas.filter(
            d => d.maquinaId && d.piezas > 0
        );
        
        const totalPiezas = distribucionesValidas.reduce((sum, d) => sum + d.piezas, 0);
        
        // Calcular depreciación promedio ponderada
        let depreciacionPromedio = 0;
        if (totalPiezas > 0) {
            distribucionesValidas.forEach(d => {
                const peso = d.piezas / totalPiezas;
                depreciacionPromedio += d.depreciacion * peso;
            });
        } else {
            depreciacionPromedio = 2.00; // Valor por defecto
        }
        
        return {
            modo: 'multiple',
            maquinas: distribucionesValidas.map(d => ({
                maquinaId: d.maquinaId,
                piezas: d.piezas,
                depreciacion: d.depreciacion
            })),
            depreciacionPorHora: depreciacionPromedio
        };
    }
}


// Exportar funciones globalmente
window.calcularPrecio = calcularPrecio;
window.limpiarFormulario = limpiarFormulario;
window.toggleMarcaAgua = toggleMarcaAgua;
window.validarLote = validarLote;
window.cargarHistorial = cargarHistorial;
window.eliminarCotizacion = eliminarCotizacion;

console.log('ðŸ“¦ cotizacion.js cargado (VersiÃ³n MySQL)');
console.log('ðŸ“¦ Funciones globales exportadas: calcularPrecio, limpiarFormulario, toggleMarcaAgua, validarLote, cargarHistorial, eliminarCotizacion');