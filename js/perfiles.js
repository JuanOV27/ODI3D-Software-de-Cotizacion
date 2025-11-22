// ============================================
// PERFILES.JS - Gestión de Perfiles de Proyecto
// ============================================

// Templates predefinidos
const TemplatesPerfiles = {
    produccionBasica: {
        nombre: "Producción Básica",
        descripcion: "Para piezas estándar sin diseño complejo",
        configuracion: {
            factorSeguridad: 1.1,
            usoElectricidad: 600,
            gif: 10,
            aiu: 20,
            margenMinorista: 25,
            margenMayorista: 15,
            costoHoraDiseno: 20000,
            incluirMarcaAgua: false
        }
    },
    
    proyectosPremium: {
        nombre: "Proyectos Premium",
        descripcion: "Para clientes corporativos con diseño custom",
        configuracion: {
            factorSeguridad: 1.3,
            usoElectricidad: 600,
            gif: 20,
            aiu: 35,
            margenMinorista: 45,
            margenMayorista: 30,
            costoHoraDiseno: 40000,
            incluirMarcaAgua: true,
            porcentajeMarcaAgua: 15
        }
    },
    
    prototipado: {
        nombre: "Prototipos Rápidos",
        descripcion: "Para iteraciones y pruebas",
        configuracion: {
            factorSeguridad: 1.0,
            usoElectricidad: 600,
            gif: 5,
            aiu: 15,
            margenMinorista: 15,
            margenMayorista: 10,
            costoHoraDiseno: 15000,
            incluirMarcaAgua: false
        }
    },
    
    produccionMasa: {
        nombre: "Producción en Masa",
        descripcion: "Para pedidos grandes (100+ piezas)",
        configuracion: {
            factorSeguridad: 1.05,
            usoElectricidad: 600,
            gif: 8,
            aiu: 18,
            margenMinorista: 20,
            margenMayorista: 12,
            costoHoraDiseno: 10000,
            incluirMarcaAgua: false
        }
    }
};

// Variables locales
let perfilEditandoId = null;

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    inicializarPerfiles();
});

function inicializarPerfiles() {
    actualizarGridPerfiles();
    console.log("Módulo de perfiles inicializado");
}

// ============================================
// CREAR PERFIL DESDE TEMPLATE
// ============================================

function crearDesdeTemplate(templateKey) {
    const template = TemplatesPerfiles[templateKey];
    if (!template) {
        Utilidades.mostrarNotificacion('Template no encontrado', 'error');
        return;
    }
    
    const perfil = GestionPerfiles.crearPerfil(
        template.nombre,
        template.descripcion,
        template.configuracion
    );
    
    if (perfil) {
        actualizarGridPerfiles();
        Utilidades.mostrarNotificacion(`Perfil "${template.nombre}" creado exitosamente`, 'success');
    }
}

// ============================================
// ACTUALIZAR GRID DE PERFILES
// ============================================

function actualizarGridPerfiles() {
    const grid = document.getElementById('perfilesGrid');
    const perfiles = GestionPerfiles.listarPerfiles();
    
    if (perfiles.length === 0) {
        grid.innerHTML = `
            <p style="text-align: center; color: #6b7280; padding: 40px; grid-column: 1/-1;">
                No hay perfiles personalizados. Crea uno nuevo o usa una plantilla predefinida.
            </p>
        `;
        return;
    }
    
    grid.innerHTML = '';
    
    perfiles.forEach(perfil => {
        const card = document.createElement('div');
        card.className = 'perfil-card';
        
        const config = perfil.configuracion;
        
        card.innerHTML = `
            <div class="perfil-header">
                <div>
                    <div class="perfil-nombre">${perfil.nombre}</div>
                    <div class="perfil-descripcion">${perfil.descripcion || 'Sin descripción'}</div>
                </div>
            </div>
            
            <div class="perfil-stats">
                <div class="stat-item">
                    <div class="stat-label">Usado</div>
                    <div class="stat-value">${perfil.vecesUsado} veces</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Margen Min.</div>
                    <div class="stat-value">${config.margenMinorista}%</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">GIF + AIU</div>
                    <div class="stat-value">${config.gif}% + ${config.aiu}%</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Hora Diseño</div>
                    <div class="stat-value">${Utilidades.formatearMoneda(config.costoHoraDiseno)}</div>
                </div>
            </div>
            
            <div class="perfil-actions">
                <button class="btn btn-primary btn-small" onclick="cargarPerfilEnCotizacion('${perfil.id}')">
                    🚀 Usar en Cotización
                </button>
                <button class="btn btn-secondary btn-small" onclick="editarPerfil('${perfil.id}')">
                    ✏️ Editar
                </button>
                <button class="btn btn-outline btn-small" onclick="exportarPerfilIndividual('${perfil.id}')">
                    📤 Exportar
                </button>
                <button class="btn btn-outline btn-small" onclick="clonarPerfil('${perfil.id}')">
                    📋 Clonar
                </button>
                <button class="btn btn-outline btn-small" onclick="eliminarPerfil('${perfil.id}')" style="color: #ef4444; border-color: #ef4444;">
                    🗑️
                </button>
            </div>
        `;
        
        grid.appendChild(card);
    });
}

