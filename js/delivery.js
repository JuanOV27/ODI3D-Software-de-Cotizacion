// ============================================
// DELIVERY.JS - Módulo de Delivery/Domicilio
// Sistema de Gestión 3D
// ============================================

// Precios predefinidos
const PRECIOS_DELIVERY = {
    cerca: 3000,
    medio: 6000,
    lejos: 9000,
    personalizado: 0
};

// Estado del módulo
const EstadoDelivery = {
    requiere: false,
    tipo: 'cerca',
    costoBase: 3000,
    aplicarRecargo: false,
    porcentajeRecargo: 20,
    costoTotal: 0
};

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    inicializarEventosDelivery();
    console.log('✅ Módulo de delivery inicializado');
});

function inicializarEventosDelivery() {
    // Evento para checkbox de recargo
    const checkboxRecargo = document.getElementById('aplicarRecargoDelivery');
    if (checkboxRecargo) {
        checkboxRecargo.addEventListener('change', function() {
            const inputRecargo = document.getElementById('inputRecargoDelivery');
            if (inputRecargo) {
                inputRecargo.style.display = this.checked ? 'block' : 'none';
            }
            calcularCostoDelivery();
        });
    }
}

// ============================================
// TOGGLE MÓDULO
// ============================================

function toggleDelivery() {
    const checkbox = document.getElementById('requiereDelivery');
    const contenido = document.getElementById('contenidoDelivery');
    
    EstadoDelivery.requiere = checkbox.checked;
    
    if (checkbox.checked) {
        contenido.style.display = 'block';
        calcularCostoDelivery();
    } else {
        contenido.style.display = 'none';
        limpiarDatosDelivery();
    }
}

// ============================================
// CAMBIAR TIPO DE DELIVERY
// ============================================

function cambiarTipoDelivery(tipo) {
    EstadoDelivery.tipo = tipo;
    
    const inputPersonalizado = document.getElementById('inputCostoPersonalizado');
    
    if (tipo === 'personalizado') {
        inputPersonalizado.style.display = 'block';
        EstadoDelivery.costoBase = parseFloat(document.getElementById('costoDeliveryPersonalizado')?.value || 0);
    } else {
        inputPersonalizado.style.display = 'none';
        EstadoDelivery.costoBase = PRECIOS_DELIVERY[tipo];
    }
    
    calcularCostoDelivery();
}

// ============================================
// CALCULAR COSTO DE DELIVERY
// ============================================

function calcularCostoDelivery() {
    const requiere = document.getElementById('requiereDelivery')?.checked;
    
    if (!requiere) {
        actualizarResumenDelivery('N/A', 0, 0, 0);
        return;
    }
    
    // Obtener costo base según tipo
    let costoBase = EstadoDelivery.costoBase;
    
    if (EstadoDelivery.tipo === 'personalizado') {
        costoBase = parseFloat(document.getElementById('costoDeliveryPersonalizado')?.value || 0);
        EstadoDelivery.costoBase = costoBase;
    }
    
    // Aplicar recargo si está activo
    const aplicarRecargo = document.getElementById('aplicarRecargoDelivery')?.checked || false;
    let recargo = 0;
    let costoTotal = costoBase;
    
    if (aplicarRecargo) {
        const porcentaje = parseFloat(document.getElementById('porcentajeRecargoDelivery')?.value || 20);
        EstadoDelivery.porcentajeRecargo = porcentaje;
        recargo = costoBase * (porcentaje / 100);
        costoTotal = costoBase + recargo;
    }
    
    EstadoDelivery.aplicarRecargo = aplicarRecargo;
    EstadoDelivery.costoTotal = costoTotal;
    
    // Actualizar resumen
    const zonaLabels = {
        'cerca': 'Cerca',
        'medio': 'Medio',
        'lejos': 'Lejos',
        'personalizado': 'Personalizado'
    };
    
    const zonaLabel = zonaLabels[EstadoDelivery.tipo] || 'Cerca';
    actualizarResumenDelivery(zonaLabel, costoBase, recargo, costoTotal);
}

// ============================================
// ACTUALIZAR RESUMEN
// ============================================

function actualizarResumenDelivery(zona, costoBase, recargo, costoTotal) {
    document.getElementById('resumenZonaDelivery').textContent = zona;
    document.getElementById('resumenCostoBaseDelivery').textContent = '$' + formatearNumeroDelivery(costoBase);
    
    // Mostrar u ocultar fila de recargo
    const filaRecargo = document.getElementById('filaRecargoDelivery');
    const filaRecargoValor = document.getElementById('filaRecargoDeliveryValor');
    
    if (recargo > 0) {
        filaRecargo.style.display = 'block';
        filaRecargoValor.style.display = 'block';
        document.getElementById('porcentajeRecargoDisplay').textContent = EstadoDelivery.porcentajeRecargo;
        document.getElementById('resumenRecargoDelivery').textContent = '$' + formatearNumeroDelivery(recargo);
    } else {
        filaRecargo.style.display = 'none';
        filaRecargoValor.style.display = 'none';
    }
    
    document.getElementById('resumenCostoTotalDelivery').textContent = '$' + formatearNumeroDelivery(costoTotal);
}

// ============================================
// LIMPIAR DATOS
// ============================================

function limpiarDatosDelivery() {
    EstadoDelivery.requiere = false;
    EstadoDelivery.tipo = 'cerca';
    EstadoDelivery.costoBase = 3000;
    EstadoDelivery.aplicarRecargo = false;
    EstadoDelivery.porcentajeRecargo = 20;
    EstadoDelivery.costoTotal = 0;
    
    document.querySelector('input[name="tipoDelivery"][value="cerca"]').checked = true;
    document.getElementById('aplicarRecargoDelivery').checked = false;
    document.getElementById('porcentajeRecargoDelivery').value = '20';
    document.getElementById('costoDeliveryPersonalizado').value = '0';
    document.getElementById('inputCostoPersonalizado').style.display = 'none';
    document.getElementById('inputRecargoDelivery').style.display = 'none';
    
    actualizarResumenDelivery('Cerca', 3000, 0, 3000);
}

// ============================================
// OBTENER DATOS PARA ENVIAR AL BACKEND
// ============================================

function obtenerDatosDelivery() {
    const requiere = document.getElementById('requiereDelivery')?.checked || false;
    
    if (!requiere) {
        return {
            requiere_delivery: false,
            tipo_delivery: null,
            costo_delivery: 0,
            aplicar_recargo_delivery: false,
            porcentaje_recargo_delivery: 20,
            costo_delivery_total: 0
        };
    }
    
    return {
        requiere_delivery: true,
        tipo_delivery: EstadoDelivery.tipo,
        costo_delivery: EstadoDelivery.costoBase,
        aplicar_recargo_delivery: EstadoDelivery.aplicarRecargo,
        porcentaje_recargo_delivery: EstadoDelivery.porcentajeRecargo,
        costo_delivery_total: EstadoDelivery.costoTotal
    };
}

// ============================================
// UTILIDADES
// ============================================

function formatearNumeroDelivery(numero) {
    return parseFloat(numero).toLocaleString('es-CO', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });
}

window.toggleDelivery = toggleDelivery;
window.cambiarTipoDelivery = cambiarTipoDelivery;
window.calcularCostoDelivery = calcularCostoDelivery;
window.obtenerDatosDelivery = obtenerDatosDelivery;


console.log('🚚 delivery.js cargado');
