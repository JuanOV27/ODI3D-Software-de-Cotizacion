// ============================================
// COTIZACION.JS - Integración con API MySQL
// ============================================

// Variables locales
let ultimoCalculo = null;

// ============================================
// FUNCIÓN PRINCIPAL - DISPONIBLE GLOBALMENTE
// ============================================

async function calcularPrecio() {
    console.log('🎯 Iniciando cálculo de precio...');
    
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
        piezasPorLote: parseInt(document.getElementById('piezasPorLote').value) || 1
    };
    
    console.log('📝 Datos capturados:', datos);
    
    // Validar que GestionCotizaciones existe
    if (typeof GestionCotizaciones === 'undefined') {
        console.error('❌ GestionCotizaciones no está definido. Asegúrate de cargar main.js primero.');
        alert('Error: El sistema de cotizaciones no está cargado correctamente. Por favor, recarga la página.');
        return;
    }
    
    try {
        // Crear cotización usando el sistema central (ahora es async)
        const cotizacion = await GestionCotizaciones.crearCotizacion(datos);
        
        // Los cálculos vienen en diferentes formatos según la BD
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
            filamentoTotalGramos: cotizacion.filamento_total_gramos || 0
        };
        
        console.log('✅ Cálculos realizados:', calculos);
        
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
        
        // Actualizar marca de agua si está incluida
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
        
        // Actualizar información adicional
        const resumenTiempo = document.getElementById('resumenTiempo');
        if (resumenTiempo) {
            resumenTiempo.textContent = calculos.tiempoTotalHoras + ' horas';
        }
        
        const resumenFilamento = document.getElementById('resumenFilamento');
        if (resumenFilamento) {
            resumenFilamento.textContent = Math.round(calculos.filamentoTotalGramos) + 'g';
        }
        
        // Guardar último cálculo
        ultimoCalculo = cotizacion;
        
        // Mostrar notificación de éxito
        if (typeof Utilidades !== 'undefined' && Utilidades.mostrarNotificacion) {
            Utilidades.mostrarNotificacion('✅ Cálculo realizado y guardado en MySQL', 'success');
        } else {
            console.log('✅ Cálculo completado exitosamente');
            mostrarNotificacionSimple('Cálculo realizado exitosamente', 'success');
        }
        
    } catch (error) {
        console.error('❌ Error al calcular:', error);
        alert('Error al realizar el cálculo: ' + error.message);
    }
}

// ============================================
// FUNCIÓN AUXILIAR PARA ACTUALIZAR ELEMENTOS
// ============================================

function actualizarElemento(id, valor) {
    const elemento = document.getElementById(id);
    if (elemento) {
        if (typeof Utilidades !== 'undefined' && Utilidades.formatearMoneda) {
            elemento.textContent = Utilidades.formatearMoneda(valor);
        } else {
            // Fallback si Utilidades no está disponible
            elemento.textContent = '$' + Math.round(valor).toLocaleString('es-CO');
        }
        console.log(`✔ Actualizado ${id}: ${elemento.textContent}`);
    } else {
        console.warn(`⚠️ Elemento con ID '${id}' no encontrado en el DOM`);
    }
}

// ============================================
// NOTIFICACIÓN SIMPLE (FALLBACK)
// ============================================

function mostrarNotificacionSimple(mensaje, tipo = 'success') {
    // Crear elemento de notificación si no existe el sistema de Utilidades
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
    
    // Agregar animación
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
    
    // Auto-remover después de 3 segundos
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
    
    // Limpiar último cálculo
    ultimoCalculo = null;
    
    console.log('🧹 Formulario limpiado');
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
        
        console.log(`🎨 Marca de agua: ${checkbox.checked ? 'Activada' : 'Desactivada'}`);
    }
}

// ============================================
// VALIDAR LOTE
// ============================================

function validarLote() {
    const cantidadPiezas = parseInt(document.getElementById('cantidadPiezas').value) || 1;
    const piezasPorLote = parseInt(document.getElementById('piezasPorLote').value) || 1;
    
    if (piezasPorLote > cantidadPiezas) {
        alert(`El número de piezas por lote (${piezasPorLote}) no puede ser mayor que la cantidad total de piezas (${cantidadPiezas})`);
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
    
    container.innerHTML = '<p style="text-align: center; padding: 20px;">⏳ Cargando historial...</p>';
    
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
                    🗑️ Eliminar
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
// ELIMINAR COTIZACIÓN
// ============================================

async function eliminarCotizacion(id) {
    if (!confirm('¿Estás seguro de que quieres eliminar esta cotización?')) {
        return;
    }
    
    try {
        await GestionCotizaciones.eliminarCotizacion(id);
        await cargarHistorial();
        
        if (typeof Utilidades !== 'undefined' && Utilidades.mostrarNotificacion) {
            Utilidades.mostrarNotificacion('Cotización eliminada', 'success');
        } else {
            mostrarNotificacionSimple('Cotización eliminada', 'success');
        }
    } catch (error) {
        console.error('Error al eliminar:', error);
        alert('Error al eliminar cotización');
    }
}

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Inicializando módulo de cotización...');
    
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
        console.log('✓ Event listener para marca de agua configurado');
    }
    
    const cantidadPiezas = document.getElementById('cantidadPiezas');
    if (cantidadPiezas) {
        cantidadPiezas.addEventListener('change', validarLote);
        console.log('✓ Event listener para cantidad de piezas configurado');
    }
    
    const piezasPorLote = document.getElementById('piezasPorLote');
    if (piezasPorLote) {
        piezasPorLote.addEventListener('change', validarLote);
        console.log('✓ Event listener para piezas por lote configurado');
    }
    
    // Cargar historial si existe el contenedor
    if (document.getElementById('historialCotizaciones')) {
        await cargarHistorial();
    }
    
    console.log('✅ Módulo de cotización inicializado correctamente (MySQL)');
});

// Exportar funciones globalmente
window.calcularPrecio = calcularPrecio;
window.limpiarFormulario = limpiarFormulario;
window.toggleMarcaAgua = toggleMarcaAgua;
window.validarLote = validarLote;
window.cargarHistorial = cargarHistorial;
window.eliminarCotizacion = eliminarCotizacion;

console.log('📦 cotizacion.js cargado (Versión MySQL)');
console.log('📦 Funciones globales exportadas: calcularPrecio, limpiarFormulario, toggleMarcaAgua, validarLote, cargarHistorial, eliminarCotizacion');