// ============================================
// MÓDULO DE SELECCIÓN DE FILAMENTO EN COTIZACIÓN
// ============================================

let filamentoSeleccionado = null;
let carretesDisponibles = [];

// ============================================
// INICIALIZACIÓN
// ============================================

async function inicializarModuloFilamento() {
    await cargarPerfilesEnCotizacion();
    console.log("✅ Módulo de selección de filamento inicializado");
}

// ============================================
// CARGA DE PERFILES
// ============================================

async function cargarPerfilesEnCotizacion() {
    const select = document.getElementById('perfilFilamentoCotizacion');
    if (!select) return;
    
    select.innerHTML = '<option value="">-- Seleccionar del inventario --</option>';
    
    try {
        const perfiles = await GestionFilamentos.listarPerfiles();
        
        if (!Array.isArray(perfiles) || perfiles.length === 0) {
            const option = document.createElement('option');
            option.value = "";
            option.textContent = "⚠️ No hay perfiles disponibles";
            option.disabled = true;
            select.appendChild(option);
            return;
        }
        
        // Obtener también los carretes del inventario
        carretesDisponibles = await GestionInventario.obtenerCarretesDisponibles();
        
        perfiles.forEach((perfil) => {
            const option = document.createElement('option');
            option.value = perfil.id;
            
            // Buscar si hay carretes de este perfil
            const carrete = carretesDisponibles.find(c => c.perfil_id === perfil.id);
            
            // Calcular disponible de forma segura
            let disponible = 0;
            if (carrete) {
                const pesoInicial = parseFloat(carrete.peso_inicial || carrete.pesoInicial || 0);
                const pesoUsado = parseFloat(carrete.peso_usado || carrete.pesoUsado || 0);
                const pesoRestante = parseFloat(carrete.peso_restante);
                
                // Usar peso_restante si existe, sino calcularlo
                disponible = !isNaN(pesoRestante) ? pesoRestante : (pesoInicial - pesoUsado);
            }
            
            // Asegurar que disponible es un número válido
            disponible = isNaN(disponible) || disponible < 0 ? 0 : disponible;
            
            option.textContent = `${perfil.tipo} - ${perfil.marca} - ${perfil.color_nombre || perfil.colorNombre} (${disponible.toFixed(0)}g disponibles)`;
            option.dataset.perfilData = JSON.stringify(perfil);
            option.dataset.carreteData = carrete ? JSON.stringify(carrete) : null;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error al cargar perfiles en cotización:', error);
        Utilidades.mostrarNotificacion('Error al cargar perfiles de filamento', 'error');
    }
}

// ============================================
// SELECCIÓN DE PERFIL
// ============================================

async function cargarPerfilFilamentoEnCotizacion() {
    const select = document.getElementById('perfilFilamentoCotizacion');
    const perfilId = select.value;
    const infoContainer = document.getElementById('infoFilamentoSeleccionado');
    
    if (!perfilId) {
        infoContainer.style.display = 'none';
        filamentoSeleccionado = null;
        return;
    }
    
    try {
        const selectedOption = select.options[select.selectedIndex];
        const perfil = JSON.parse(selectedOption.dataset.perfilData);
        const carrete = selectedOption.dataset.carreteData ? JSON.parse(selectedOption.dataset.carreteData) : null;
        
        filamentoSeleccionado = { perfil, carrete };
        
        // Mostrar información del filamento
        mostrarInfoFilamento(perfil, carrete);
        
        // Auto-completar campos de cotización
        // Los campos en la BD son: peso (en kg) y costo (en COP)
        const costo = parseFloat(perfil.costo || 0);
        const peso = parseFloat(perfil.peso || 0);
        
        console.log('📊 Auto-completando valores:', { costo, peso, perfil });
        
        if (costo > 0) {
            const inputCosto = document.getElementById('costoCarrete');
            if (inputCosto) {
                inputCosto.value = costo;
                console.log('✅ Costo auto-completado:', costo);
            }
        }
        
        if (peso > 0) {
            const inputPeso = document.getElementById('pesoCarrete');
            if (inputPeso) {
                inputPeso.value = peso;
                console.log('✅ Peso auto-completado:', peso);
            }
        }
        
        infoContainer.style.display = 'block';
        
        Utilidades.mostrarNotificacion(`Filamento "${perfil.tipo} - ${perfil.marca}" seleccionado`, 'success');
        
    } catch (error) {
        console.error('Error al cargar perfil en cotización:', error);
        Utilidades.mostrarNotificacion('Error al cargar información del filamento', 'error');
    }
}

// ============================================
// VISUALIZACIÓN DE INFORMACIÓN
// ============================================

function mostrarInfoFilamento(perfil, carrete) {
    // Color
    const colorIndicador = document.getElementById('colorIndicadorCotizacion');
    colorIndicador.style.backgroundColor = perfil.color_codigo || perfil.colorCodigo || '#000000';
    
    // Tipo y marca
    const tipoMarca = document.getElementById('tipoMarcaCotizacion');
    tipoMarca.textContent = `${perfil.tipo} - ${perfil.marca}`;
    
    // Color nombre
    const colorNombre = document.getElementById('colorNombreCotizacion');
    colorNombre.textContent = perfil.color_nombre || perfil.colorNombre || 'Sin nombre';
    
    if (carrete) {
        // Calcular peso disponible con validaciones
        const pesoInicial = parseFloat(carrete.peso_inicial || carrete.pesoInicial || 0);
        const pesoUsado = parseFloat(carrete.peso_usado || carrete.pesoUsado || 0);
        let pesoRestante = parseFloat(carrete.peso_restante);
        
        // Si peso_restante no es válido, calcularlo
        if (isNaN(pesoRestante)) {
            pesoRestante = pesoInicial - pesoUsado;
        }
        
        // Asegurar que los valores sean válidos
        const pesoRestanteValido = isNaN(pesoRestante) || pesoRestante < 0 ? 0 : pesoRestante;
        const pesoInicialValido = isNaN(pesoInicial) || pesoInicial <= 0 ? 1 : pesoInicial;
        const porcentajeRestante = (pesoRestanteValido / pesoInicialValido) * 100;
        
        // Peso disponible
        const pesoDisponible = document.getElementById('pesoDisponibleCotizacion');
        pesoDisponible.textContent = `${pesoRestanteValido.toFixed(0)}g`;
        
        // Estado
        const estadoFilamento = document.getElementById('estadoFilamentoCotizacion');
        const estado = carrete.estado === 'activo' ? '✅ Activo' : '⏸️ Pausado';
        estadoFilamento.textContent = estado;
        estadoFilamento.style.color = carrete.estado === 'activo' ? '#059669' : '#f59e0b';
        
        // Barra de progreso
        const barraProgreso = document.getElementById('barraProgresoCotizacion');
        const porcentajeLimitado = Math.min(100, Math.max(0, porcentajeRestante));
        barraProgreso.style.width = `${porcentajeLimitado}%`;
        
        // Cambiar color según disponibilidad
        barraProgreso.classList.remove('medio', 'bajo');
        if (porcentajeRestante < 20) {
            barraProgreso.classList.add('bajo');
        } else if (porcentajeRestante < 50) {
            barraProgreso.classList.add('medio');
        }
        
        // Porcentaje
        const porcentajeDisplay = document.getElementById('porcentajeDisponibleCotizacion');
        porcentajeDisplay.textContent = `${porcentajeLimitado.toFixed(1)}%`;
        
        // Mostrar alerta si es necesario
        mostrarAlertaDisponibilidad(pesoRestanteValido, porcentajeRestante);
    } else {
        // Sin carrete disponible
        document.getElementById('pesoDisponibleCotizacion').textContent = '0g';
        document.getElementById('estadoFilamentoCotizacion').textContent = '❌ Sin carrete';
        document.getElementById('estadoFilamentoCotizacion').style.color = '#dc2626';
        document.getElementById('barraProgresoCotizacion').style.width = '0%';
        document.getElementById('porcentajeDisponibleCotizacion').textContent = '0%';
        
        mostrarAlertaDisponibilidad(0, 0);
    }
}

function mostrarAlertaDisponibilidad(pesoRestante, porcentaje) {
    // Remover alertas previas
    const alertaExistente = document.querySelector('.alerta-disponibilidad');
    if (alertaExistente) {
        alertaExistente.remove();
    }
    
    const container = document.getElementById('infoFilamentoSeleccionado');
    const alerta = document.createElement('div');
    alerta.className = 'alerta-disponibilidad';
    
    if (pesoRestante === 0) {
        alerta.classList.add('critico');
        alerta.innerHTML = '⚠️ <strong>Sin material disponible</strong> - Necesitas un nuevo carrete';
    } else if (porcentaje < 20) {
        alerta.classList.add('critico');
        alerta.innerHTML = '⚠️ <strong>Material crítico</strong> - Considera tener un carrete de respaldo';
    } else if (porcentaje < 50) {
        alerta.classList.add('advertencia');
        alerta.innerHTML = '⚡ <strong>Material medio</strong> - Planifica tu próxima compra';
    } else {
        alerta.classList.add('suficiente');
        alerta.innerHTML = '✅ <strong>Material suficiente</strong> - Listo para producir';
    }
    
    container.querySelector('.filamento-info-card').appendChild(alerta);
}

// ============================================
// VALIDACIÓN ANTES DE CALCULAR
// ============================================

function validarDisponibilidadFilamento(gramosNecesarios) {
    if (!filamentoSeleccionado || !filamentoSeleccionado.carrete) {
        return {
            valido: false,
            mensaje: 'No hay un carrete seleccionado'
        };
    }
    
    const carrete = filamentoSeleccionado.carrete;
    const pesoInicial = parseFloat(carrete.peso_inicial || carrete.pesoInicial || 0);
    const pesoUsado = parseFloat(carrete.peso_usado || carrete.pesoUsado || 0);
    let pesoRestante = parseFloat(carrete.peso_restante);
    
    // Si peso_restante no es válido, calcularlo
    if (isNaN(pesoRestante)) {
        pesoRestante = pesoInicial - pesoUsado;
    }
    
    // Asegurar que los valores sean válidos
    const pesoRestanteValido = isNaN(pesoRestante) || pesoRestante < 0 ? 0 : pesoRestante;
    const gramosNecesariosValidos = isNaN(gramosNecesarios) || gramosNecesarios < 0 ? 0 : gramosNecesarios;
    
    if (pesoRestanteValido < gramosNecesariosValidos) {
        return {
            valido: false,
            mensaje: `Filamento insuficiente. Necesitas ${gramosNecesariosValidos.toFixed(0)}g pero solo hay ${pesoRestanteValido.toFixed(0)}g disponibles`,
            faltante: gramosNecesariosValidos - pesoRestanteValido
        };
    }
    
    return {
        valido: true,
        mensaje: 'Filamento suficiente',
        sobrante: pesoRestanteValido - gramosNecesariosValidos
    };
}

// ============================================
// INTEGRACIÓN CON EL CÁLCULO
// ============================================

// Esta función se puede llamar después de calcular para avisar si hay suficiente material
function verificarMaterialDespuesDeCalcular(gramosNecesarios) {
    const validacion = validarDisponibilidadFilamento(gramosNecesarios);
    
    if (!validacion.valido) {
        Utilidades.mostrarNotificacion(validacion.mensaje, 'warning');
        
        // Actualizar la alerta en el módulo
        if (filamentoSeleccionado && filamentoSeleccionado.carrete) {
            const carrete = filamentoSeleccionado.carrete;
            const pesoInicial = parseFloat(carrete.peso_inicial || carrete.pesoInicial || 0);
            const pesoUsado = parseFloat(carrete.peso_usado || carrete.pesoUsado || 0);
            let pesoRestante = parseFloat(carrete.peso_restante);
            
            // Si peso_restante no es válido, calcularlo
            if (isNaN(pesoRestante)) {
                pesoRestante = pesoInicial - pesoUsado;
            }
            
            // Asegurar que los valores sean válidos
            const pesoRestanteValido = isNaN(pesoRestante) || pesoRestante < 0 ? 0 : pesoRestante;
            const pesoInicialValido = isNaN(pesoInicial) || pesoInicial <= 0 ? 1 : pesoInicial;
            const porcentajeRestante = (pesoRestanteValido / pesoInicialValido) * 100;
            
            mostrarAlertaDisponibilidad(pesoRestanteValido, porcentajeRestante);
        }
    } else if (validacion.sobrante < 100) {
        Utilidades.mostrarNotificacion('⚠️ El material es justo suficiente. Considera tener un carrete de respaldo.', 'info');
    }
}

// ============================================
// FUNCIÓN PARA REGISTRAR USO DESDE COTIZACIÓN
// ============================================

async function registrarUsoDesdeCotzacion(gramosUsados) {
    if (!filamentoSeleccionado || !filamentoSeleccionado.carrete) {
        Utilidades.mostrarNotificacion('No hay un carrete seleccionado', 'error');
        return false;
    }
    
    try {
        const carreteId = filamentoSeleccionado.carrete.id || filamentoSeleccionado.carrete.carrete_id;
        const exito = await GestionInventario.registrarUso(carreteId, gramosUsados);
        
        if (exito) {
            // Recargar información
            await cargarPerfilesEnCotizacion();
            await cargarPerfilFilamentoEnCotizacion();
            Utilidades.mostrarNotificacion(`Uso de ${gramosUsados}g registrado exitosamente`, 'success');
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error al registrar uso desde cotización:', error);
        Utilidades.mostrarNotificacion('Error al registrar uso: ' + error.message, 'error');
        return false;
    }
}

// ============================================
// INICIALIZAR CUANDO EL DOM ESTÉ LISTO
// ============================================

// Solo inicializar si estamos en la página de cotización
if (document.getElementById('perfilFilamentoCotizacion')) {
    document.addEventListener('DOMContentLoaded', async function() {
        // Esperar a que el sistema principal se inicialice
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
        
        await inicializarModuloFilamento();
    });
}