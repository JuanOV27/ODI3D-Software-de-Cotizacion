// ============================================
// MÓDULO DE POSTPROCESADO - JAVASCRIPT
// ============================================

const EstadoPostprocesado = {
    activo: false,
    nivelDificultad: null,
    costoManoObra: 0,
    insumosSeleccionados: [],
    suministrosDisponibles: [],
    insumosFaltantes: []
};

// Rangos de costo de mano de obra por nivel
const NIVELES_DIFICULTAD = {
    facil: { min: 15000, max: 30000, label: 'Fácil' },
    intermedio: { min: 45000, max: 60000, label: 'Intermedio' },
    dificil: { min: 75000, max: 90000, label: 'Difícil' }
};

// ============================================
// INICIALIZACIÓN DEL MÓDULO
// ============================================

function inicializarModuloPostprocesado() {
    console.log('🎨 Inicializando módulo de postprocesado');
    
    // Cargar suministros disponibles
    cargarSuministrosParaPostprocesado();
    
    // Event listeners
    const checkboxPostprocesado = document.getElementById('incluirPostprocesado');
    if (checkboxPostprocesado) {
        checkboxPostprocesado.addEventListener('change', togglePostprocesado);
    }
    
    const selectNivel = document.getElementById('nivelDificultadPostprocesado');
    if (selectNivel) {
        selectNivel.addEventListener('change', cambiarNivelDificultad);
    }
    
    const inputCostoManoObra = document.getElementById('costoManoObraPostprocesado');
    if (inputCostoManoObra) {
        inputCostoManoObra.addEventListener('input', actualizarCostoManoObra);
    }
}

// ============================================
// CARGAR SUMINISTROS DISPONIBLES
// ============================================

async function cargarSuministrosParaPostprocesado() {
    try {
        // Usar la configuración de API existente
        const baseURL = API_CONFIG?.baseURL || 'api';
        const response = await fetch(`${baseURL}/api_suministros.php?action=listar`);
        const data = await response.json();
        
        if (data.success) {
            EstadoPostprocesado.suministrosDisponibles = data.suministros || [];
            console.log(`✅ ${EstadoPostprocesado.suministrosDisponibles.length} suministros cargados`);
        }
    } catch (error) {
        console.error('❌ Error al cargar suministros:', error);
        // No mostrar alerta, solo log
        EstadoPostprocesado.suministrosDisponibles = [];
    }
}

// ============================================
// TOGGLE POSTPROCESADO
// ============================================

function togglePostprocesado(event) {
    const activar = event.target.checked;
    EstadoPostprocesado.activo = activar;
    
    const contenedor = document.getElementById('contenedorPostprocesado');
    if (contenedor) {
        contenedor.style.display = activar ? 'block' : 'none';
    }
    
    if (!activar) {
        // Limpiar datos
        EstadoPostprocesado.nivelDificultad = null;
        EstadoPostprocesado.costoManoObra = 0;
        EstadoPostprocesado.insumosSeleccionados = [];
        EstadoPostprocesado.insumosFaltantes = [];
    }
    
    // NO llamar a actualizarCalculos - esto se hace en cotizacion.js
}

// ============================================
// CAMBIAR NIVEL DE DIFICULTAD
// ============================================

function cambiarNivelDificultad(event) {
    const nivel = event.target.value;
    EstadoPostprocesado.nivelDificultad = nivel;
    
    if (nivel && NIVELES_DIFICULTAD[nivel]) {
        const rango = NIVELES_DIFICULTAD[nivel];
        const costoPromedio = (rango.min + rango.max) / 2;
        
        // Actualizar el input de costo de mano de obra
        const inputCosto = document.getElementById('costoManoObraPostprocesado');
        if (inputCosto) {
            inputCosto.value = costoPromedio;
            inputCosto.min = rango.min;
            inputCosto.max = rango.max;
        }
        
        EstadoPostprocesado.costoManoObra = costoPromedio;
        
        // Mostrar info del rango
        const infoRango = document.getElementById('infoRangoManoObra');
        if (infoRango) {
            infoRango.textContent = `Rango: ${formatearMoneda(rango.min)} - ${formatearMoneda(rango.max)}`;
        }
    }
    
    // NO llamar a actualizarCalculos - esto se hace en cotizacion.js
}