// ============================================
// MODAL DE PERFIL
// ============================================

function mostrarModalPerfil() {
    perfilEditandoId = null;
    document.getElementById('modalTitulo').textContent = '🎯 Nuevo Perfil Personalizado';
    limpiarFormularioPerfil();
    document.getElementById('modalPerfil').classList.add('active');
}

function editarPerfil(perfilId) {
    const perfil = SistemaGestion3D.estado.perfilesProyecto.find(p => p.id === perfilId);
    if (!perfil) return;
    
    perfilEditandoId = perfilId;
    document.getElementById('modalTitulo').textContent = '✏️ Editar Perfil';
    
    const config = perfil.configuracion;
    
    document.getElementById('perfilNombre').value = perfil.nombre;
    document.getElementById('perfilDescripcion').value = perfil.descripcion || '';
    document.getElementById('perfilFactorSeguridad').value = config.factorSeguridad;
    document.getElementById('perfilElectricidad').value = config.usoElectricidad;
    document.getElementById('perfilGIF').value = config.gif;
    document.getElementById('perfilAIU').value = config.aiu;
    document.getElementById('perfilMargenMinorista').value = config.margenMinorista;
    document.getElementById('perfilMargenMayorista').value = config.margenMayorista;
    document.getElementById('perfilCostoHora').value = config.costoHoraDiseno;
    
    document.getElementById('modalPerfil').classList.add('active');
}

function cerrarModalPerfil() {
    document.getElementById('modalPerfil').classList.remove('active');
    perfilEditandoId = null;
}

function limpiarFormularioPerfil() {
    document.getElementById('perfilNombre').value = '';
    document.getElementById('perfilDescripcion').value = '';
    document.getElementById('perfilFactorSeguridad').value = '1.1';
    document.getElementById('perfilElectricidad').value = '600';
    document.getElementById('perfilGIF').value = '15';
    document.getElementById('perfilAIU').value = '25';
    document.getElementById('perfilMargenMinorista').value = '30';
    document.getElementById('perfilMargenMayorista').value = '20';
    document.getElementById('perfilCostoHora').value = '25000';
}

// ============================================
// GUARDAR PERFIL
// ============================================

function guardarPerfil() {
    const nombre = document.getElementById('perfilNombre').value.trim();
    const descripcion = document.getElementById('perfilDescripcion').value.trim();
    
    if (!nombre) {
        Utilidades.mostrarNotificacion('El nombre del perfil es requerido', 'error');
        return;
    }
    
    const datos = {
        factorSeguridad: parseFloat(document.getElementById('perfilFactorSeguridad').value),
        usoElectricidad: parseFloat(document.getElementById('perfilElectricidad').value),
        gif: parseFloat(document.getElementById('perfilGIF').value),
        aiu: parseFloat(document.getElementById('perfilAIU').value),
        margenMinorista: parseFloat(document.getElementById('perfilMargenMinorista').value),
        margenMayorista: parseFloat(document.getElementById('perfilMargenMayorista').value),
        costoHoraDiseno: parseFloat(document.getElementById('perfilCostoHora').value)
    };
    
    if (perfilEditandoId) {
        // Actualizar perfil existente
        GestionPerfiles.actualizarPerfil(perfilEditandoId, {
            nombre: nombre,
            descripcion: descripcion,
            configuracion: datos
        });
        Utilidades.mostrarNotificacion('Perfil actualizado exitosamente', 'success');
    } else {
        // Crear nuevo perfil
        GestionPerfiles.crearPerfil(nombre, descripcion, datos);
        Utilidades.mostrarNotificacion('Perfil creado exitosamente', 'success');
    }
    
    actualizarGridPerfiles();
    cerrarModalPerfil();
}

