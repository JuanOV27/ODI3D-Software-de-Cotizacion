// ============================================
// MAQUINAS.JS - Centro de Fabricación
// Sistema de Gestión 3D
// ============================================

// ============================================
// ESTADO GLOBAL
// ============================================

const EstadoMaquinas = {
    maquinas: [],
    maquinaEditando: null,
    estadisticas: {
        total: 0,
        activas: 0,
        horasTotales: 0,
        valorTotal: 0
    }
};

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🏭 Centro de Fabricación inicializado');
    cargarMaquinas();
});

// ============================================
// CARGA DE DATOS
// ============================================

async function cargarMaquinas() {
    try {
        const maquinas = await GestionMaquinas.obtenerTodas();
        EstadoMaquinas.maquinas = maquinas;
        
        actualizarDashboard();
        renderizarTablaMaquinas();
        
        console.log(`✅ ${maquinas.length} máquinas cargadas`);
    } catch (error) {
        console.error('❌ Error al cargar máquinas:', error);
        mostrarNotificacion('Error al cargar las máquinas', 'error');
    }
}

function actualizarListaMaquinas() {
    cargarMaquinas();
    mostrarNotificacion('Lista actualizada correctamente', 'success');
}

// ============================================
// ACTUALIZAR DASHBOARD
// ============================================

function actualizarDashboard() {
    const maquinas = EstadoMaquinas.maquinas;
    
    // Calcular estadísticas
    const total = maquinas.length;
    const activas = maquinas.filter(m => m.activa).length;
    const horasTotales = maquinas.reduce((sum, m) => sum + parseFloat(m.horas_uso_total || 0), 0);
    const valorTotal = maquinas.reduce((sum, m) => {
        const depreciacionAcumulada = parseFloat(m.horas_uso_total || 0) * parseFloat(m.depreciacion_por_hora || 0);
        return sum + (parseFloat(m.costo_adquisicion) - depreciacionAcumulada);
    }, 0);
    
    // Actualizar estado global
    EstadoMaquinas.estadisticas = {
        total,
        activas,
        horasTotales,
        valorTotal
    };
    
    // Actualizar DOM
    document.getElementById('totalMaquinas').textContent = total;
    document.getElementById('maquinasActivas').textContent = activas;
    document.getElementById('horasTotales').textContent = `${horasTotales.toFixed(1)}h`;
    document.getElementById('valorTotal').textContent = `$${formatearNumero(valorTotal)}`;
}

// ============================================
// RENDERIZAR TABLA DE MÁQUINAS
// ============================================