// ============================================
// ACTUALIZAR COSTO DE MANO DE OBRA
// ============================================

function actualizarCostoManoObra(event) {
    const valor = parseFloat(event.target.value) || 0;
    EstadoPostprocesado.costoManoObra = valor;
    // NO llamar a actualizarCalculos - esto se hace en cotizacion.js
}

// ============================================
// RENDERIZAR SELECTOR DE INSUMOS
// ============================================

function renderizarSelectorInsumos() {
    const contenedor = document.getElementById('contenedorInsumosPostprocesado');
    if (!contenedor) return;
    
    let html = `
        <div class="insumos-postprocesado">
            <div class="form-group">
                <label>
                    <span style="display: flex; align-items: center; gap: 8px;">
                        <span>🔍 Buscar Insumos</span>
                        <button type="button" class="btn-small" onclick="mostrarModalSeleccionInsumos()" 
                                style="padding: 4px 12px; font-size: 0.85rem;">
                            Seleccionar
                        </button>
                    </span>
                </label>
            </div>
            
            <div id="insumosSeleccionadosLista" class="insumos-seleccionados-lista">
                ${renderizarInsumosSeleccionados()}
            </div>
            
            ${renderizarInsumosFaltantes()}
        </div>
    `;
    
    contenedor.innerHTML = html;
}

// ============================================
// RENDERIZAR INSUMOS SELECCIONADOS
// ============================================

