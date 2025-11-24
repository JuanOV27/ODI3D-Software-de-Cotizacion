// ============================================
// ACCIONES_COTIZACION.JS
// Funcionalidades de WhatsApp y Guardar Proyecto
// ============================================

// Estado global para datos de la última cotización
let ultimaCotizacion = {
    nombre_pieza: '',
    material: '',
    cantidad: 0,
    precio_minorista: 0,
    precio_mayorista: 0,
    precio_unitario_minorista: 0,
    precio_unitario_mayorista: 0,
    costo_delivery: 0,
    tipo_delivery: '',
    requiere_delivery: false,
    cotizacion_id: ''
};

// ============================================
// MODAL WHATSAPP
// ============================================

function abrirModalWhatsApp() {
    // Verificar que haya una cotización calculada
    if (!ultimaCotizacion.cotizacion_id) {
        alert('⚠️ Primero debes calcular una cotización');
        return;
    }
    
    const modal = document.getElementById('modalWhatsApp');
    if (modal) {
        modal.style.display = 'flex';
        
        // Configurar event listeners para actualizar preview
        configurarEventosWhatsApp();
        
        // Generar preview inicial
        actualizarPreviewWhatsApp();
    }
}

function cerrarModalWhatsApp() {
    const modal = document.getElementById('modalWhatsApp');
    if (modal) modal.style.display = 'none';
}

function configurarEventosWhatsApp() {
    // Checkboxes
    const checkboxes = [
        'whatsapp_incluir_material',
        'whatsapp_incluir_cantidad',
        'whatsapp_incluir_delivery',
        'whatsapp_incluir_unitario'
    ];
    
    checkboxes.forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox) {
            checkbox.addEventListener('change', actualizarPreviewWhatsApp);
        }
    });
    
    // Radio buttons de precio
    const precioOptions = document.querySelectorAll('.precio-option');
    precioOptions.forEach(option => {
        option.addEventListener('click', function() {
            const tipo = this.dataset.tipo;
            
            // Actualizar estilos
            precioOptions.forEach(opt => {
                opt.style.borderColor = '#e5e7eb';
                opt.style.color = '#6b7280';
            });
            
            this.style.borderColor = '#4f46e5';
            this.style.color = '#4f46e5';
            
            // Actualizar radio
            const radio = this.previousElementSibling || this.parentElement.querySelector('input[type="radio"]');
            if (radio) radio.checked = true;
            
            actualizarPreviewWhatsApp();
        });
    });
}

function actualizarPreviewWhatsApp() {
    const incluirMaterial = document.getElementById('whatsapp_incluir_material')?.checked;
    const incluirCantidad = document.getElementById('whatsapp_incluir_cantidad')?.checked;
    const incluirDelivery = document.getElementById('whatsapp_incluir_delivery')?.checked;
    const incluirUnitario = document.getElementById('whatsapp_incluir_unitario')?.checked;
    
    const tipoPrecio = document.querySelector('input[name="tipo_precio_whatsapp"]:checked')?.value || 'minorista';
    
    // Construir mensaje
    let mensaje = `🎨 *COTIZACIÓN DE IMPRESIÓN 3D*\n\n`;
    mensaje += `📦 *Pieza:* ${ultimaCotizacion.nombre_pieza}\n`;
    
    if (incluirMaterial) {
        mensaje += `🧵 *Material:* ${ultimaCotizacion.material}\n`;
    }
    
    if (incluirCantidad) {
        mensaje += `📊 *Cantidad:* ${ultimaCotizacion.cantidad} unidades\n`;
    }
    
    mensaje += `\n💰 *PRECIO*\n`;
    
    const precio = tipoPrecio === 'minorista' 
        ? ultimaCotizacion.precio_minorista 
        : ultimaCotizacion.precio_mayorista;
    
    const precioUnitario = tipoPrecio === 'minorista'
        ? ultimaCotizacion.precio_unitario_minorista
        : ultimaCotizacion.precio_unitario_mayorista;
    
    mensaje += `💵 Precio Total: *$${formatearMonto(precio)}*\n`;
    
    if (incluirUnitario) {
        mensaje += `🔹 Precio por unidad: $${formatearMonto(precioUnitario)}\n`;
    }
    
    if (incluirDelivery && ultimaCotizacion.requiere_delivery) {
        mensaje += `\n🚚 *DELIVERY*\n`;
        mensaje += `📍 Zona: ${ultimaCotizacion.tipo_delivery}\n`;
        mensaje += `💵 Costo: $${formatearMonto(ultimaCotizacion.costo_delivery)}\n`;
    }
    
    mensaje += `\n✨ _Cotización generada el ${new Date().toLocaleDateString('es-CO')}_`;
    mensaje += `\n\n¿Te gustaría proceder con el pedido? 😊`;
    
    // Actualizar preview
    const preview = document.getElementById('whatsapp_preview');
    if (preview) {
        preview.textContent = mensaje;
    }
}

