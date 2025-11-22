// ============================================
// INVENTARIO.JS - Integración con main.js
// ============================================

// Variables locales
let perfilFilamentoActual = null;
let indicePerfilEditando = -1;
let calidadSeleccionada = 0;

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    inicializarInventario();
});

function inicializarInventario() {
    // Cargar perfiles existentes
    actualizarSelectPerfiles();
    actualizarInventario();
    inicializarEstrellas();
    
    console.log("Módulo de inventario inicializado");
}

// ============================================
// GESTIÓN DE PERFILES DE FILAMENTO
// ============================================

function actualizarSelectPerfiles() {
    const select = document.getElementById('perfilFilamento');
    select.innerHTML = '<option value="">-- Seleccionar perfil --</option>';
    
    const perfiles = GestionFilamentos.listarPerfiles();
    
    perfiles.forEach((perfil, index) => {
        const option = document.createElement('option');
        option.value = perfil.id;
        option.textContent = `${perfil.tipo} - ${perfil.marca} (${perfil.peso} kg) - ${perfil.colorNombre}`;
        option.dataset.color = perfil.colorCodigo;
        option.dataset.calidad = perfil.calidad;
        select.appendChild(option);
    });
}

function cargarPerfilFilamento() {
    const select = document.getElementById('perfilFilamento');
    const perfilId = select.value;
    
    if (!perfilId) {
        limpiarCamposPerfil();
        perfilFilamentoActual = null;
        document.getElementById('btnEditarPerfil').disabled = true;
        document.getElementById('btnEliminarPerfil').disabled = true;
        return;
    }
    
    const perfil = GestionFilamentos.obtenerPerfil(perfilId);
    if (!perfil) return;
    
    perfilFilamentoActual = perfil;
    
    // Actualizar campos del perfil
    document.getElementById('tipoFilamento').value = perfil.tipo;
    document.getElementById('marcaFilamento').value = perfil.marca;
    document.getElementById('colorFilamento').value = perfil.colorNombre;
    document.getElementById('colorPreview').style.backgroundColor = perfil.colorCodigo;
    
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
    document.getElementById('notaCalidad').value = perfil.calidadNota || '';
    
    document.getElementById('btnEditarPerfil').disabled = false;
    document.getElementById('btnEliminarPerfil').disabled = false;
    
    Utilidades.mostrarNotificacion(`Perfil "${perfil.tipo} - ${perfil.marca}" cargado`, 'success');
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

function editarPerfilFilamento() {
    if (!perfilFilamentoActual) return;
    
    indicePerfilEditando = perfilFilamentoActual.id;
    
    document.getElementById('tituloModalFilamento').textContent = '✏️ Editar Perfil de Filamento';
    document.getElementById('btnGuardarPerfil').textContent = '💾 Actualizar';
    
    // Cargar datos en el modal
    document.getElementById('modalTipoFilamento').value = perfilFilamentoActual.tipo;
    document.getElementById('modalMarcaFilamento').value = perfilFilamentoActual.marca;
    document.getElementById('modalColorFilamento').value = perfilFilamentoActual.colorNombre;
    document.getElementById('modalCodigoColor').value = perfilFilamentoActual.colorCodigo;
    document.getElementById('modalPesoCarrete').value = perfilFilamentoActual.peso;
    document.getElementById('modalCostoCarrete').value = perfilFilamentoActual.costo;
    document.getElementById('modalTemperaturaFilamento').value = perfilFilamentoActual.temperatura || '';
    document.getElementById('modalFechaCompra').value = perfilFilamentoActual.fechaCompra || '';
    document.getElementById('modalNotaCalidad').value = perfilFilamentoActual.calidadNota || '';
    
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

function guardarPerfilFilamento() {
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
    
    if (indicePerfilEditando !== -1) {
        // Actualizar perfil existente
        GestionFilamentos.actualizarPerfil(indicePerfilEditando, datos);
        Utilidades.mostrarNotificacion('Perfil actualizado exitosamente', 'success');
    } else {
        // Crear nuevo perfil
        GestionFilamentos.crearPerfil(datos);
        Utilidades.mostrarNotificacion('Perfil creado exitosamente', 'success');
    }
    
    actualizarSelectPerfiles();
    actualizarInventario();
    cerrarModalFilamento();
}

function eliminarPerfilFilamento() {
    if (!perfilFilamentoActual) return;
    
    if (confirm(`¿Estás seguro de que quieres eliminar el perfil "${perfilFilamentoActual.tipo} - ${perfilFilamentoActual.marca}"?`)) {
        GestionFilamentos.eliminarPerfil(perfilFilamentoActual.id);
        actualizarSelectPerfiles();
        actualizarInventario();
        
        document.getElementById('perfilFilamento').value = '';
        cargarPerfilFilamento();
        
        Utilidades.mostrarNotificacion('Perfil eliminado exitosamente', 'success');
    }
}

// ============================================
// SISTEMA DE CALIFICACIÓN CON ESTRELLAS
// ============================================

function inicializarEstrellas() {
    // Crear estrellas para visualización
    const calidadEstrellas = document.getElementById('calidadEstrellas');
    calidadEstrellas.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
        const estrella = document.createElement('span');
        estrella.className = 'estrella';
        estrella.textContent = '☆';
        calidadEstrellas.appendChild(estrella);
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
    document.getElementById('modalCalidad').value = valor;
    
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

function actualizarInventario() {
    const container = document.getElementById('inventarioCarretes');
    container.innerHTML = '';
    
    const carretes = GestionInventario.obtenerCarretesDisponibles();
    
    if (carretes.length === 0) {
        container.innerHTML = `
            <p style="text-align: center; color: #6b7280; padding: 40px; font-size: 1.1rem;">
                📦 No hay carretes en el inventario<br>
                <span style="font-size: 0.9rem;">Primero crea perfiles de filamento y luego sincroniza el inventario</span>
            </p>
        `;
        mostrarEstadisticasInventario();
        return;
    }
    
    carretes.forEach((carrete, index) => {
        const perfil = carrete.perfil;
        const porcentajeUsado = ((carrete.pesoUsado / carrete.pesoInicial) * 100).toFixed(1);
        
        let colorBarra = '#10b981';
        if (carrete.porcentajeRestante < 20) colorBarra = '#ef4444';
        else if (carrete.porcentajeRestante < 50) colorBarra = '#f59e0b';
        
        const div = document.createElement('div');
        div.className = 'carrete-item';
        div.style.setProperty('--color-filamento', perfil.colorCodigo);
        div.style.setProperty('--porcentaje-usado', `${porcentajeUsado}%`);
        
        div.innerHTML = `
            <div class="carrete-header">
                <div class="carrete-info">
                    <div class="carrete-visual">
                        <div class="carrete-3d">
                            <div class="carrete-centro">${carrete.porcentajeRestante.toFixed(0)}%</div>
                        </div>
                    </div>
                    <div class="carrete-detalles">
                        <h4>${perfil.tipo} - ${perfil.marca}</h4>
                        <p><strong>Color:</strong> ${perfil.colorNombre}</p>
                        <p><strong>Peso inicial:</strong> ${carrete.pesoInicial}g</p>
                        <p><strong>Temperatura:</strong> ${perfil.temperatura || 'N/A'}°C</p>
                    </div>
                </div>
                <div class="carrete-stats">
                    <div class="peso-restante">${carrete.pesoRestante.toFixed(0)}g</div>
                    <div class="porcentaje-restante">restantes</div>
                    <div style="font-size: 0.8rem; color: #dc2626; margin-top: 5px;">
                        Usado: ${carrete.pesoUsado.toFixed(0)}g
                    </div>
                </div>
            </div>
            
            <div class="carrete-progress">
                <div class="carrete-progress-bar" style="width: ${carrete.porcentajeRestante}%; background: ${colorBarra};"></div>
            </div>

            <div class="registro-uso">
                <label style="white-space: nowrap; margin: 0; color: #374151; font-weight: 500;">Registrar uso:</label>
                <input type="number" id="usoGramos_${carrete.id}" placeholder="Gramos usados" min="0" max="${carrete.pesoRestante}" step="0.1">
                <button class="btn btn-primary btn-small" onclick="registrarUso('${carrete.id}')">✅ Registrar</button>
            </div>

            <div class="carrete-acciones">
                <button class="btn btn-secondary btn-small" onclick="resetearCarrete('${carrete.id}')">🔄 Nuevo Carrete</button>
                <button class="btn btn-outline btn-small" onclick="cambiarEstadoCarrete('${carrete.id}')" 
                    style="background: ${carrete.estado === 'activo' ? '#f59e0b' : '#10b981'}; color: white;">
                    ${carrete.estado === 'activo' ? '⏸️ Pausar' : '▶️ Activar'}
                </button>
                <button class="btn btn-outline btn-small" onclick="eliminarCarrete('${carrete.id}')" style="color: #dc2626; border-color: #dc2626;">🗑️ Eliminar</button>
            </div>
        `;
        
        container.appendChild(div);
    });
    
    mostrarEstadisticasInventario();
}

function registrarUso(carreteId) {
    const input = document.getElementById(`usoGramos_${carreteId}`);
    const gramosUsados = parseFloat(input.value);
    
    if (!gramosUsados || gramosUsados <= 0) {
        Utilidades.mostrarNotificacion('Ingresa una cantidad válida de gramos', 'error');
        return;
    }
    
    const exito = GestionInventario.registrarUso(carreteId, gramosUsados);
    
    if (exito) {
        input.value = '';
        actualizarInventario();
        Utilidades.mostrarNotificacion(`Registrado uso de ${gramosUsados}g de filamento`, 'success');
    } else {
        Utilidades.mostrarNotificacion('No hay suficiente filamento en el carrete', 'error');
    }
}

function resetearCarrete(carreteId) {
    if (confirm('¿Estás seguro de que quieres resetear este carrete? Se marcará como nuevo carrete completo.')) {
        const carrete = SistemaGestion3D.estado.inventarioCarretes.find(c => c.id === carreteId);
        if (carrete) {
            carrete.pesoUsado = 0;
            carrete.fechaCreacion = new Date().toISOString();
            carrete.estado = 'activo';
            SistemaGestion3D.guardarDatosLocales();
            actualizarInventario();
            Utilidades.mostrarNotificacion('Carrete reseteado como nuevo', 'success');
        }
    }
}

function cambiarEstadoCarrete(carreteId) {
    const carrete = SistemaGestion3D.estado.inventarioCarretes.find(c => c.id === carreteId);
    if (carrete) {
        carrete.estado = carrete.estado === 'activo' ? 'pausado' : 'activo';
        SistemaGestion3D.guardarDatosLocales();
        actualizarInventario();
        Utilidades.mostrarNotificacion(`Carrete ${carrete.estado === 'activo' ? 'activado' : 'pausado'}`, 'success');
    }
}

function eliminarCarrete(carreteId) {
    const carrete = SistemaGestion3D.estado.inventarioCarretes.find(c => c.id === carreteId);
    const perfil = carrete ? GestionFilamentos.obtenerPerfil(carrete.perfilId) : null;
    const nombreCarrete = perfil ? `${perfil.tipo} - ${perfil.marca}` : 'Carrete';
    
    if (confirm(`¿Estás seguro de que quieres eliminar el carrete "${nombreCarrete}"?`)) {
        const index = SistemaGestion3D.estado.inventarioCarretes.findIndex(c => c.id === carreteId);
        if (index !== -1) {
            SistemaGestion3D.estado.inventarioCarretes.splice(index, 1);
            SistemaGestion3D.guardarDatosLocales();
            actualizarInventario();
            Utilidades.mostrarNotificacion('Carrete eliminado del inventario', 'success');
        }
    }
}

function sincronizarInventarioConPerfiles() {
    const perfiles = GestionFilamentos.listarPerfiles();
    let nuevosCarretes = 0;
    
    perfiles.forEach(perfil => {
        const existeEnInventario = SistemaGestion3D.estado.inventarioCarretes.find(c => c.perfilId === perfil.id);
        if (!existeEnInventario) {
            GestionInventario.crearCarrete(perfil.id);
            nuevosCarretes++;
        }
    });
    
    if (nuevosCarretes > 0) {
        actualizarInventario();
        Utilidades.mostrarNotificacion(`${nuevosCarretes} carretes añadidos al inventario`, 'success');
    } else {
        Utilidades.mostrarNotificacion('El inventario ya está sincronizado', 'success');
    }
}

function limpiarInventario() {
    if (confirm('¿Estás seguro de que quieres limpiar todo el inventario y su historial?')) {
        SistemaGestion3D.estado.inventarioCarretes = [];
        SistemaGestion3D.estado.historialUso = [];
        SistemaGestion3D.guardarDatosLocales();
        actualizarInventario();
        Utilidades.mostrarNotificacion('Inventario limpiado', 'success');
    }
}

// ============================================
// ESTADÍSTICAS DEL INVENTARIO
// ============================================

function mostrarEstadisticasInventario() {
    const stats = GestionInventario.obtenerEstadisticas();
    const container = document.getElementById('estadisticasInventario');
    
    if (!stats || stats.totalCarretes === 0) {
        container.innerHTML = '';
        return;
    }
    
    const carretesLowStock = GestionInventario.obtenerCarretesDisponibles().filter(c => c.porcentajeRestante < 20);
    
    container.innerHTML = `
        <div class="stat-card" style="--color-start: #10b981; --color-end: #059669;">
            <div class="stat-value">${stats.totalCarretes}</div>
            <div class="stat-label">Carretes Totales</div>
        </div>
        
        <div class="stat-card" style="--color-start: #3b82f6; --color-end: #1d4ed8;">
            <div class="stat-value">${stats.carretesActivos}</div>
            <div class="stat-label">Carretes Activos</div>
        </div>
        
        <div class="stat-card" style="--color-start: #f59e0b; --color-end: #d97706;">
            <div class="stat-value">${stats.pesoTotalRestante.toFixed(0)}g</div>
            <div class="stat-label">Filamento Restante</div>
        </div>
        
        <div class="stat-card" style="--color-start: ${carretesLowStock.length > 0 ? '#ef4444' : '#10b981'}; --color-end: ${carretesLowStock.length > 0 ? '#dc2626' : '#059669'};">
            <div class="stat-value">${carretesLowStock.length}</div>
            <div class="stat-label">Carretes Bajos (&lt;20%)</div>
        </div>
        
        <div class="stat-card" style="--color-start: #8b5cf6; --color-end: #7c3aed;">
            <div class="stat-value">${stats.porcentajeUsadoGlobal}%</div>
            <div class="stat-label">Filamento Usado</div>
        </div>
    `;
}

// ============================================
// IMPORTACIÓN Y EXPORTACIÓN CSV
// ============================================

function descargarFilamentosCSV() {
    const perfiles = GestionFilamentos.listarPerfiles();
    
    if (perfiles.length === 0) {
        Utilidades.mostrarNotificacion('No hay perfiles de filamento para descargar', 'error');
        return;
    }
    
    const headers = [
        'ID', 'Tipo', 'Marca', 'ColorNombre', 'ColorCodigo', 'Peso (kg)', 'Costo (COP)', 
        'Temperatura (°C)', 'Calidad', 'CalidadNota', 'Fecha Compra', 'Fecha Creacion'
    ];
    
    let csvContent = headers.join('|') + '\n';
    
    perfiles.forEach(perfil => {
        const row = [
            perfil.id,
            `"${perfil.tipo}"`,
            `"${perfil.marca}"`,
            `"${perfil.colorNombre}"`,
            perfil.colorCodigo,
            perfil.peso,
            perfil.costo,
            perfil.temperatura || '',
            perfil.calidad || 0,
            `"${perfil.calidadNota || ''}"`,
            perfil.fechaCompra || '',
            perfil.fechaCreacion || ''
        ];
        csvContent += row.join('|') + '\n';
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'perfiles_filamento_' + new Date().toISOString().split('T')[0] + '.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    Utilidades.mostrarNotificacion('Perfiles descargados exitosamente', 'success');
}

function cargarFilamentosCSV(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const csv = e.target.result;
            const lines = csv.split('\n');
            
            if (lines.length < 2) {
                Utilidades.mostrarNotificacion('El archivo CSV está vacío', 'error');
                return;
            }
            
            let nuevosPerfiles = 0;
            
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                
                const values = line.split('|');
                if (values.length >= 12) {
                    const datos = {
                        tipo: values[1].replace(/"/g, ''),
                        marca: values[2].replace(/"/g, ''),
                        colorNombre: values[3].replace(/"/g, ''),
                        colorCodigo: values[4],
                        peso: parseFloat(values[5]) || 1,
                        costo: parseFloat(values[6]) || 0,
                        temperatura: parseInt(values[7]) || null,
                        calidad: parseInt(values[8]) || 0,
                        calidadNota: values[9].replace(/"/g, '') || '',
                        fechaCompra: values[10] || '',
                    };
                    
                    GestionFilamentos.crearPerfil(datos);
                    nuevosPerfiles++;
                }
            }
            
            if (nuevosPerfiles > 0) {
                actualizarSelectPerfiles();
                actualizarInventario();
                Utilidades.mostrarNotificacion(`${nuevosPerfiles} perfiles cargados exitosamente`, 'success');
            }
            
        } catch (error) {
            console.error('Error al cargar CSV:', error);
            Utilidades.mostrarNotificacion('Error al procesar el archivo CSV', 'error');
        }
        
        event.target.value = '';
    };
    
    reader.readAsText(file);
}

function descargarInventarioCSV() {
    // Implementar según necesidad
    Utilidades.mostrarNotificacion('Función en desarrollo', 'error');
}

function cargarInventarioCSV(event) {
    // Implementar según necesidad
    Utilidades.mostrarNotificacion('Función en desarrollo', 'error');
}

// Cerrar modal al hacer clic fuera
document.addEventListener('click', function(e) {
    const modal = document.getElementById('modalFilamento');
    if (e.target === modal) {
        cerrarModalFilamento();
    }
});