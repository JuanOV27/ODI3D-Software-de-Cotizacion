// ============================================
// PAQUETERIA.JS - Módulo de Paquetería
// Sistema de Gestión 3D
// ============================================

// Estado del módulo
const EstadoPaqueteria = {
    suministros: [],
    suministroSeleccionado: null,
    cantidadPaquetes: 0,
    costoTotal: 0
};

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    cargarSuministrosPaqueteria();
    console.log('✅ Módulo de paquetería inicializado');
});

// ============================================
// CARGAR SUMINISTROS DE PAQUETERÍA
// ============================================

async function cargarSuministrosPaqueteria() {
    try {
        const _apiBase = (typeof API_CONFIG !== 'undefined' ? API_CONFIG.baseURL : '/gestion3d/api');
        const response = await fetch(_apiBase + '/api_suministros.php?action=listar');
        const data = await response.json();
        
        if (data.success) {
            // Filtrar solo suministros de categoría "Paquetería"
            EstadoPaqueteria.suministros = data.suministros.filter(
                s => s.categoria.toLowerCase() === 'paqueteria' || 
                     s.categoria.toLowerCase() === 'paquetería'
            );
            
            renderizarSelectorPaqueteria();
            console.log(`✅ ${EstadoPaqueteria.suministros.length} suministros de paquetería cargados`);
        }
    } catch (error) {
        console.error('❌ Error al cargar suministros de paquetería:', error);
    }
}

// ============================================
// RENDERIZAR SELECTOR
// ============================================

function renderizarSelectorPaqueteria() {
    const selector = document.getElementById('suministroPaqueteria');
    if (!selector) return;
    
    // Limpiar opciones anteriores (excepto la primera)
    selector.innerHTML = '<option value="">-- Seleccionar caja o bolsa --</option>';
    
    // Agregar suministros
    EstadoPaqueteria.suministros.forEach(suministro => {
        const option = document.createElement('option');
        option.value = suministro.id;
        option.textContent = `${suministro.nombre} - $${formatearNumero(suministro.precio)} (Stock: ${suministro.unidades})`;
        option.dataset.precio = suministro.precio;
        option.dataset.stock = suministro.unidades;
        option.dataset.nombre = suministro.nombre;
        selector.appendChild(option);
    });
}

// ============================================
// TOGGLE MÓDULO
// ============================================

function togglePaqueteria() {
    const checkbox = document.getElementById('incluirPaqueteria');
    const contenido = document.getElementById('contenidoPaqueteria');
    
    if (checkbox.checked) {
        contenido.style.display = 'block';
        calcularPaquetesNecesarios();
    } else {
        contenido.style.display = 'none';
        limpiarDatosPaqueteria();
    }
}

// ============================================
// CARGAR DATOS DEL PAQUETE SELECCIONADO
// ============================================

function cargarDatosPaquete() {
    const selector = document.getElementById('suministroPaqueteria');
    const infoDiv = document.getElementById('infoPaqueteSeleccionado');
    
    if (!selector.value) {
        infoDiv.style.display = 'none';
        EstadoPaqueteria.suministroSeleccionado = null;
        calcularPaquetesNecesarios();
        return;
    }
    
    // Obtener datos de la opción seleccionada
    const option = selector.options[selector.selectedIndex];
    EstadoPaqueteria.suministroSeleccionado = {
        id: selector.value,
        nombre: option.dataset.nombre,
        precio: parseFloat(option.dataset.precio),
        stock: parseInt(option.dataset.stock)
    };
    
    // Mostrar información
    document.getElementById('precioUnitarioPaquete').textContent = 
        '$' + formatearNumero(EstadoPaqueteria.suministroSeleccionado.precio);
    document.getElementById('stockPaquete').textContent = 
        EstadoPaqueteria.suministroSeleccionado.stock;
    
    infoDiv.style.display = 'block';
    
    // Calcular paquetes necesarios
    calcularPaquetesNecesarios();
}

// ============================================
// CALCULAR PAQUETES NECESARIOS
// ============================================