function enviarWhatsApp() {
    // Obtener mensaje
    const preview = document.getElementById('whatsapp_preview');
    if (!preview) return;
    
    const mensaje = preview.textContent;
    
    // Codificar para URL
    const mensajeCodificado = encodeURIComponent(mensaje);
    
    // Generar enlace de WhatsApp (sin número específico, abre lista de contactos)
    const enlace = `https://wa.me/?text=${mensajeCodificado}`;
    
    // Abrir en nueva ventana
    window.open(enlace, '_blank');
    
    // Cerrar modal
    cerrarModalWhatsApp();
}

// ============================================
// MODAL PROYECTO
// ============================================

function abrirModalProyecto() {
    // Verificar que haya una cotización calculada
    if (!ultimaCotizacion.cotizacion_id) {
        alert('⚠️ Primero debes calcular una cotización');
        return;
    }
    
    const modal = document.getElementById('modalProyecto');
    if (modal) {
        modal.style.display = 'flex';
        
        // Limpiar formulario
        document.getElementById('formProyecto')?.reset();
        
        // Establecer fecha de pago actual por defecto
        const hoy = new Date().toISOString().split('T')[0];
        const inputFechaPago = document.getElementById('proyecto_fecha_pago');
        if (inputFechaPago) inputFechaPago.value = hoy;
    }
}

function cerrarModalProyecto() {
    const modal = document.getElementById('modalProyecto');
    if (modal) modal.style.display = 'none';
}

async function guardarProyecto(event) {
    event.preventDefault();
    
    // Obtener datos del formulario
    const formData = new FormData();
    
    // Generar ID único para el proyecto
    const proyectoId = 'PROY_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    formData.append('id', proyectoId);
    formData.append('cotizacion_id', ultimaCotizacion.cotizacion_id);
    
    // Datos del cliente
    formData.append('nombre_completo', document.getElementById('proyecto_nombre')?.value || '');
    formData.append('numero_telefono', document.getElementById('proyecto_telefono')?.value || '');
    formData.append('cedula', document.getElementById('proyecto_cedula')?.value || null);
    formData.append('numero_whatsapp', document.getElementById('proyecto_whatsapp')?.value || '');
    formData.append('direccion', document.getElementById('proyecto_direccion')?.value || null);
    formData.append('barrio', document.getElementById('proyecto_barrio')?.value || null);
    formData.append('municipio', document.getElementById('proyecto_municipio')?.value || null);
    
    // Datos de pago
    formData.append('fecha_pago', document.getElementById('proyecto_fecha_pago')?.value || null);
    formData.append('fecha_entrega', document.getElementById('proyecto_fecha_entrega')?.value || null);
    formData.append('notas', document.getElementById('proyecto_notas')?.value || null);
    
    // Imagen de pago (si existe)
    const imagenPago = document.getElementById('proyecto_imagen_pago')?.files[0];
    if (imagenPago) {
        // Validar tamaño (max 5MB)
        if (imagenPago.size > 5 * 1024 * 1024) {
            alert('❌ La imagen es muy grande. Máximo 5MB');
            return;
        }
        formData.append('imagen_pago', imagenPago);
    }
    
    try {
        // Mostrar loading
        const btnSubmit = event.target.querySelector('button[type="submit"]');
        const textoOriginal = btnSubmit.innerHTML;
        btnSubmit.innerHTML = '<span>⏳</span><span>Guardando...</span>';
        btnSubmit.disabled = true;
        
        // Enviar al backend
        const response = await fetch('/gestion3d/api/api_proyectos.php', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('✅ Proyecto guardado exitosamente\n\nID: ' + proyectoId);
            cerrarModalProyecto();
            
            // Opcional: Recargar historial o actualizar UI
        } else {
            alert('❌ Error al guardar el proyecto:\n' + (result.message || 'Error desconocido'));
        }
        
        // Restaurar botón
        btnSubmit.innerHTML = textoOriginal;
        btnSubmit.disabled = false;
        
    } catch (error) {
        console.error('Error al guardar proyecto:', error);
        alert('❌ Error al guardar el proyecto. Verifica la conexión.');
        
        // Restaurar botón
        const btnSubmit = event.target.querySelector('button[type="submit"]');
        if (btnSubmit) {
            btnSubmit.innerHTML = '<span>💾</span><span>Guardar Proyecto</span>';
            btnSubmit.disabled = false;
        }
    }
}

