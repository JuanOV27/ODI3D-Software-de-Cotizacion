// ============================================
// COTIZACION.JS - Integración con main.js (VERSIÓN FINAL CORREGIDA)
// ============================================

// Variables locales
let ultimoCalculo = null;

// ============================================
// FUNCIÓN PRINCIPAL - DISPONIBLE GLOBALMENTE
// ============================================

function calcularPrecio() {
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
        // Crear cotización usando el sistema central
        const cotizacion = GestionCotizaciones.crearCotizacion(datos);
        const calculos = cotizacion.calculos;
        
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
        
        // Guardar último cálculo
        ultimoCalculo = cotizacion;
        
        // Mostrar notificación de éxito
        if (typeof Utilidades !== 'undefined' && Utilidades.mostrarNotificacion) {
            Utilidades.mostrarNotificacion('✅ Cálculo realizado exitosamente', 'success');
        } else {
            console.log('✅ Cálculo completado exitosamente');
            // Mostrar alerta visual simple si no hay sistema de notificaciones
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
        console.log(`✓ Actualizado ${id}: ${elemento.textContent}`);
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
    document.head.appendChild(style);
    
    document.body.appendChild(notif);
    
    setTimeout(() => {
        notif.style.transition = 'all 0.3s ease-out';
        notif.style.transform = 'translateX(120%)';
        notif.style.opacity = '0';
        setTimeout(() => document.body.removeChild(notif), 300);
    }, 3000);
}

// ============================================
// GESTIÓN DE MARCA DE AGUA
// ============================================

function toggleMarcaAgua() {
    const checkbox = document.getElementById('incluirMarcaAgua');
    const grupoMarcaAgua = document.getElementById('grupoMarcaAgua');
    const itemMarcaAgua = document.getElementById('itemMarcaAgua');
    
    if (checkbox && checkbox.checked) {
        if (grupoMarcaAgua) grupoMarcaAgua.style.display = 'block';
        if (itemMarcaAgua) itemMarcaAgua.style.display = 'flex';
    } else {
        if (grupoMarcaAgua) grupoMarcaAgua.style.display = 'none';
        if (itemMarcaAgua) itemMarcaAgua.style.display = 'none';
    }
}

// ============================================
// VALIDACIÓN DE LOTES
// ============================================

function validarLote() {
    const cantidadPiezas = parseInt(document.getElementById('cantidadPiezas').value) || 1;
    const piezasPorLote = parseInt(document.getElementById('piezasPorLote').value) || 1;
    const errorLote = document.getElementById('errorLote');
    
    if (piezasPorLote > cantidadPiezas) {
        document.getElementById('piezasPorLote').value = cantidadPiezas;
        if (errorLote) {
            errorLote.style.display = 'block';
            setTimeout(() => {
                errorLote.style.display = 'none';
            }, 3000);
        }
    }
}

// ============================================
// LIMPIAR FORMULARIO
// ============================================

function limpiarFormulario() {
    document.getElementById('nombrePieza').value = '';
    document.getElementById('costoCarrete').value = '120000';
    document.getElementById('pesoCarrete').value = '1';
    document.getElementById('pesoPieza').value = '50';
    document.getElementById('tiempoImpresion').value = '120';
    document.getElementById('horasDiseno').value = '2';
    document.getElementById('costoHoraDiseno').value = '25000';
    document.getElementById('factorSeguridad').value = '1.1';
    document.getElementById('usoElectricidad').value = '600';
    document.getElementById('gif').value = '15';
    document.getElementById('aiu').value = '25';
    document.getElementById('porcentajeMarcaAgua').value = '10';
    document.getElementById('margenMinorista').value = '30';
    document.getElementById('margenMayorista').value = '20';
    document.getElementById('cantidadPiezas').value = '1';
    document.getElementById('piezasPorLote').value = '1';
    document.getElementById('incluirMarcaAgua').checked = false;
    
    toggleMarcaAgua();
    
    // Limpiar resultados
    const resultValues = document.querySelectorAll('.result-value');
    resultValues.forEach(el => el.textContent = '$0');
    
    // Limpiar resumen
    const resumenCantidad = document.getElementById('resumenCantidad');
    if (resumenCantidad) resumenCantidad.textContent = '1 pieza';
    
    const resumenLotes = document.getElementById('resumenLotes');
    if (resumenLotes) resumenLotes.textContent = '1 lote';
    
    ultimoCalculo = null;
    
    console.log('🧹 Formulario limpiado');
}

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inicializando módulo de cotización...');
    
    // Agregar event listeners
    const checkbox = document.getElementById('incluirMarcaAgua');
    if (checkbox) {
        checkbox.addEventListener('change', toggleMarcaAgua);
        console.log('✓ Event listener para marca de agua configurado');
    }
    
    const cantidadPiezas = document.getElementById('cantidadPiezas');
    const piezasPorLote = document.getElementById('piezasPorLote');
    if (cantidadPiezas) {
        cantidadPiezas.addEventListener('change', validarLote);
        console.log('✓ Event listener para cantidad de piezas configurado');
    }
    if (piezasPorLote) {
        piezasPorLote.addEventListener('change', validarLote);
        console.log('✓ Event listener para piezas por lote configurado');
    }
    
    // Verificar que GestionCotizaciones esté disponible
    if (typeof GestionCotizaciones !== 'undefined') {
        console.log('✅ GestionCotizaciones está disponible');
    } else {
        console.warn('⚠️ GestionCotizaciones no está disponible todavía');
    }
    
    console.log('✅ Módulo de cotización inicializado correctamente');
});

// ============================================
// EXPONER FUNCIONES GLOBALMENTE
// ============================================

// Asegurarse de que las funciones estén disponibles globalmente
window.calcularPrecio = calcularPrecio;
window.limpiarFormulario = limpiarFormulario;
window.toggleMarcaAgua = toggleMarcaAgua;
window.validarLote = validarLote;

console.log('📦 Funciones globales exportadas: calcularPrecio, limpiarFormulario, toggleMarcaAgua, validarLote');