function renderizarTablaMaquinas() {
    const tbody = document.getElementById('maquinasTableBody');
    const maquinas = EstadoMaquinas.maquinas;
    
    if (maquinas.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 40px; color: #6b7280;">
                    No hay máquinas registradas. 
                    <a href="#" onclick="mostrarModalMaquina(); return false;" 
                       style="color: #0ea5e9; text-decoration: underline;">
                        Agregar primera máquina
                    </a>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = maquinas.map(m => {
        const depreciacionAcumulada = parseFloat(m.horas_uso_total || 0) * parseFloat(m.depreciacion_por_hora || 0);
        const valorActual = parseFloat(m.costo_adquisicion) - depreciacionAcumulada;
        const porcentajeVidaUsado = (parseFloat(m.horas_uso_total || 0) / parseFloat(m.vida_util_horas)) * 100;
        
        return `
            <tr>
                <td>
                    <span class="badge ${m.activa ? 'badge-activa' : 'badge-inactiva'}">
                        ${m.activa ? '✅ Activa' : '⏸️ Inactiva'}
                    </span>
                </td>
                <td><strong>${m.nombre}</strong></td>
                <td>${m.modelo || '-'}</td>
                <td>
                    <span class="badge badge-tipo">${m.tipo}</span>
                </td>
                <td>$${formatearNumero(m.depreciacion_por_hora)}</td>
                <td>
                    ${parseFloat(m.horas_uso_total || 0).toFixed(1)}h
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${Math.min(porcentajeVidaUsado, 100)}%"></div>
                    </div>
                    <small style="color: #6b7280;">${porcentajeVidaUsado.toFixed(1)}% usado</small>
                </td>
                <td>
                    <strong style="color: ${valorActual > 0 ? '#10b981' : '#ef4444'};">
                        $${formatearNumero(valorActual)}
                    </strong>
                </td>
                <td>${formatearNumero(m.vida_util_horas)}h</td>
                <td>
                    <div class="action-btns">
                        <button class="btn-icon btn-info" onclick="verDetallesMaquina('${m.id}')" 
                                title="Ver detalles">
                            👁️
                        </button>
                        <button class="btn-icon btn-edit" onclick="editarMaquina('${m.id}')" 
                                title="Editar">
                            ✏️
                        </button>
                        <button class="btn-icon btn-delete" onclick="confirmarEliminarMaquina('${m.id}')" 
                                title="Eliminar">
                            🗑️
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// ============================================
// MODAL: AGREGAR/EDITAR MÁQUINA
// ============================================

function mostrarModalMaquina(id = null) {
    const modal = document.getElementById('modalMaquina');
    const form = document.getElementById('formMaquina');
    const titulo = document.getElementById('modalTitulo');
    
    // Resetear formulario
    form.reset();
    document.getElementById('maquinaId').value = '';
    EstadoMaquinas.maquinaEditando = null;
    
    if (id) {
        // Modo edición
        const maquina = EstadoMaquinas.maquinas.find(m => m.id === id);
        if (!maquina) {
            mostrarNotificacion('Máquina no encontrada', 'error');
            return;
        }
        
        EstadoMaquinas.maquinaEditando = maquina;
        titulo.textContent = '✏️ Editar Máquina';
        
        // Llenar formulario
        document.getElementById('maquinaId').value = maquina.id;
        document.getElementById('nombreMaquina').value = maquina.nombre;
        document.getElementById('modeloMaquina').value = maquina.modelo || '';
        document.getElementById('tipoMaquina').value = maquina.tipo;
        document.getElementById('fechaAdquisicion').value = maquina.fecha_adquisicion || '';
        document.getElementById('costoAdquisicion').value = maquina.costo_adquisicion;
        document.getElementById('vidaUtilHoras').value = maquina.vida_util_horas;
        document.getElementById('depreciacionPorHora').value = maquina.depreciacion_por_hora;
        document.getElementById('horasUsoTotal').value = maquina.horas_uso_total || 0;
        document.getElementById('volumenX').value = maquina.volumen_construccion_x || '';
        document.getElementById('volumenY').value = maquina.volumen_construccion_y || '';
        document.getElementById('volumenZ').value = maquina.volumen_construccion_z || '';
        document.getElementById('velocidadMax').value = maquina.velocidad_max || '';
        document.getElementById('numExtrusores').value = maquina.num_extrusores || 1;
        document.getElementById('maquinaActiva').checked = maquina.activa;
        document.getElementById('notasMaquina').value = maquina.notas || '';
    } else {
        // Modo creación
        titulo.textContent = '➕ Agregar Nueva Máquina';
        document.getElementById('maquinaActiva').checked = true;
        document.getElementById('vidaUtilHoras').value = 5000;
        document.getElementById('numExtrusores').value = 1;
        document.getElementById('horasUsoTotal').value = 0;
    }
    
    modal.style.display = 'flex';
}

function cerrarModalMaquina() {
    document.getElementById('modalMaquina').style.display = 'none';
    EstadoMaquinas.maquinaEditando = null;
}

// Calcular depreciación automáticamente
function calcularDepreciacion() {
    const costoAdquisicion = parseFloat(document.getElementById('costoAdquisicion').value) || 0;
    const vidaUtilHoras = parseFloat(document.getElementById('vidaUtilHoras').value) || 1;
    
    if (costoAdquisicion > 0 && vidaUtilHoras > 0) {
        const depreciacion = costoAdquisicion / vidaUtilHoras;
        document.getElementById('depreciacionPorHora').value = depreciacion.toFixed(4);
    }
}

// ============================================
// GUARDAR MÁQUINA
// ============================================

async function guardarMaquina(event) {
    event.preventDefault();
    
    const id = document.getElementById('maquinaId').value;
    const datos = {
        nombre: document.getElementById('nombreMaquina').value.trim(),
        modelo: document.getElementById('modeloMaquina').value.trim() || null,
        tipo: document.getElementById('tipoMaquina').value,
        fecha_adquisicion: document.getElementById('fechaAdquisicion').value || null,
        costo_adquisicion: parseFloat(document.getElementById('costoAdquisicion').value),
        vida_util_horas: parseInt(document.getElementById('vidaUtilHoras').value),
        depreciacion_por_hora: parseFloat(document.getElementById('depreciacionPorHora').value),
        horas_uso_total: parseFloat(document.getElementById('horasUsoTotal').value) || 0,
        volumen_construccion_x: parseFloat(document.getElementById('volumenX').value) || null,
        volumen_construccion_y: parseFloat(document.getElementById('volumenY').value) || null,
        volumen_construccion_z: parseFloat(document.getElementById('volumenZ').value) || null,
        velocidad_max: parseFloat(document.getElementById('velocidadMax').value) || null,
        num_extrusores: parseInt(document.getElementById('numExtrusores').value) || 1,
        activa: document.getElementById('maquinaActiva').checked,
        notas: document.getElementById('notasMaquina').value.trim() || null
    };
    
    try {
        if (id) {
            // Actualizar
            await GestionMaquinas.actualizar(id, datos);
            mostrarNotificacion('Máquina actualizada correctamente', 'success');
        } else {
            // Crear
            await GestionMaquinas.crear(datos);
            mostrarNotificacion('Máquina creada correctamente', 'success');
        }
        
        cerrarModalMaquina();
        await cargarMaquinas();
        
    } catch (error) {
        console.error('❌ Error al guardar máquina:', error);
        mostrarNotificacion('Error al guardar la máquina', 'error');
    }
}

// ============================================
// VER DETALLES DE MÁQUINA
// ============================================

function verDetallesMaquina(id) {
    const maquina = EstadoMaquinas.maquinas.find(m => m.id === id);
    if (!maquina) {
        mostrarNotificacion('Máquina no encontrada', 'error');
        return;
    }
    
    const depreciacionAcumulada = parseFloat(maquina.horas_uso_total || 0) * parseFloat(maquina.depreciacion_por_hora);
    const valorActual = parseFloat(maquina.costo_adquisicion) - depreciacionAcumulada;
    const porcentajeVidaUsado = (parseFloat(maquina.horas_uso_total || 0) / parseFloat(maquina.vida_util_horas)) * 100;
    const horasRestantes = parseFloat(maquina.vida_util_horas) - parseFloat(maquina.horas_uso_total || 0);
    
    const contenido = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
            <!-- Información Básica -->
            <div style="background: #f9fafb; padding: 20px; border-radius: 12px;">
                <h3 style="margin-bottom: 15px; color: #1f2937;">📝 Información Básica</h3>
                <p><strong>Nombre:</strong> ${maquina.nombre}</p>
                <p><strong>Modelo:</strong> ${maquina.modelo || '-'}</p>
                <p><strong>Tipo:</strong> <span class="badge badge-tipo">${maquina.tipo}</span></p>
                <p><strong>Estado:</strong> ${maquina.activa ? 
                    '<span class="badge badge-activa">✅ Activa</span>' : 
                    '<span class="badge badge-inactiva">⏸️ Inactiva</span>'}
                </p>
                <p><strong>Fecha de Adquisición:</strong> ${maquina.fecha_adquisicion || '-'}</p>
            </div>
            
            <!-- Costos y Depreciación -->
            <div style="background: #f9fafb; padding: 20px; border-radius: 12px;">
                <h3 style="margin-bottom: 15px; color: #1f2937;">💰 Costos</h3>
                <p><strong>Costo de Adquisición:</strong> $${formatearNumero(maquina.costo_adquisicion)}</p>
                <p><strong>Depreciación/hora:</strong> $${formatearNumero(maquina.depreciacion_por_hora)}</p>
                <p><strong>Depreciación Acumulada:</strong> $${formatearNumero(depreciacionAcumulada)}</p>
                <p><strong>Valor Actual:</strong> 
                    <span style="color: ${valorActual > 0 ? '#10b981' : '#ef4444'}; font-weight: 700;">
                        $${formatearNumero(valorActual)}
                    </span>
                </p>
            </div>
            
            <!-- Uso y Vida Útil -->
            <div style="background: #f9fafb; padding: 20px; border-radius: 12px;">
                <h3 style="margin-bottom: 15px; color: #1f2937;">⏱️ Uso y Vida Útil</h3>
                <p><strong>Vida Útil Total:</strong> ${formatearNumero(maquina.vida_util_horas)}h</p>
                <p><strong>Horas Usadas:</strong> ${parseFloat(maquina.horas_uso_total || 0).toFixed(1)}h</p>
                <p><strong>Horas Restantes:</strong> ${horasRestantes.toFixed(1)}h</p>
                <p><strong>Vida Útil Usada:</strong> ${porcentajeVidaUsado.toFixed(1)}%</p>
                <div class="progress-bar" style="margin-top: 10px;">
                    <div class="progress-fill" style="width: ${Math.min(porcentajeVidaUsado, 100)}%"></div>
                </div>
            </div>
            
            <!-- Especificaciones Técnicas -->
            <div style="background: #f9fafb; padding: 20px; border-radius: 12px;">
                <h3 style="margin-bottom: 15px; color: #1f2937;">⚙️ Especificaciones</h3>
                <p><strong>Volumen de Construcción:</strong> 
                    ${maquina.volumen_construccion_x || '-'} × 
                    ${maquina.volumen_construccion_y || '-'} × 
                    ${maquina.volumen_construccion_z || '-'} mm
                </p>
                <p><strong>Velocidad Máxima:</strong> ${maquina.velocidad_max || '-'} mm/s</p>
                <p><strong>Número de Extrusores:</strong> ${maquina.num_extrusores}</p>
            </div>
        </div>
        
        ${maquina.notas ? `
            <div style="background: #f9fafb; padding: 20px; border-radius: 12px; margin-top: 20px;">
                <h3 style="margin-bottom: 10px; color: #1f2937;">📌 Notas</h3>
                <p style="color: #6b7280;">${maquina.notas}</p>
            </div>
        ` : ''}
    `;
    
    document.getElementById('contenidoDetalles').innerHTML = contenido;
    document.getElementById('modalDetallesMaquina').style.display = 'flex';
}

function cerrarModalDetalles() {
    document.getElementById('modalDetallesMaquina').style.display = 'none';
}

// ============================================
// EDITAR MÁQUINA
// ============================================

function editarMaquina(id) {
    mostrarModalMaquina(id);
}

// ============================================
// ELIMINAR MÁQUINA
// ============================================

function confirmarEliminarMaquina(id) {
    const maquina = EstadoMaquinas.maquinas.find(m => m.id === id);
    if (!maquina) {
        mostrarNotificacion('Máquina no encontrada', 'error');
        return;
    }
    
    if (confirm(`¿Estás seguro de que deseas eliminar la máquina "${maquina.nombre}"?\n\nEsta acción no se puede deshacer.`)) {
        eliminarMaquina(id);
    }
}

async function eliminarMaquina(id) {
    try {
        await GestionMaquinas.eliminar(id);
        mostrarNotificacion('Máquina eliminada correctamente', 'success');
        await cargarMaquinas();
    } catch (error) {
        console.error('❌ Error al eliminar máquina:', error);
        mostrarNotificacion('Error al eliminar la máquina', 'error');
    }
}

// ============================================
// GESTIÓN DE MÁQUINAS (API)
// ============================================

const GestionMaquinas = {
    /**
     * Obtener todas las máquinas
     */
    async obtenerTodas() {
        try {
            const maquinas = await apiClient.get(
                'api_maquinas.php',
                { action: 'list' }
            );
            return maquinas || [];
        } catch (error) {
            console.error('❌ Error al obtener máquinas:', error);
            return [];
        }
    },

    /**
     * Crear nueva máquina
     */
    async crear(datos) {
        try {
            const maquina = await apiClient.post(
                'api_maquinas.php',
                { action: 'create' },
                datos
            );
            return maquina;
        } catch (error) {
            console.error('❌ Error al crear máquina:', error);
            throw error;
        }
    },

    /**
     * Actualizar máquina
     */
    async actualizar(id, datos) {
        try {
            const maquina = await apiClient.put(
                'api_maquinas.php',
                { action: 'update' },
                { id, ...datos }
            );
            return maquina;
        } catch (error) {
            console.error('❌ Error al actualizar máquina:', error);
            throw error;
        }
    },

    /**
     * Eliminar máquina
     */
    async eliminar(id) {
        try {
            await apiClient.delete(
                'api_maquinas.php',
                { action: 'delete' },
                { id }
            );
            return true;
        } catch (error) {
            console.error('❌ Error al eliminar máquina:', error);
            throw error;
        }
    }
};

// ============================================
// UTILIDADES
// ============================================

function formatearNumero(numero) {
    return parseFloat(numero).toLocaleString('es-CO', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });
}

function mostrarNotificacion(mensaje, tipo = 'info') {
    const container = document.getElementById('notificaciones');
    const id = 'notif_' + Date.now();
    
    const iconos = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    const notif = document.createElement('div');
    notif.id = id;
    notif.className = `notificacion ${tipo}`;
    notif.innerHTML = `
        <span style="font-size: 1.5rem;">${iconos[tipo]}</span>
        <span style="flex: 1;">${mensaje}</span>
    `;
    
    container.appendChild(notif);
    
    setTimeout(() => {
        const el = document.getElementById(id);
        if (el) {
            el.style.animation = 'slideInRight 0.3s ease reverse';
            setTimeout(() => el.remove(), 300);
        }
    }, 3000);
}

// Cerrar modales al hacer clic fuera
window.onclick = function(event) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
};