// ============================================
// ACTUALIZAR DATOS DE COTIZACIÓN
// ============================================

function actualizarDatosParaAcciones(datosRespuesta) {
    // Esta función debe ser llamada después de calcular la cotización
    // Recibe los datos de la respuesta del backend
    
    ultimaCotizacion.nombre_pieza = datosRespuesta.nombre_pieza || 'Pieza sin nombre';
    ultimaCotizacion.material = obtenerMaterialFilamento();
    ultimaCotizacion.cantidad = datosRespuesta.cantidad_piezas || 1;
    ultimaCotizacion.precio_minorista = datosRespuesta.precio_minorista || 0;
    ultimaCotizacion.precio_mayorista = datosRespuesta.precio_mayorista || 0;
    ultimaCotizacion.precio_unitario_minorista = datosRespuesta.precio_minorista / datosRespuesta.cantidad_piezas;
    ultimaCotizacion.precio_unitario_mayorista = datosRespuesta.precio_mayorista / datosRespuesta.cantidad_piezas;
    ultimaCotizacion.costo_delivery = datosRespuesta.costo_delivery_total || 0;
    ultimaCotizacion.tipo_delivery = datosRespuesta.tipo_delivery || '';
    ultimaCotizacion.requiere_delivery = datosRespuesta.requiere_delivery || false;
    ultimaCotizacion.cotizacion_id = datosRespuesta.id || '';
    
    console.log('✅ Datos actualizados para acciones:', ultimaCotizacion);
}

// ============================================
// UTILIDADES
// ============================================

function obtenerMaterialFilamento() {
    // Intentar obtener el material del filamento seleccionado
    const selectFilamento = document.getElementById('perfilFilamentoCotizacion');
    if (!selectFilamento || !selectFilamento.value) return 'Material no especificado';
    
    const opcionSeleccionada = selectFilamento.options[selectFilamento.selectedIndex];
    const texto = opcionSeleccionada.textContent;
    
    // Extraer tipo de material (ej: "PLA - Creality - Blanco" => "PLA")
    const match = texto.match(/^([A-Z]+)/);
    return match ? match[1] : texto.split('-')[0].trim();
}

function formatearMonto(valor) {
    return parseFloat(valor).toLocaleString('es-CO', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });
}

// Cerrar modales al hacer clic fuera
window.addEventListener('click', function(event) {
    const modalWhatsApp = document.getElementById('modalWhatsApp');
    const modalProyecto = document.getElementById('modalProyecto');
    
    if (event.target === modalWhatsApp) {
        cerrarModalWhatsApp();
    }
    
    if (event.target === modalProyecto) {
        cerrarModalProyecto();
    }
});

// Cerrar modales con tecla ESC
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        cerrarModalWhatsApp();
        cerrarModalProyecto();
    }
});

console.log('✅ Módulo de acciones de cotización cargado');
