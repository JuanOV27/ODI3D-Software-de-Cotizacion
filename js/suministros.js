// ============================================
// INVENTARIO DE SUMINISTROS - JAVASCRIPT
// ============================================

// Estado global del módulo
const EstadoSuministros = {
    suministros: [],
    categorias: [
        { id: 'postprocesado', nombre: 'Postprocesado', icono: '🎨' },
        { id: 'paqueteria', nombre: 'Paquetería', icono: '📦' },
        { id: 'accesorios', nombre: 'Accesorios', icono: '🔗' },
        { id: 'herramientas', nombre: 'Herramientas', icono: '🔧' },
        { id: 'varios', nombre: 'Varios', icono: '🧩' }
    ],
    suministroEditando: null
};

// Estado de la foto activa en el modal
let fotoBase64 = null;

// Vista activa: 'tabla' o 'cards'
let vistaActual = 'tabla';

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🧰 Módulo de Suministros cargado');
    cargarSuministros();
    actualizarDashboard();
    cargarCategorias();
});

// ============================================
// CARGA DE DATOS
// ============================================

async function cargarSuministros() {
    try {
        // Llamar a la API usando la acción en español que implementa el backend
        const response = await fetch(`${API_CONFIG.baseURL}/api_suministros.php?action=listar`);

        // Leer como texto primero para capturar cualquier HTML/error que el servidor pueda devolver
        const text = await response.text();

        let data;
        try {
            data = JSON.parse(text);
        } catch (parseErr) {
            console.error('Error al parsear JSON de api_suministros.php:', parseErr);
            console.error('Respuesta cruda del servidor:', text);
            // Mostrar notificación más descriptiva para el usuario
            mostrarNotificacion('Respuesta inválida del servidor al cargar suministros. Revisa la consola (Network/Response).', 'error');
            throw new Error('Respuesta inválida del servidor (no JSON)');
        }

        if (data.success) {
            // La API devuelve el arreglo en la clave `suministros`
            EstadoSuministros.suministros = data.suministros || [];
            renderizarSuministros();
            actualizarDashboard();
        } else {
            console.error('Error al cargar suministros:', data.message || data.error || data);
            mostrarNotificacion('Error al cargar suministros', 'error');
        }
    } catch (error) {
        console.error('Error en la petición:', error);
        // Cargar datos de ejemplo si no hay conexión
        cargarDatosEjemplo();
        mostrarNotificacion('Cargando datos de ejemplo (sin conexión a BD)', 'warning');
    }
}

function cargarDatosEjemplo() {
    EstadoSuministros.suministros = [
        {
            id: 'sum_001',
            nombre: 'Pintura Acrílica Roja',
            categoria: 'postprocesado',
            precio: 15000,
            unidades: 5,
            unidadMedida: 'unidades',
            descripcion: 'Pintura acrílica de alta calidad para acabados',
            marca: 'Rust-Oleum',
            color: '#ff0000',
            stockMinimo: 2,
            fechaCreacion: new Date().toISOString()
        },
        {
            id: 'sum_002',
            nombre: 'Cajas de Cartón 20x15x10',
            categoria: 'paqueteria',
            precio: 800,
            unidades: 50,
            unidadMedida: 'unidades',
            descripcion: 'Cajas resistentes para envíos',
            medidas: '20cm x 15cm x 10cm',
            stockMinimo: 10,
            fechaCreacion: new Date().toISOString()
        },
        {
            id: 'sum_003',
            nombre: 'Llaveros Metálicos',
            categoria: 'accesorios',
            precio: 500,
            unidades: 100,
            unidadMedida: 'unidades',
            descripcion: 'Llaveros de acero inoxidable',
            marca: 'Generic',
            stockMinimo: 20,
            fechaCreacion: new Date().toISOString()
        }
    ];
    renderizarSuministros();
    actualizarDashboard();
}

// ============================================
// RENDERIZADO
// ============================================