function calcularPaquetesNecesarios() {
    const incluir = document.getElementById('incluirPaqueteria')?.checked;
    
    if (!incluir || !EstadoPaqueteria.suministroSeleccionado) {
        actualizarResumenPaqueteria(0, 0, 0);
        return;
    }
    
    // Obtener cantidad total de piezas
    const cantidadPiezas = parseInt(document.getElementById('cantidadPiezas')?.value || 1);
    const unidadesPorPaquete = parseInt(document.getElementById('unidadesPorPaquete')?.value || 1);
    
    // Calcular cantidad de paquetes necesarios (redondear hacia arriba)
    const cantidadPaquetes = Math.ceil(cantidadPiezas / unidadesPorPaquete);
    
    // Calcular costo total
    const costoTotal = cantidadPaquetes * EstadoPaqueteria.suministroSeleccionado.precio;
    
    // Guardar en estado
    EstadoPaqueteria.cantidadPaquetes = cantidadPaquetes;
    EstadoPaqueteria.costoTotal = costoTotal;
    
    // Actualizar resumen
    actualizarResumenPaqueteria(cantidadPiezas, cantidadPaquetes, costoTotal);
    
    // Verificar stock
    verificarStockPaquetes(cantidadPaquetes, EstadoPaqueteria.suministroSeleccionado.stock);
}

// ============================================
// ACTUALIZAR RESUMEN
// ============================================

function actualizarResumenPaqueteria(totalPiezas, paquetesNecesarios, costoTotal) {
    const elemPiezas = document.getElementById('resumenTotalPiezasPaq');
    if (elemPiezas) elemPiezas.textContent = totalPiezas;
    
    const elemPaquetes = document.getElementById('resumenPaquetesNecesarios');
    if (elemPaquetes) elemPaquetes.textContent = paquetesNecesarios;
    
    const elemCosto = document.getElementById('resumenCostoPaqueteria');
    if (elemCosto) elemCosto.textContent = '$' + formatearNumero(costoTotal);
}

window.actualizarResumenPaqueteria = actualizarResumenPaqueteria;

// ============================================
// VERIFICAR STOCK
// ============================================

function verificarStockPaquetes(requeridos, disponibles) {
    const advertencia = document.getElementById('advertenciaStockPaquetes');
    
    if (requeridos > disponibles) {
        document.getElementById('paquetesRequeridos').textContent = requeridos;
        document.getElementById('paquetesDisponibles').textContent = disponibles;
        advertencia.style.display = 'block';
    } else {
        advertencia.style.display = 'none';
    }
}

// ============================================
// LIMPIAR DATOS
// ============================================

function limpiarDatosPaqueteria() {
    document.getElementById('suministroPaqueteria').value = '';
    document.getElementById('unidadesPorPaquete').value = '1';
    document.getElementById('infoPaqueteSeleccionado').style.display = 'none';
    EstadoPaqueteria.suministroSeleccionado = null;
    EstadoPaqueteria.cantidadPaquetes = 0;
    EstadoPaqueteria.costoTotal = 0;
    actualizarResumenPaqueteria(0, 0, 0);
}

// ============================================
// OBTENER DATOS PARA ENVIAR AL BACKEND
// ============================================

function obtenerDatosPaqueteria() {
    const incluir = document.getElementById('incluirPaqueteria')?.checked || false;
    
    if (!incluir || !EstadoPaqueteria.suministroSeleccionado) {
        return {
            incluir_paqueteria: false,
            suministro_paqueteria_id: null,
            unidades_por_paquete: 1,
            cantidad_paquetes_necesarios: 0,
            costo_total_paqueteria: 0
        };
    }
    
    return {
        incluir_paqueteria: true,
        suministro_paqueteria_id: EstadoPaqueteria.suministroSeleccionado.id,
        nombre_paquete: EstadoPaqueteria.suministroSeleccionado.nombre,
        precio_unitario_paquete: EstadoPaqueteria.suministroSeleccionado.precio,
        unidades_por_paquete: parseInt(document.getElementById('unidadesPorPaquete')?.value || 1),
        cantidad_paquetes_necesarios: EstadoPaqueteria.cantidadPaquetes,
        costo_total_paqueteria: EstadoPaqueteria.costoTotal
    };
}

// ============================================
// UTILIDADES
// ============================================

function formatearNumero(numero) {
    return parseFloat(numero).toLocaleString('es-CO', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });
}

// ============================================
// INTEGRACIÓN CON CANTIDAD DE PIEZAS
// ============================================

// Escuchar cambios en cantidad de piezas para recalcular
document.addEventListener('DOMContentLoaded', function() {
    const cantidadPiezasInput = document.getElementById('cantidadPiezas');
    if (cantidadPiezasInput) {
        cantidadPiezasInput.addEventListener('input', function() {
            if (document.getElementById('incluirPaqueteria')?.checked) {
                calcularPaquetesNecesarios();
            }
        });
    }
});

console.log('📦 paqueteria.js cargado');
