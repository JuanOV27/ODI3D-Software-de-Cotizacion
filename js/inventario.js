// ============================================
// INVENTARIO.JS - Integración con API MySQL
// ============================================

// Variables locales
let perfilFilamentoActual = null;
let indicePerfilEditando = -1;
let calidadSeleccionada = 0;

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', async function() {
    // Esperar a que el sistema principal se inicialice primero
    await new Promise(resolve => {
        if (typeof SistemaGestion3D !== 'undefined' && SistemaGestion3D.estado.perfilesFilamento) {
            resolve();
        } else {
            const interval = setInterval(() => {
                if (typeof SistemaGestion3D !== 'undefined' && SistemaGestion3D.estado.perfilesFilamento) {
                    clearInterval(interval);
                    resolve();
                }
            }, 100);
        }
    });
    
    await inicializarInventario();
});

async function inicializarInventario() {
    // Cargar perfiles existentes
    await actualizarSelectPerfiles();
    await actualizarInventario();
    inicializarEstrellas();
    
    console.log("✅ Módulo de inventario inicializado (MySQL)");
}

// ============================================
// GESTIÓN DE PERFILES DE FILAMENTO
// ============================================

async function actualizarSelectPerfiles() {
    const select = document.getElementById('perfilFilamento');
    if (!select) return;
    
    select.innerHTML = '<option value="">-- Seleccionar perfil --</option>';
    
    try {
        const perfiles = await GestionFilamentos.listarPerfiles();
        
        // Validar que perfiles sea un array
        if (!Array.isArray(perfiles)) {
            console.error('Error: perfiles no es un array:', perfiles);
            return;
        }
        
        perfiles.forEach((perfil, index) => {
            const option = document.createElement('option');
            option.value = perfil.id;
            option.textContent = `${perfil.tipo} - ${perfil.marca} (${perfil.peso} kg) - ${perfil.color_nombre || perfil.colorNombre}`;
            option.dataset.color = perfil.color_codigo || perfil.colorCodigo;
            option.dataset.calidad = perfil.calidad;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error al actualizar select de perfiles:', error);
    }
}

async function cargarPerfilFilamento() {
    const select = document.getElementById('perfilFilamento');
    const perfilId = select.value;
    
    if (!perfilId) {
        limpiarCamposPerfil();
        perfilFilamentoActual = null;
        document.getElementById('btnEditarPerfil').disabled = true;
        document.getElementById('btnEliminarPerfil').disabled = true;
        return;
    }
    
    try {
        const perfil = await GestionFilamentos.obtenerPerfil(perfilId);
        if (!perfil) return;
        
        perfilFilamentoActual = perfil;
        
        // Actualizar campos del perfil (compatibilidad con nombres de BD)
        const colorNombre = perfil.color_nombre || perfil.colorNombre;
        const colorCodigo = perfil.color_codigo || perfil.colorCodigo;
        const calidadNota = perfil.calidad_nota || perfil.calidadNota;
        
        document.getElementById('tipoFilamento').value = perfil.tipo;
        document.getElementById('marcaFilamento').value = perfil.marca;
        document.getElementById('colorFilamento').value = colorNombre;
        document.getElementById('colorPreview').style.backgroundColor = colorCodigo;
        
        // Actualizar calidad
        const estrellas = document.querySelectorAll('#calidadEstrellas .estrella');
        estrellas.forEach((estrella, index) => {
            if (index < perfil.calidad) {
                estrella.textContent = '★';
                estrella.classList.add('seleccionada');
            } else {
                estrella.textContent = '☆';
                estrella.classList.remove('seleccionada');
            }
        });
        document.getElementById('notaCalidad').value = calidadNota || '';
        
        document.getElementById('btnEditarPerfil').disabled = false;
        document.getElementById('btnEliminarPerfil').disabled = false;
        
        Utilidades.mostrarNotificacion(`Perfil "${perfil.tipo} - ${perfil.marca}" cargado`, 'success');
    } catch (error) {
        console.error('Error al cargar perfil:', error);
        Utilidades.mostrarNotificacion('Error al cargar perfil', 'error');
    }
}

function limpiarCamposPerfil() {
    document.getElementById('tipoFilamento').value = '';
    document.getElementById('marcaFilamento').value = '';
    document.getElementById('colorFilamento').value = '';
    document.getElementById('colorPreview').style.backgroundColor = '';
    document.getElementById('notaCalidad').value = '';
    
    const estrellas = document.querySelectorAll('#calidadEstrellas .estrella');
    estrellas.forEach(estrella => {
        estrella.textContent = '☆';
        estrella.classList.remove('seleccionada');
    });
}

// ============================================
// MODAL DE PERFIL DE FILAMENTO
// ============================================

function mostrarModalFilamento() {
    document.getElementById('tituloModalFilamento').textContent = '🧵 Nuevo Perfil de Filamento';
    document.getElementById('btnGuardarPerfil').textContent = '💾 Guardar';
    limpiarModalFilamento();
    indicePerfilEditando = -1;
    calidadSeleccionada = 0;
    
    document.getElementById('modalFechaCompra').value = new Date().toISOString().split('T')[0];
    document.getElementById('modalFilamento').classList.add('active');
}

async function editarPerfilFilamento() {
    if (!perfilFilamentoActual) return;
    
    indicePerfilEditando = perfilFilamentoActual.id;
    
    document.getElementById('tituloModalFilamento').textContent = '✏️ Editar Perfil de Filamento';
    document.getElementById('btnGuardarPerfil').textContent = '💾 Actualizar';
    
    // Compatibilidad con nombres de BD
    const colorNombre = perfilFilamentoActual.color_nombre || perfilFilamentoActual.colorNombre;
    const colorCodigo = perfilFilamentoActual.color_codigo || perfilFilamentoActual.colorCodigo;
    const calidadNota = perfilFilamentoActual.calidad_nota || perfilFilamentoActual.calidadNota;
    const fechaCompra = perfilFilamentoActual.fecha_compra || perfilFilamentoActual.fechaCompra;
    
    // Cargar datos en el modal
    document.getElementById('modalTipoFilamento').value = perfilFilamentoActual.tipo;
    document.getElementById('modalMarcaFilamento').value = perfilFilamentoActual.marca;
    document.getElementById('modalColorFilamento').value = colorNombre;
    document.getElementById('modalCodigoColor').value = colorCodigo;
    document.getElementById('modalPesoCarrete').value = perfilFilamentoActual.peso;
    document.getElementById('modalCostoCarrete').value = perfilFilamentoActual.costo;
    document.getElementById('modalTemperaturaFilamento').value = perfilFilamentoActual.temperatura || '';
    document.getElementById('modalFechaCompra').value = fechaCompra || '';
    document.getElementById('modalNotaCalidad').value = calidadNota || '';
    
    calificar(perfilFilamentoActual.calidad || 0);
    
    document.getElementById('modalFilamento').classList.add('active');
}

function limpiarModalFilamento() {
    document.getElementById('modalTipoFilamento').value = 'PLA';
    document.getElementById('modalMarcaFilamento').value = '';
    document.getElementById('modalColorFilamento').value = '';
    document.getElementById('modalCodigoColor').value = '#000000';
    document.getElementById('modalPesoCarrete').value = '1';
    document.getElementById('modalCostoCarrete').value = '120000';
    document.getElementById('modalTemperaturaFilamento').value = '';
    document.getElementById('modalFechaCompra').value = new Date().toISOString().split('T')[0];
    document.getElementById('modalNotaCalidad').value = '';
    calificar(0);
}

function cerrarModalFilamento() {
    document.getElementById('modalFilamento').classList.remove('active');
    indicePerfilEditando = -1;
}

async function guardarPerfilFilamento() {
    const datos = {
        tipo: document.getElementById('modalTipoFilamento').value,
        marca: document.getElementById('modalMarcaFilamento').value.trim(),
        colorNombre: document.getElementById('modalColorFilamento').value.trim(),
        colorCodigo: document.getElementById('modalCodigoColor').value,
        peso: parseFloat(document.getElementById('modalPesoCarrete').value),
        costo: parseFloat(document.getElementById('modalCostoCarrete').value),
        temperatura: parseInt(document.getElementById('modalTemperaturaFilamento').value) || null,
        fechaCompra: document.getElementById('modalFechaCompra').value,
        calidad: parseInt(document.getElementById('modalCalidad').value) || 0,
        calidadNota: document.getElementById('modalNotaCalidad').value.trim()
    };
    
    // Validar campos obligatorios
    const validacion = Utilidades.validarDatos(datos, ['tipo', 'marca', 'colorNombre', 'peso', 'costo']);
    if (!validacion.valido) {
        Utilidades.mostrarNotificacion(validacion.mensaje, 'error');
        return;
    }
    
    try {
        if (indicePerfilEditando !== -1) {
            // Actualizar perfil existente
            await GestionFilamentos.actualizarPerfil(indicePerfilEditando, datos);
            Utilidades.mostrarNotificacion('Perfil actualizado exitosamente', 'success');
        } else {
            // Crear nuevo perfil
            await GestionFilamentos.crearPerfil(datos);
            Utilidades.mostrarNotificacion('Perfil creado exitosamente', 'success');
        }
        
        await actualizarSelectPerfiles();
        await actualizarInventario();
        cerrarModalFilamento();
        
    } catch (error) {
        console.error('Error al guardar perfil:', error);
        Utilidades.mostrarNotificacion('Error al guardar perfil: ' + error.message, 'error');
    }
}

async function eliminarPerfilFilamento() {
    if (!perfilFilamentoActual) return;
    
    if (confirm(`¿Estás seguro de que quieres eliminar el perfil "${perfilFilamentoActual.tipo} - ${perfilFilamentoActual.marca}"?`)) {
        try {
            await GestionFilamentos.eliminarPerfil(perfilFilamentoActual.id);
            await actualizarSelectPerfiles();
            await actualizarInventario();
            
            document.getElementById('perfilFilamento').value = '';
            await cargarPerfilFilamento();
            
            Utilidades.mostrarNotificacion('Perfil eliminado exitosamente', 'success');
        } catch (error) {
            console.error('Error al eliminar perfil:', error);
            Utilidades.mostrarNotificacion('Error al eliminar perfil', 'error');
        }
    }
}

// ============================================
// SISTEMA DE CALIFICACIÓN CON ESTRELLAS
// ============================================

function inicializarEstrellas() {
    // Crear estrellas para visualización
    const calidadEstrellas = document.getElementById('calidadEstrellas');
    if (calidadEstrellas) {
        calidadEstrellas.innerHTML = '';
        for (let i = 1; i <= 5; i++) {
            const estrella = document.createElement('span');
            estrella.className = 'estrella';
            estrella.textContent = '☆';
            calidadEstrellas.appendChild(estrella);
        }
    }
    
    // Inicializar estrellas del modal
    const estrellas = document.querySelectorAll('#modalCalidadEstrellas .estrella');
    estrellas.forEach(estrella => {
        estrella.addEventListener('click', () => {
            const valor = parseInt(estrella.getAttribute('data-value'));
            calificar(valor);
        });
    });
}

function calificar(valor) {
    calidadSeleccionada = valor;
    const modalCalidad = document.getElementById('modalCalidad');
    if (modalCalidad) {
        modalCalidad.value = valor;
    }
    
    const estrellas = document.querySelectorAll('#modalCalidadEstrellas .estrella');
    estrellas.forEach((estrella, index) => {
        if (index < valor) {
            estrella.textContent = '★';
            estrella.classList.add('seleccionada');
        } else {
            estrella.textContent = '☆';
            estrella.classList.remove('seleccionada');
        }
    });
}

// ============================================
// GESTIÓN DE INVENTARIO DE CARRETES
// ============================================

async function actualizarInventario() {
    const container = document.getElementById('inventarioCarretes');
    if (!container) return;
    
    container.innerHTML = '<p style="text-align: center; padding: 20px;">⏳ Cargando inventario...</p>';
    
    try {
        const carretes = await GestionInventario.obtenerCarretesDisponibles();
        
        container.innerHTML = '';
        
        if (carretes.length === 0) {
            container.innerHTML = `
                <p style="text-align: center; color: #6b7280; padding: 40px; font-size: 1.1rem;">
                    📦 No hay carretes en el inventario<br>
                    <span style="font-size: 0.9rem;">Primero crea perfiles de filamento y luego sincroniza el inventario</span>
                </p>
            `;
            await mostrarEstadisticasInventario();
            return;
        }
        
        carretes.forEach((carrete, index) => {
            // Obtener datos del perfil (compatibilidad con diferentes formatos)
            const tipo = carrete.tipo;
            const marca = carrete.marca;
            const colorNombre = carrete.color_nombre || carrete.colorNombre;
            const colorCodigo = carrete.color_codigo || carrete.colorCodigo;
            const temperatura = carrete.temperatura;
            
            // Cálculos de peso
            const pesoInicial = parseFloat(carrete.peso_inicial || carrete.pesoInicial);
            const pesoUsado = parseFloat(carrete.peso_usado || carrete.pesoUsado);
            const pesoRestante = parseFloat(carrete.peso_restante || pesoInicial - pesoUsado);
            const porcentajeRestante = parseFloat(carrete.porcentaje_restante || ((pesoRestante / pesoInicial) * 100));
            const porcentajeUsado = (100 - porcentajeRestante).toFixed(1);
            
            let colorBarra = '#10b981';
            if (porcentajeRestante < 20) colorBarra = '#ef4444';
            else if (porcentajeRestante < 50) colorBarra = '#f59e0b';
            
            const div = document.createElement('div');
            div.className = 'carrete-item';
            div.style.setProperty('--color-filamento', colorCodigo);
            div.style.setProperty('--porcentaje-usado', `${porcentajeUsado}%`);
            
            div.innerHTML = `
                <div class="carrete-header">
                    <div class="carrete-info">
                        <div class="carrete-visual">
                            <div class="carrete-3d">
                                <div class="carrete-centro">${porcentajeRestante.toFixed(0)}%</div>
                            </div>
                        </div>
                        <div class="carrete-detalles">
                            <h4>${tipo} - ${marca}</h4>
                            <p><strong>Color:</strong> ${colorNombre}</p>
                            <p><strong>Peso inicial:</strong> ${pesoInicial.toFixed(0)}g</p>
                            <p><strong>Temperatura:</strong> ${temperatura || 'N/A'}°C</p>
                        </div>
                    </div>
                    <div class="carrete-stats">
                        <div class="peso-restante">${pesoRestante.toFixed(0)}g</div>
                        <div class="porcentaje-restante">restantes</div>
                        <div style="font-size: 0.8rem; color: #dc2626; margin-top: 5px;">
                            Usado: ${pesoUsado.toFixed(0)}g
                        </div>
                    </div>
                </div>
                
                <div class="carrete-progress">
                    <div class="carrete-progress-bar" style="width: ${porcentajeRestante}%; background: ${colorBarra};"></div>
                </div>

                <div class="registro-uso">
                    <label style="white-space: nowrap; margin: 0; color: #374151; font-weight: 500;">Registrar uso:</label>
                    <input type="number" id="usoGramos_${carrete.id || carrete.carrete_id}" placeholder="Gramos usados" min="0" max="${pesoRestante}" step="0.1">
                    <button class="btn btn-primary btn-small" onclick="registrarUso('${carrete.id || carrete.carrete_id}')">✅ Registrar</button>
                </div>

                <div class="carrete-acciones">
                    <button class="btn btn-secondary btn-small" onclick="resetearCarrete('${carrete.id || carrete.carrete_id}')">🔄 Nuevo Carrete</button>
                    <button class="btn btn-outline btn-small" onclick="cambiarEstadoCarrete('${carrete.id || carrete.carrete_id}')" 
                        style="background: ${carrete.estado === 'activo' ? '#f59e0b' : '#10b981'}; color: white;">
                        ${carrete.estado === 'activo' ? '⏸️ Pausar' : '▶️ Activar'}
                    </button>
                    <button class="btn btn-outline btn-small" onclick="eliminarCarrete('${carrete.id || carrete.carrete_id}')" style="color: #dc2626; border-color: #dc2626;">🗑️ Eliminar</button>
                </div>
            `;
            
            container.appendChild(div);
        });
        
        await mostrarEstadisticasInventario();
        
    } catch (error) {
        console.error('Error al actualizar inventario:', error);
        container.innerHTML = '<p style="text-align: center; color: #dc2626; padding: 20px;">❌ Error al cargar inventario</p>';
    }
}

async function registrarUso(carreteId) {
    const input = document.getElementById(`usoGramos_${carreteId}`);
    const gramosUsados = parseFloat(input.value);
    
    if (!gramosUsados || gramosUsados <= 0) {
        Utilidades.mostrarNotificacion('Ingresa una cantidad válida de gramos', 'error');
        return;
    }
    
    try {
        const exito = await GestionInventario.registrarUso(carreteId, gramosUsados);
        
        if (exito) {
            input.value = '';
            await actualizarInventario();
            Utilidades.mostrarNotificacion(`Registrado uso de ${gramosUsados}g de filamento`, 'success');
        }
    } catch (error) {
        console.error('Error al registrar uso:', error);
        Utilidades.mostrarNotificacion('Error al registrar uso: ' + error.message, 'error');
    }
}

async function resetearCarrete(carreteId) {
    if (confirm('¿Estás seguro de que quieres resetear este carrete? Se marcará como nuevo carrete completo.')) {
        try {
            // Obtener el carrete
            const carretes = await apiClient.get(API_CONFIG.endpoints.inventario, { action: 'list' });
            const carrete = carretes.find(c => (c.id || c.carrete_id) === carreteId);
            
            if (carrete) {
                // Actualizar carrete
                await apiClient.put(
                    API_CONFIG.endpoints.inventario,
                    { action: 'update' },
                    {
                        id: carreteId,
                        pesoUsado: 0,
                        estado: 'activo'
                    }
                );
                
                await actualizarInventario();
                Utilidades.mostrarNotificacion('Carrete reseteado como nuevo', 'success');
            }
        } catch (error) {
            console.error('Error al resetear carrete:', error);
            Utilidades.mostrarNotificacion('Error al resetear carrete', 'error');
        }
    }
}

async function cambiarEstadoCarrete(carreteId) {
    try {
        const carretes = await apiClient.get(API_CONFIG.endpoints.inventario, { action: 'list' });
        const carrete = carretes.find(c => (c.id || c.carrete_id) === carreteId);
        
        if (carrete) {
            const nuevoEstado = carrete.estado === 'activo' ? 'pausado' : 'activo';
            
            await apiClient.put(
                API_CONFIG.endpoints.inventario,
                { action: 'update' },
                {
                    id: carreteId,
                    pesoUsado: carrete.peso_usado || carrete.pesoUsado,
                    estado: nuevoEstado
                }
            );
            
            await actualizarInventario();
            Utilidades.mostrarNotificacion(`Carrete ${nuevoEstado === 'activo' ? 'activado' : 'pausado'}`, 'success');
        }
    } catch (error) {
        console.error('Error al cambiar estado:', error);
        Utilidades.mostrarNotificacion('Error al cambiar estado del carrete', 'error');
    }
}

async function eliminarCarrete(carreteId) {
    if (confirm(`¿Estás seguro de que quieres eliminar este carrete?`)) {
        try {
            await apiClient.delete(
                API_CONFIG.endpoints.inventario,
                { action: 'delete' },
                { id: carreteId }
            );
            
            await actualizarInventario();
            Utilidades.mostrarNotificacion('Carrete eliminado del inventario', 'success');
        } catch (error) {
            console.error('Error al eliminar carrete:', error);
            Utilidades.mostrarNotificacion('Error al eliminar carrete', 'error');
        }
    }
}

async function sincronizarInventarioConPerfiles() {
    try {
        const resultado = await apiClient.post(
            API_CONFIG.endpoints.inventario,
            { action: 'sincronizar' },
            {}
        );
        
        await actualizarInventario();
        Utilidades.mostrarNotificacion(`${resultado.nuevosCarretes || 0} carretes añadidos al inventario`, 'success');
    } catch (error) {
        console.error('Error al sincronizar:', error);
        Utilidades.mostrarNotificacion('Error al sincronizar inventario', 'error');
    }
}

function limpiarInventario() {
    if (confirm('¿Estás seguro de que quieres limpiar todo el inventario? Esta acción no se puede deshacer.')) {
        Utilidades.mostrarNotificacion('Función no implementada aún en la versión MySQL', 'error');
    }
}

// ============================================
// ESTADÍSTICAS DEL INVENTARIO
// ============================================

async function mostrarEstadisticasInventario() {
    const container = document.getElementById('estadisticasInventario');
    if (!container) return;
    
    try {
        const stats = await GestionInventario.obtenerEstadisticas();
        
        if (!stats || stats.total_carretes === 0) {
            container.innerHTML = '';
            return;
        }
        
        const carretes = await GestionInventario.obtenerCarretesDisponibles();
        const carretesLowStock = carretes.filter(c => {
            const porcentaje = c.porcentaje_restante || c.porcentajeRestante;
            return porcentaje < 20;
        });
        
        container.innerHTML = `
            <div class="stat-card" style="--color-start: #10b981; --color-end: #059669;">
                <div class="stat-value">${stats.total_carretes || 0}</div>
                <div class="stat-label">Carretes Totales</div>
            </div>
            
            <div class="stat-card" style="--color-start: #3b82f6; --color-end: #1d4ed8;">
                <div class="stat-value">${stats.carretes_activos || 0}</div>
                <div class="stat-label">Carretes Activos</div>
            </div>
            
            <div class="stat-card" style="--color-start: #f59e0b; --color-end: #d97706;">
                <div class="stat-value">${parseFloat(stats.peso_total_restante || 0).toFixed(0)}g</div>
                <div class="stat-label">Filamento Restante</div>
            </div>
            
            <div class="stat-card" style="--color-start: ${carretesLowStock.length > 0 ? '#ef4444' : '#10b981'}; --color-end: ${carretesLowStock.length > 0 ? '#dc2626' : '#059669'};">
                <div class="stat-value">${carretesLowStock.length}</div>
                <div class="stat-label">Carretes Bajos (&lt;20%)</div>
            </div>
            
            <div class="stat-card" style="--color-start: #8b5cf6; --color-end: #7c3aed;">
                <div class="stat-value">${parseFloat(stats.porcentaje_restante_promedio || 0).toFixed(0)}%</div>
                <div class="stat-label">Promedio Restante</div>
            </div>
        `;
    } catch (error) {
        console.error('Error al mostrar estadísticas:', error);
        container.innerHTML = '';
    }
}

// ============================================
// IMPORTACIÓN Y EXPORTACIÓN CSV (Mantenido)
// ============================================

function descargarFilamentosCSV() {
    Utilidades.mostrarNotificacion('Función de exportación en desarrollo para MySQL', 'error');
}

function cargarFilamentosCSV(event) {
    Utilidades.mostrarNotificacion('Función de importación en desarrollo para MySQL', 'error');
}

function descargarInventarioCSV() {
    Utilidades.mostrarNotificacion('Función en desarrollo', 'error');
}

function cargarInventarioCSV(event) {
    Utilidades.mostrarNotificacion('Función en desarrollo', 'error');
}

// Cerrar modal al hacer clic fuera
document.addEventListener('click', function(e) {
    const modal = document.getElementById('modalFilamento');
    if (e.target === modal) {
        cerrarModalFilamento();
    }
});

console.log('📦 inventario.js cargado (Versión MySQL)');