function renderizarSuministros() {
    const tbody = document.getElementById('listaSuministros');

    if (EstadoSuministros.suministros.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 40px; color: #6b7280;">
                    No hay suministros registrados. Agrega uno nuevo para comenzar.
                </td>
            </tr>
        `;
        renderizarCards();
        return;
    }

    tbody.innerHTML = EstadoSuministros.suministros.map(suministro => {
        const categoria = EstadoSuministros.categorias.find(c => c.id === suministro.categoria);
        const estadoStock = obtenerEstadoStock(suministro);
        
        return `
            <tr>
                <td>
                    ${suministro.foto ? 
                        `<img src="${suministro.foto}" class="foto-producto" alt="${suministro.nombre}">` :
                        `<div style="width: 60px; height: 60px; background: #e5e7eb; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">${categoria ? categoria.icono : '📦'}</div>`
                    }
                </td>
                <td>
                    <strong>${suministro.nombre}</strong>
                    ${suministro.marca ? `<br><small style="color: #6b7280;">${suministro.marca}</small>` : ''}
                </td>
                <td>
                    <span class="categoria-badge categoria-${suministro.categoria}">
                        ${categoria ? categoria.icono + ' ' + categoria.nombre : suministro.categoria}
                    </span>
                </td>
                <td><strong>$${formatearNumero(suministro.precio)}</strong></td>
                <td>${suministro.unidades}</td>
                <td>${suministro.unidadMedida}</td>
                <td>
                    <span class="estado-badge estado-${estadoStock.clase}">
                        ${estadoStock.icono} ${estadoStock.texto}
                    </span>
                </td>
                <td>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-view" onclick="verDetallesSuministro('${suministro.id}')">
                            👁️ Ver
                        </button>
                        <button class="btn btn-edit" onclick="editarSuministro('${suministro.id}')">
                            ✏️
                        </button>
                        <button class="btn btn-danger" onclick="eliminarSuministro('${suministro.id}')" 
                                style="padding: 8px 12px; font-size: 0.9rem;">
                            🗑️
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    renderizarCards();
}

// ============================================
// VISTA DE TARJETAS (CARD VIEW)
// ============================================

function toggleVista(modo) {
    vistaActual = modo;
    const tableWrapper = document.getElementById('tablaWrapper');
    const cardsWrapper = document.getElementById('cardsWrapper');
    const btnTabla = document.getElementById('btnVistaTabla');
    const btnCards = document.getElementById('btnVistaCards');

    if (modo === 'tabla') {
        tableWrapper.style.display = 'block';
        cardsWrapper.style.display = 'none';
        btnTabla.classList.add('btn-primary');
        btnTabla.classList.remove('btn-outline');
        btnCards.classList.add('btn-outline');
        btnCards.classList.remove('btn-primary');
    } else {
        tableWrapper.style.display = 'none';
        cardsWrapper.style.display = 'grid';
        btnTabla.classList.add('btn-outline');
        btnTabla.classList.remove('btn-primary');
        btnCards.classList.add('btn-primary');
        btnCards.classList.remove('btn-outline');
    }
}

function renderizarCards(suministrosParam) {
    const cardsWrapper = document.getElementById('cardsWrapper');
    if (!cardsWrapper) return;

    const lista = suministrosParam || EstadoSuministros.suministros;

    if (lista.length === 0) {
        cardsWrapper.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: #6B7280;">
                <div style="font-size: 3.5rem; margin-bottom: 12px;">🧰</div>
                <p style="font-family: 'Montserrat', sans-serif; font-size: 1.1rem; font-weight: 600;">No hay suministros registrados</p>
            </div>`;
        return;
    }

    cardsWrapper.innerHTML = lista.map(suministro => {
        const categoria = EstadoSuministros.categorias.find(c => c.id === suministro.categoria);
        const estadoStock = obtenerEstadoStock(suministro);

        const imgHTML = suministro.foto
            ? `<img src="${suministro.foto}" alt="${suministro.nombre}" class="supply-card-img-photo">`
            : `<div class="supply-card-img-placeholder">${categoria ? categoria.icono : '📦'}</div>`;

        return `
            <div class="supply-card">
                <div class="supply-card-img">${imgHTML}</div>
                <div class="supply-card-body">
                    <div class="supply-card-categoria">
                        <span class="categoria-badge categoria-${suministro.categoria}">
                            ${categoria ? categoria.icono + ' ' + categoria.nombre : suministro.categoria}
                        </span>
                    </div>
                    <h4 class="supply-card-nombre">${suministro.nombre}</h4>
                    ${suministro.marca ? `<p class="supply-card-marca">${suministro.marca}</p>` : ''}
                    <div class="supply-card-precio">$${formatearNumero(suministro.precio)}</div>
                    <div class="supply-card-stock">
                        <span class="estado-badge estado-${estadoStock.clase}">
                            ${estadoStock.icono} ${suministro.unidades} ${suministro.unidadMedida || 'u'}
                        </span>
                    </div>
                    <div class="supply-card-acciones">
                        <button class="btn btn-view" onclick="verDetallesSuministro('${suministro.id}')" title="Ver detalles">👁️</button>
                        <button class="btn btn-edit" onclick="editarSuministro('${suministro.id}')" title="Editar">✏️</button>
                        <button class="btn btn-danger" onclick="eliminarSuministro('${suministro.id}')" title="Eliminar" style="padding:7px 12px;">🗑️</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function obtenerEstadoStock(suministro) {
    const stockMinimo = suministro.stockMinimo || 5;
    
    if (suministro.unidades === 0) {
        return { clase: 'agotado', icono: '❌', texto: 'Agotado' };
    } else if (suministro.unidades <= stockMinimo) {
        return { clase: 'bajo', icono: '⚠️', texto: 'Stock Bajo' };
    } else {
        return { clase: 'disponible', icono: '✅', texto: 'Disponible' };
    }
}

function actualizarDashboard() {
    // Total de suministros
    document.getElementById('totalSuministros').textContent = EstadoSuministros.suministros.length;
    
    // Valor total del inventario
    const valorTotal = EstadoSuministros.suministros.reduce((sum, s) => 
        sum + (s.precio * s.unidades), 0);
    document.getElementById('valorInventario').textContent = `$${formatearNumero(valorTotal)}`;
    
    // Stock bajo
    const stockBajo = EstadoSuministros.suministros.filter(s => {
        const stockMinimo = s.stockMinimo || 5;
        return s.unidades <= stockMinimo && s.unidades > 0;
    }).length;
    document.getElementById('stockBajo').textContent = stockBajo;
    
    // Categorías activas
    const categoriasActivas = new Set(EstadoSuministros.suministros.map(s => s.categoria)).size;
    document.getElementById('totalCategorias').textContent = categoriasActivas;
}

// ============================================
// MODAL: AGREGAR/EDITAR SUMINISTRO
// ============================================

function mostrarModalSuministro(id = null) {
    const modal = document.getElementById('modalSuministro');
    const titulo = document.getElementById('tituloModalSuministro');
    const form = document.getElementById('formSuministro');
    
    if (id) {
        // Modo edición
        const suministro = EstadoSuministros.suministros.find(s => s.id === id);
        if (!suministro) return;
        
        titulo.textContent = '✏️ Editar Suministro';
        EstadoSuministros.suministroEditando = id;
        
        // Llenar formulario
        document.getElementById('nombreSuministro').value = suministro.nombre;
        document.getElementById('categoriaSuministro').value = suministro.categoria;
        document.getElementById('precioSuministro').value = suministro.precio;
        document.getElementById('unidadesSuministro').value = suministro.unidades;
        document.getElementById('unidadMedida').value = suministro.unidadMedida || 'unidades';
        document.getElementById('descripcionSuministro').value = suministro.descripcion;
        document.getElementById('marcaSuministro').value = suministro.marca || '';
        document.getElementById('colorSuministro').value = suministro.colorNombre || '';
        document.getElementById('colorSuministroPicker').value = suministro.color || '#000000';
        document.getElementById('medidas').value = suministro.medidas || '';
        document.getElementById('fechaCompra').value = suministro.fechaCompra || '';
        document.getElementById('stockMinimo').value = suministro.stockMinimo || 5;
        document.getElementById('notasSuministro').value = suministro.notas || '';

        // Pre-cargar foto existente
        fotoBase64 = suministro.foto || null;
        if (fotoBase64) {
            document.getElementById('imgPreview').src = fotoBase64;
            document.getElementById('previewFoto').style.display = 'block';
        } else {
            document.getElementById('previewFoto').style.display = 'none';
        }
    } else {
        // Modo creación
        titulo.textContent = '➕ Agregar Nuevo Suministro';
        EstadoSuministros.suministroEditando = null;
        fotoBase64 = null;
        form.reset();
        document.getElementById('previewFoto').style.display = 'none';
    }

    modal.style.display = 'flex';
}

function cerrarModalSuministro() {
    document.getElementById('modalSuministro').style.display = 'none';
    document.getElementById('formSuministro').reset();
    document.getElementById('previewFoto').style.display = 'none';
    EstadoSuministros.suministroEditando = null;
    fotoBase64 = null;
}

async function guardarSuministro(event) {
    event.preventDefault();
    
    const form = document.getElementById('formSuministro');
    const formData = new FormData(form);
    
    const suministro = {
        id: EstadoSuministros.suministroEditando || generarId('SUM'),
        nombre: document.getElementById('nombreSuministro').value,
        categoria: document.getElementById('categoriaSuministro').value,
        precio: parseFloat(document.getElementById('precioSuministro').value),
        unidades: parseFloat(document.getElementById('unidadesSuministro').value),
        unidadMedida: document.getElementById('unidadMedida').value,
        descripcion: document.getElementById('descripcionSuministro').value,
        marca: document.getElementById('marcaSuministro').value,
        colorNombre: document.getElementById('colorSuministro').value,
        color: document.getElementById('colorSuministroPicker').value,
        medidas: document.getElementById('medidas').value,
        fechaCompra: document.getElementById('fechaCompra').value,
        stockMinimo: parseFloat(document.getElementById('stockMinimo').value) || 5,
        notas: document.getElementById('notasSuministro').value,
        foto: fotoBase64,
        fechaCreacion: EstadoSuministros.suministroEditando ?
            EstadoSuministros.suministros.find(s => s.id === EstadoSuministros.suministroEditando).fechaCreacion :
            new Date().toISOString(),
        fechaModificacion: new Date().toISOString()
    };
    
    try {
        const action = EstadoSuministros.suministroEditando ? 'actualizar' : 'crear';
        const response = await fetch(`${API_CONFIG.baseURL}/api_suministros.php?action=${action}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(suministro)
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Actualizar localmente
            if (EstadoSuministros.suministroEditando) {
                const index = EstadoSuministros.suministros.findIndex(s => s.id === suministro.id);
                EstadoSuministros.suministros[index] = suministro;
            } else {
                EstadoSuministros.suministros.push(suministro);
            }
            
            renderizarSuministros();
            actualizarDashboard();
            cerrarModalSuministro();
            mostrarNotificacion('Suministro guardado exitosamente', 'exito');
        } else {
            mostrarNotificacion('Error al guardar: ' + data.message, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        // Guardar localmente si no hay conexión
        if (EstadoSuministros.suministroEditando) {
            const index = EstadoSuministros.suministros.findIndex(s => s.id === suministro.id);
            EstadoSuministros.suministros[index] = suministro;
        } else {
            EstadoSuministros.suministros.push(suministro);
        }
        
        renderizarSuministros();
        actualizarDashboard();
        cerrarModalSuministro();
        mostrarNotificacion('Suministro guardado localmente (sin conexión a BD)', 'warning');
    }
}

// ============================================
// ACCIONES: EDITAR, ELIMINAR, VER DETALLES
// ============================================

function editarSuministro(id) {
    mostrarModalSuministro(id);
}

async function eliminarSuministro(id) {
    const suministro = EstadoSuministros.suministros.find(s => s.id === id);
    if (!suministro) return;
    
    if (!confirm(`¿Estás seguro de eliminar "${suministro.nombre}"?`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_CONFIG.baseURL}/api_suministros.php?action=eliminar`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ id })
        });
        
        const data = await response.json();
        
        if (data.success) {
            EstadoSuministros.suministros = EstadoSuministros.suministros.filter(s => s.id !== id);
            renderizarSuministros();
            actualizarDashboard();
            mostrarNotificacion('Suministro eliminado exitosamente', 'exito');
        } else {
            mostrarNotificacion('Error al eliminar: ' + data.message, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        // Eliminar localmente
        EstadoSuministros.suministros = EstadoSuministros.suministros.filter(s => s.id !== id);
        renderizarSuministros();
        actualizarDashboard();
        mostrarNotificacion('Suministro eliminado localmente (sin conexión a BD)', 'warning');
    }
}

function verDetallesSuministro(id) {
    const suministro = EstadoSuministros.suministros.find(s => s.id === id);
    if (!suministro) return;
    
    const categoria = EstadoSuministros.categorias.find(c => c.id === suministro.categoria);
    const estadoStock = obtenerEstadoStock(suministro);
    
    const contenido = `
        <div style="display: grid; gap: 20px;">
            ${suministro.foto ? 
                `<div style="text-align: center;">
                    <img src="${suministro.foto}" style="max-width: 100%; max-height: 300px; border-radius: 12px; border: 2px solid #e5e7eb;">
                </div>` : ''
            }
            
            <div>
                <h3 style="color: #1f2937; margin-bottom: 10px;">${suministro.nombre}</h3>
                <p style="color: #6b7280; margin-bottom: 20px;">${suministro.descripcion}</p>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                    <div>
                        <strong style="color: #374151;">Categoría:</strong>
                        <p>${categoria ? categoria.icono + ' ' + categoria.nombre : suministro.categoria}</p>
                    </div>
                    <div>
                        <strong style="color: #374151;">Precio Unitario:</strong>
                        <p style="font-size: 1.2rem; color: #10b981;">$${formatearNumero(suministro.precio)}</p>
                    </div>
                    <div>
                        <strong style="color: #374151;">Stock:</strong>
                        <p><span class="estado-badge estado-${estadoStock.clase}">${estadoStock.icono} ${suministro.unidades} ${suministro.unidadMedida}</span></p>
                    </div>
                    ${suministro.marca ? `
                        <div>
                            <strong style="color: #374151;">Marca:</strong>
                            <p>${suministro.marca}</p>
                        </div>
                    ` : ''}
                    ${suministro.colorNombre ? `
                        <div>
                            <strong style="color: #374151;">Color:</strong>
                            <p>
                                <span style="display: inline-block; width: 20px; height: 20px; background: ${suministro.color}; border-radius: 4px; border: 1px solid #d1d5db; vertical-align: middle;"></span>
                                ${suministro.colorNombre}
                            </p>
                        </div>
                    ` : ''}
                    ${suministro.medidas ? `
                        <div>
                            <strong style="color: #374151;">Medidas:</strong>
                            <p>${suministro.medidas}</p>
                        </div>
                    ` : ''}
                    ${suministro.fechaCompra ? `
                        <div>
                            <strong style="color: #374151;">Fecha de Compra:</strong>
                            <p>${new Date(suministro.fechaCompra).toLocaleDateString('es-CO')}</p>
                        </div>
                    ` : ''}
                    <div>
                        <strong style="color: #374151;">Stock Mínimo:</strong>
                        <p>${suministro.stockMinimo || 5} ${suministro.unidadMedida}</p>
                    </div>
                    <div>
                        <strong style="color: #374151;">Valor Total:</strong>
                        <p style="font-size: 1.2rem; color: #6366f1;">$${formatearNumero(suministro.precio * suministro.unidades)}</p>
                    </div>
                </div>
                
                ${suministro.notas ? `
                    <div style="margin-top: 20px; padding: 15px; background: #f9fafb; border-radius: 8px;">
                        <strong style="color: #374151;">Notas:</strong>
                        <p style="margin-top: 8px; color: #6b7280;">${suministro.notas}</p>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
    
    document.getElementById('contenidoDetalles').innerHTML = contenido;
    document.getElementById('modalDetalles').style.display = 'flex';
}

function cerrarModalDetalles() {
    document.getElementById('modalDetalles').style.display = 'none';
}

// ============================================
// FILTROS
// ============================================

function filtrarSuministros() {
    const categoria = document.getElementById('filtroCategoria').value;
    const stock = document.getElementById('filtroStock').value;
    const busqueda = document.getElementById('buscarSuministro').value.toLowerCase();
    
    let suministrosFiltrados = EstadoSuministros.suministros;
    
    // Filtrar por categoría
    if (categoria) {
        suministrosFiltrados = suministrosFiltrados.filter(s => s.categoria === categoria);
    }
    
    // Filtrar por stock
    if (stock === 'disponible') {
        suministrosFiltrados = suministrosFiltrados.filter(s => s.unidades > (s.stockMinimo || 5));
    } else if (stock === 'bajo') {
        suministrosFiltrados = suministrosFiltrados.filter(s => 
            s.unidades <= (s.stockMinimo || 5) && s.unidades > 0
        );
    } else if (stock === 'agotado') {
        suministrosFiltrados = suministrosFiltrados.filter(s => s.unidades === 0);
    }
    
    // Filtrar por búsqueda
    if (busqueda) {
        suministrosFiltrados = suministrosFiltrados.filter(s => 
            s.nombre.toLowerCase().includes(busqueda) ||
            (s.marca && s.marca.toLowerCase().includes(busqueda)) ||
            s.descripcion.toLowerCase().includes(busqueda)
        );
    }
    
    // Renderizar con array temporal
    const suministrosOriginales = EstadoSuministros.suministros;
    EstadoSuministros.suministros = suministrosFiltrados;
    renderizarSuministros();
    renderizarCards(suministrosFiltrados);
    EstadoSuministros.suministros = suministrosOriginales;
}

// ============================================
// CATEGORÍAS
// ============================================

function mostrarModalCategoria() {
    cargarListaCategorias();
    document.getElementById('modalCategoria').style.display = 'flex';
}

function cerrarModalCategoria() {
    document.getElementById('modalCategoria').style.display = 'none';
}

function cargarListaCategorias() {
    const lista = document.getElementById('listaCategorias');
    
    lista.innerHTML = EstadoSuministros.categorias.map(cat => `
        <div class="categoria-item">
            <div class="categoria-info">
                <span class="categoria-icon-large">${cat.icono}</span>
                <span>${cat.nombre}</span>
            </div>
            <div>
                <span style="color: #6b7280; margin-right: 15px;">
                    ${EstadoSuministros.suministros.filter(s => s.categoria === cat.id).length} suministros
                </span>
            </div>
        </div>
    `).join('');
}

function agregarCategoria() {
    const nombre = document.getElementById('nuevaCategoriaNombre').value.trim();
    const icono = document.getElementById('nuevaCategoriaIcono').value.trim();
    
    if (!nombre) {
        mostrarNotificacion('Ingresa un nombre para la categoría', 'warning');
        return;
    }
    
    const id = nombre.toLowerCase().replace(/\s+/g, '_');
    
    if (EstadoSuministros.categorias.find(c => c.id === id)) {
        mostrarNotificacion('Esta categoría ya existe', 'warning');
        return;
    }
    
    EstadoSuministros.categorias.push({
        id,
        nombre,
        icono: icono || '📦'
    });
    
    cargarListaCategorias();
    cargarCategorias();
    document.getElementById('nuevaCategoriaNombre').value = '';
    document.getElementById('nuevaCategoriaIcono').value = '';
    mostrarNotificacion('Categoría agregada exitosamente', 'exito');
}

function cargarCategorias() {
    const selectModal = document.getElementById('categoriaSuministro');
    const selectFiltro = document.getElementById('filtroCategoria');
    
    const opciones = EstadoSuministros.categorias.map(cat => 
        `<option value="${cat.id}">${cat.icono} ${cat.nombre}</option>`
    ).join('');
    
    selectModal.innerHTML = '<option value="">-- Seleccionar --</option>' + opciones;
    selectFiltro.innerHTML = '<option value="">Todas las categorías</option>' + opciones;
}

// ============================================
// EXPORTAR INVENTARIO
// ============================================

function exportarInventario() {
    const datos = {
        fecha_exportacion: new Date().toISOString(),
        total_suministros: EstadoSuministros.suministros.length,
        valor_total: EstadoSuministros.suministros.reduce((sum, s) => sum + (s.precio * s.unidades), 0),
        suministros: EstadoSuministros.suministros
    };
    
    const json = JSON.stringify(datos, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inventario_suministros_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    mostrarNotificacion('Inventario exportado exitosamente', 'exito');
}

// ============================================
// PREVISUALIZAR FOTO
// ============================================

function previsualizarFoto(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        fotoBase64 = e.target.result;
        document.getElementById('imgPreview').src = fotoBase64;
        document.getElementById('previewFoto').style.display = 'block';
    };
    reader.readAsDataURL(file);
}

// ============================================
// UTILIDADES
// ============================================

function generarId(prefijo = 'SUM') {
    return `${prefijo}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function formatearNumero(numero) {
    return new Intl.NumberFormat('es-CO').format(numero);
}

function mostrarNotificacion(mensaje, tipo = 'info') {
    const container = document.getElementById('notificaciones');
    
    const notif = document.createElement('div');
    notif.className = `notificacion notificacion-${tipo}`;
    
    const iconos = {
        'exito': '✅',
        'error': '❌',
        'warning': '⚠️',
        'info': 'ℹ️'
    };
    
    notif.innerHTML = `
        <div style="font-size: 1.5rem;">${iconos[tipo] || 'ℹ️'}</div>
        <div>
            <strong>${mensaje}</strong>
        </div>
    `;
    
    container.appendChild(notif);
    
    setTimeout(() => {
        notif.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notif.remove(), 300);
    }, 3000);
}

// ============================================
// CERRAR MODALES AL HACER CLICK FUERA
// ============================================

window.onclick = function(event) {
    const modales = ['modalSuministro', 'modalDetalles', 'modalCategoria'];
    modales.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
};