function renderizarInsumosSeleccionados() {
    if (EstadoPostprocesado.insumosSeleccionados.length === 0) {
        return '<p style="color: #9ca3af; font-style: italic;">No hay insumos seleccionados</p>';
    }
    
    let html = '<div class="lista-insumos">';
    
    EstadoPostprocesado.insumosSeleccionados.forEach((insumo, index) => {
        const costoTotal = calcularCostoInsumo(insumo);
        
        html += `
            <div class="insumo-item" style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin-bottom: 10px; background: #f9fafb;">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div style="flex: 1;">
                        <strong style="color: #1f2937;">${insumo.nombre}</strong>
                        <div style="font-size: 0.85rem; color: #6b7280; margin-top: 4px;">
                            <span>Precio unitario: ${formatearMoneda(insumo.precio)}</span>
                            ${insumo.unidad_medida ? ` | ${insumo.unidad_medida}` : ''}
                        </div>
                    </div>
                    <button type="button" onclick="eliminarInsumoPostprocesado(${index})" 
                            class="btn-eliminar-mini" 
                            style="background: #ef4444; color: white; border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer;">
                        ✕
                    </button>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px;">
                    <div>
                        <label style="font-size: 0.8rem; color: #6b7280;">Cantidad/Unidades</label>
                        <input type="number" 
                               value="${insumo.cantidad_requerida || 1}" 
                               min="0.01" 
                               step="0.01"
                               onchange="actualizarCantidadInsumo(${index}, this.value)"
                               style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px;">
                    </div>
                    <div>
                        <label style="font-size: 0.8rem; color: #6b7280;">% de Uso (si &lt; 1 unidad)</label>
                        <input type="number" 
                               value="${insumo.porcentaje_uso || 100}" 
                               min="1" 
                               max="100"
                               step="1"
                               onchange="actualizarPorcentajeInsumo(${index}, this.value)"
                               style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px;">
                    </div>
                </div>
                
                <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e5e7eb;">
                    <strong style="color: #059669;">Costo Total: ${formatearMoneda(costoTotal)}</strong>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    
    return html;
}

// ============================================
// RENDERIZAR INSUMOS FALTANTES
// ============================================

function renderizarInsumosFaltantes() {
    if (EstadoPostprocesado.insumosFaltantes.length === 0) {
        return '';
    }
    
    let html = `
        <div class="alerta-insumos-faltantes" style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 12px; margin-top: 15px;">
            <h4 style="color: #92400e; margin: 0 0 10px 0;">⚠️ Insumos Faltantes</h4>
            <p style="color: #78350f; font-size: 0.9rem; margin-bottom: 10px;">
                Los siguientes insumos no tienen suficiente stock en inventario:
            </p>
            <div class="lista-faltantes">
    `;
    
    EstadoPostprocesado.insumosFaltantes.forEach(faltante => {
        html += `
            <div style="background: white; padding: 8px; border-radius: 4px; margin-bottom: 8px;">
                <strong>${faltante.nombre}</strong><br>
                <span style="font-size: 0.85rem; color: #6b7280;">
                    Disponible: ${faltante.disponible} | 
                    Requerido: ${faltante.requerido} | 
                    <span style="color: #dc2626; font-weight: 600;">
                        Falta: ${faltante.faltante}
                    </span>
                </span><br>
                <span style="font-size: 0.85rem; color: #059669; font-weight: 600;">
                    Costo compra faltante: ${formatearMoneda(faltante.costo_faltante)}
                </span>
            </div>
        `;
    });
    
    const costoTotalFaltante = EstadoPostprocesado.insumosFaltantes.reduce((sum, f) => sum + f.costo_faltante, 0);
    
    html += `
            </div>
            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #fbbf24;">
                <strong style="color: #92400e;">Costo Total de Compra: ${formatearMoneda(costoTotalFaltante)}</strong>
            </div>
        </div>
    `;
    
    return html;
}

// ============================================
// MODAL DE SELECCIÓN DE INSUMOS
// ============================================

function mostrarModalSeleccionInsumos() {
    const modal = document.createElement('div');
    modal.id = 'modalSeleccionInsumos';
    modal.className = 'modal-overlay';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;';
    
    const contenido = document.createElement('div');
    contenido.className = 'modal-content';
    contenido.style.cssText = 'background: white; border-radius: 12px; padding: 24px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto;';
    
    contenido.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3 style="margin: 0;">🔍 Seleccionar Insumos</h3>
            <button onclick="cerrarModalSeleccionInsumos()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #6b7280;">&times;</button>
        </div>
        
        <div style="margin-bottom: 15px;">
            <input type="text" 
                   id="buscarInsumoPostprocesado" 
                   placeholder="Buscar por nombre..." 
                   oninput="filtrarInsumosPostprocesado(this.value)"
                   style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px;">
        </div>
        
        <div id="listaInsumosModal" style="max-height: 400px; overflow-y: auto;">
            ${renderizarListaInsumosModal()}
        </div>
        
        <div style="margin-top: 20px; text-align: right;">
            <button onclick="cerrarModalSeleccionInsumos()" class="btn-secondary" style="padding: 10px 20px; background: #6b7280; color: white; border: none; border-radius: 6px; cursor: pointer;">
                Cerrar
            </button>
        </div>
    `;
    
    modal.appendChild(contenido);
    document.body.appendChild(modal);
}

function renderizarListaInsumosModal() {
    if (EstadoPostprocesado.suministrosDisponibles.length === 0) {
        return '<p style="color: #9ca3af; text-align: center; padding: 20px;">No hay suministros disponibles</p>';
    }
    
    let html = '';
    
    EstadoPostprocesado.suministrosDisponibles.forEach(suministro => {
        const yaSeleccionado = EstadoPostprocesado.insumosSeleccionados.some(i => i.id === suministro.id);
        const stockInfo = suministro.unidades > 0 ? 
            `<span style="color: #059669;">Stock: ${suministro.unidades} ${suministro.unidad_medida || 'unidades'}</span>` :
            `<span style="color: #dc2626;">Sin stock</span>`;
        
        html += `
            <div class="insumo-modal-item" style="border: 1px solid ${yaSeleccionado ? '#10b981' : '#e5e7eb'}; border-radius: 8px; padding: 12px; margin-bottom: 10px; ${yaSeleccionado ? 'background: #d1fae5;' : ''}">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex: 1;">
                        <strong>${suministro.nombre}</strong>
                        <div style="font-size: 0.85rem; color: #6b7280; margin-top: 4px;">
                            ${suministro.categoria ? `📦 ${suministro.categoria} | ` : ''}
                            ${stockInfo} | 
                            <strong>${formatearMoneda(suministro.precio)}</strong>
                        </div>
                    </div>
                    <button type="button" 
                            onclick="agregarInsumoPostprocesado('${suministro.id}')"
                            ${yaSeleccionado ? 'disabled' : ''}
                            style="padding: 6px 12px; border-radius: 6px; border: none; cursor: ${yaSeleccionado ? 'not-allowed' : 'pointer'}; background: ${yaSeleccionado ? '#9ca3af' : '#4f46e5'}; color: white;">
                        ${yaSeleccionado ? '✓ Agregado' : '+ Agregar'}
                    </button>
                </div>
            </div>
        `;
    });
    
    return html;
}

function filtrarInsumosPostprocesado(texto) {
    const listaModal = document.getElementById('listaInsumosModal');
    if (!listaModal) return;
    
    const filtrado = EstadoPostprocesado.suministrosDisponibles.filter(s => 
        s.nombre.toLowerCase().includes(texto.toLowerCase()) ||
        (s.categoria && s.categoria.toLowerCase().includes(texto.toLowerCase()))
    );
    
    // Temporalmente reemplazar la lista
    const temp = EstadoPostprocesado.suministrosDisponibles;
    EstadoPostprocesado.suministrosDisponibles = filtrado;
    listaModal.innerHTML = renderizarListaInsumosModal();
    EstadoPostprocesado.suministrosDisponibles = temp;
}

function cerrarModalSeleccionInsumos() {
    const modal = document.getElementById('modalSeleccionInsumos');
    if (modal) {
        modal.remove();
    }
}

// ============================================
// AGREGAR/ELIMINAR INSUMOS
// ============================================

function agregarInsumoPostprocesado(suministroId) {
    const suministro = EstadoPostprocesado.suministrosDisponibles.find(s => s.id === suministroId);
    if (!suministro) return;
    
    // Verificar si ya está agregado
    if (EstadoPostprocesado.insumosSeleccionados.some(i => i.id === suministroId)) {
        return;
    }
    
    // Agregar con valores por defecto
    EstadoPostprocesado.insumosSeleccionados.push({
        id: suministro.id,
        nombre: suministro.nombre,
        precio: parseFloat(suministro.precio) || 0,
        unidades_disponibles: parseFloat(suministro.unidades) || 0,
        unidad_medida: suministro.unidad_medida || '',
        cantidad_requerida: 1,
        porcentaje_uso: 100
    });
    
    renderizarSelectorInsumos();
    verificarDisponibilidadInsumos();
    // NO llamar a actualizarCalculos
    
    // Actualizar modal si está abierto
    const listaModal = document.getElementById('listaInsumosModal');
    if (listaModal) {
        listaModal.innerHTML = renderizarListaInsumosModal();
    }
}

function eliminarInsumoPostprocesado(index) {
    EstadoPostprocesado.insumosSeleccionados.splice(index, 1);
    renderizarSelectorInsumos();
    verificarDisponibilidadInsumos();
    // NO llamar a actualizarCalculos
}

function actualizarCantidadInsumo(index, valor) {
    const cantidad = parseFloat(valor) || 0;
    if (EstadoPostprocesado.insumosSeleccionados[index]) {
        EstadoPostprocesado.insumosSeleccionados[index].cantidad_requerida = cantidad;
        renderizarSelectorInsumos();
        verificarDisponibilidadInsumos();
        // NO llamar a actualizarCalculos
    }
}

function actualizarPorcentajeInsumo(index, valor) {
    const porcentaje = Math.min(100, Math.max(1, parseFloat(valor) || 100));
    if (EstadoPostprocesado.insumosSeleccionados[index]) {
        EstadoPostprocesado.insumosSeleccionados[index].porcentaje_uso = porcentaje;
        renderizarSelectorInsumos();
        // NO llamar a actualizarCalculos
    }
}

// ============================================
// CÁLCULOS
// ============================================

function calcularCostoInsumo(insumo) {
    const cantidad = insumo.cantidad_requerida || 0;
    const porcentaje = (insumo.porcentaje_uso || 100) / 100;
    
    // Si la cantidad es menor a 1, usar el porcentaje
    if (cantidad < 1) {
        return insumo.precio * porcentaje;
    }
    
    // Si es 1 o más unidades completas
    return insumo.precio * cantidad;
}

function calcularCostoTotalInsumos() {
    return EstadoPostprocesado.insumosSeleccionados.reduce((total, insumo) => {
        return total + calcularCostoInsumo(insumo);
    }, 0);
}

function verificarDisponibilidadInsumos() {
    EstadoPostprocesado.insumosFaltantes = [];
    
    EstadoPostprocesado.insumosSeleccionados.forEach(insumo => {
        const disponible = insumo.unidades_disponibles || 0;
        const requerido = insumo.cantidad_requerida || 0;
        
        if (requerido > disponible) {
            const faltante = requerido - disponible;
            const costoFaltante = faltante * insumo.precio;
            
            EstadoPostprocesado.insumosFaltantes.push({
                id: insumo.id,
                nombre: insumo.nombre,
                disponible: disponible,
                requerido: requerido,
                faltante: faltante,
                costo_faltante: costoFaltante
            });
        }
    });
    
    renderizarSelectorInsumos();
}

function obtenerDatosPostprocesado() {
    if (!EstadoPostprocesado.activo) {
        return {
            incluir_postprocesado: false,
            nivel_dificultad: null,
            costo_mano_obra: 0,
            insumos: [],
            costo_total_insumos: 0,
            costo_total_postprocesado: 0
        };
    }
    
    const costoInsumos = calcularCostoTotalInsumos();
    const costoManoObra = EstadoPostprocesado.costoManoObra || 0;
    
    return {
        incluir_postprocesado: true,
        nivel_dificultad: EstadoPostprocesado.nivelDificultad,
        costo_mano_obra: costoManoObra,
        insumos: EstadoPostprocesado.insumosSeleccionados.map(insumo => ({
            suministro_id: insumo.id,
            nombre: insumo.nombre,
            cantidad_requerida: insumo.cantidad_requerida,
            porcentaje_uso: insumo.porcentaje_uso,
            precio_unitario: insumo.precio,
            costo_total: calcularCostoInsumo(insumo)
        })),
        costo_total_insumos: costoInsumos,
        costo_total_postprocesado: costoManoObra + costoInsumos,
        insumos_faltantes: EstadoPostprocesado.insumosFaltantes
    };
}

// ============================================
// UTILIDADES
// ============================================

function formatearMoneda(valor) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(valor || 0);
}

// ============================================
// EXPORTAR FUNCIONES (para uso global)
// ============================================

window.EstadoPostprocesado = EstadoPostprocesado;
window.inicializarModuloPostprocesado = inicializarModuloPostprocesado;
window.togglePostprocesado = togglePostprocesado;
window.cambiarNivelDificultad = cambiarNivelDificultad;
window.actualizarCostoManoObra = actualizarCostoManoObra;
window.mostrarModalSeleccionInsumos = mostrarModalSeleccionInsumos;
window.cerrarModalSeleccionInsumos = cerrarModalSeleccionInsumos;
window.agregarInsumoPostprocesado = agregarInsumoPostprocesado;
window.eliminarInsumoPostprocesado = eliminarInsumoPostprocesado;
window.actualizarCantidadInsumo = actualizarCantidadInsumo;
window.actualizarPorcentajeInsumo = actualizarPorcentajeInsumo;
window.filtrarInsumosPostprocesado = filtrarInsumosPostprocesado;
window.obtenerDatosPostprocesado = obtenerDatosPostprocesado;
window.renderizarSelectorInsumos = renderizarSelectorInsumos;

console.log('✅ Módulo de postprocesado cargado correctamente');