// ============================================
// ELIMINAR PERFIL
// ============================================

function eliminarPerfil(perfilId) {
    const perfil = SistemaGestion3D.estado.perfilesProyecto.find(p => p.id === perfilId);
    if (!perfil) return;
    
    if (confirm(`¿Estás seguro de que quieres eliminar el perfil "${perfil.nombre}"?`)) {
        GestionPerfiles.eliminarPerfil(perfilId);
        actualizarGridPerfiles();
        Utilidades.mostrarNotificacion('Perfil eliminado exitosamente', 'success');
    }
}

// ============================================
// CLONAR PERFIL
// ============================================

function clonarPerfil(perfilId) {
    const perfilOriginal = SistemaGestion3D.estado.perfilesProyecto.find(p => p.id === perfilId);
    if (!perfilOriginal) return;
    
    const nuevoNombre = prompt('Nombre para el perfil clonado:', `${perfilOriginal.nombre} (Copia)`);
    
    if (nuevoNombre && nuevoNombre.trim()) {
        const perfilClonado = GestionPerfiles.crearPerfil(
            nuevoNombre.trim(),
            perfilOriginal.descripcion,
            perfilOriginal.configuracion
        );
        
        if (perfilClonado) {
            actualizarGridPerfiles();
            Utilidades.mostrarNotificacion('Perfil clonado exitosamente', 'success');
        }
    }
}

// ============================================
// CARGAR PERFIL EN COTIZACIÓN
// ============================================

function cargarPerfilEnCotizacion(perfilId) {
    const perfil = GestionPerfiles.cargarPerfil(perfilId);
    
    if (perfil) {
        // Guardar en localStorage para que cotizacion.html lo pueda leer
        localStorage.setItem('perfilActivo', JSON.stringify(perfil));
        
        Utilidades.mostrarNotificacion('Perfil activado. Redirigiendo a cotización...', 'success');
        
        setTimeout(() => {
            window.location.href = 'cotizacion.html';
        }, 1000);
    }
}

// ============================================
// EXPORTAR/IMPORTAR PERFIL INDIVIDUAL
// ============================================

function exportarPerfilIndividual(perfilId) {
    const perfilJSON = GestionArchivos.exportarPerfil(perfilId);
    
    if (!perfilJSON) {
        Utilidades.mostrarNotificacion('Error al exportar perfil', 'error');
        return;
    }
    
    const perfil = SistemaGestion3D.estado.perfilesProyecto.find(p => p.id === perfilId);
    const nombreArchivo = perfil.nombre.toLowerCase().replace(/\s+/g, '_');
    
    const blob = new Blob([perfilJSON], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `perfil_${nombreArchivo}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    Utilidades.mostrarNotificacion('Perfil exportado exitosamente', 'success');
}

function importarPerfil(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const jsonString = e.target.result;
            const perfil = GestionArchivos.importarPerfil(jsonString);
            
            if (perfil) {
                actualizarGridPerfiles();
                Utilidades.mostrarNotificacion('Perfil importado exitosamente', 'success');
            } else {
                Utilidades.mostrarNotificacion('Error al importar perfil', 'error');
            }
        } catch (error) {
            console.error('Error al importar perfil:', error);
            Utilidades.mostrarNotificacion('Archivo de perfil inválido', 'error');
        }
        
        event.target.value = '';
    };
    
    reader.readAsText(file);
}

// ============================================
// BACKUP COMPLETO
// ============================================

function cargarBackup(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const jsonString = e.target.result;
            const exito = GestionArchivos.importarSistemaCompleto(jsonString);
            
            if (exito) {
                actualizarGridPerfiles();
                Utilidades.mostrarNotificacion('Backup cargado exitosamente', 'success');
                
                setTimeout(() => {
                    location.reload();
                }, 1500);
            }
        } catch (error) {
            console.error('Error al cargar backup:', error);
            Utilidades.mostrarNotificacion('Archivo de backup inválido', 'error');
        }
        
        event.target.value = '';
    };
    
    reader.readAsText(file);
}

// Cerrar modal al hacer clic fuera
document.addEventListener('click', function(e) {
    const modal = document.getElementById('modalPerfil');
    if (e.target === modal) {
        cerrarModalPerfil();
    }
});