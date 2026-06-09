// ============================================
// HISTORIAL DE COTIZACIONES
// ============================================

const EstadoHistorial = {
    cotizaciones: [],
    filtradas: [],
    cotizacionActual: null
};

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', function () {
    cargarCotizaciones();

    // Listeners para filtros en tiempo real
    document.getElementById('filtroBusqueda').addEventListener('input', aplicarFiltros);
    document.getElementById('filtroDesde').addEventListener('change', aplicarFiltros);
    document.getElementById('filtroHasta').addEventListener('change', aplicarFiltros);
    document.getElementById('filtroPrecioMin').addEventListener('input', aplicarFiltros);
    document.getElementById('filtroPrecioMax').addEventListener('input', aplicarFiltros);

    // Cerrar modales al hacer click fuera
    window.onclick = function (event) {
        ['modalDetalle', 'modalEliminar', 'modalFactura'].forEach(function (id) {
            const modal = document.getElementById(id);
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    };
});

// ============================================
// CARGA DE DATOS DESDE API
// ============================================

async function cargarCotizaciones() {
    document.getElementById('listaHistorial').innerHTML =
        '<tr><td colspan="10" class="estado-vacio"><span class="estado-vacio-icono">⏳</span>Cargando cotizaciones...</td></tr>';

    try {
        const _apiBase = typeof API_CONFIG !== 'undefined'
            ? API_CONFIG.baseURL
            : window.location.pathname.replace(/\/[^\/]+$/, '') + '/api';
        const url = _apiBase + '/api_cotizaciones.php?action=list';

        const respuesta = await fetch(url);
        const texto = await respuesta.text();

        let datos;
        try {
            datos = JSON.parse(texto);
        } catch (e) {
            console.error('Error al parsear JSON:', texto.substring(0, 300));
            throw new Error('Respuesta del servidor no es JSON válido');
        }

        if (!datos.success) {
            throw new Error(datos.message || 'Error al obtener cotizaciones');
        }

        EstadoHistorial.cotizaciones = Array.isArray(datos.data) ? datos.data : [];
        aplicarFiltros();
        actualizarDashboard();
        mostrarNotificacion('Historial cargado — ' + EstadoHistorial.cotizaciones.length + ' cotizaciones', 'exito');

    } catch (error) {
        console.error('Error cargarCotizaciones:', error);
        document.getElementById('listaHistorial').innerHTML =
            '<tr><td colspan="10" class="estado-vacio"><span class="estado-vacio-icono">❌</span>No se pudo conectar con el servidor. Verifica que el servicio esté activo.</td></tr>';
        mostrarNotificacion('Error al cargar cotizaciones: ' + error.message, 'error');
    }
}

// ============================================
// DASHBOARD DE ESTADÍSTICAS
// ============================================

function actualizarDashboard() {
    const lista = EstadoHistorial.cotizaciones;
    const total = lista.length;

    let valorTotal = 0;
    let fechaMasReciente = null;
    lista.forEach(function (c) {
        const precio = parseFloat(c.precio_minorista) || 0;
        const cantidad = parseInt(c.cantidad_piezas) || 1;
        valorTotal += precio * cantidad;

        const fecha = c.fecha_completa || c.fecha;
        if (fecha && (!fechaMasReciente || new Date(fecha) > new Date(fechaMasReciente))) {
            fechaMasReciente = fecha;
        }
    });

    const promedio = total > 0 ? valorTotal / total : 0;

    document.getElementById('statTotal').textContent = total;
    document.getElementById('statValorTotal').textContent = '$' + formatearNumero(valorTotal);
    document.getElementById('statReciente').textContent = fechaMasReciente
        ? formatearFechaCorta(fechaMasReciente) : '—';
    document.getElementById('statPromedio').textContent = '$' + formatearNumero(promedio);
}

// ============================================
// FILTROS
// ============================================

function aplicarFiltros() {
    const busqueda  = (document.getElementById('filtroBusqueda').value  || '').toLowerCase().trim();
    const desde     =  document.getElementById('filtroDesde').value;
    const hasta     =  document.getElementById('filtroHasta').value;
    const precioMin = parseFloat(document.getElementById('filtroPrecioMin').value) || null;
    const precioMax = parseFloat(document.getElementById('filtroPrecioMax').value) || null;

    EstadoHistorial.filtradas = EstadoHistorial.cotizaciones.filter(function (c) {
        // Búsqueda por nombre
        if (busqueda && !(c.nombre_pieza || '').toLowerCase().includes(busqueda)) return false;

        // Filtro por fecha desde
        if (desde) {
            const fechaC = new Date(c.fecha_completa || c.fecha);
            if (fechaC < new Date(desde)) return false;
        }

        // Filtro por fecha hasta
        if (hasta) {
            const fechaC = new Date(c.fecha_completa || c.fecha);
            if (fechaC > new Date(hasta + 'T23:59:59')) return false;
        }

        // Filtro por precio mínimo
        const precio = parseFloat(c.precio_minorista) || 0;
        if (precioMin !== null && precio < precioMin) return false;
        if (precioMax !== null && precio > precioMax) return false;

        return true;
    });

    renderizarTabla(EstadoHistorial.filtradas);
}

function limpiarFiltros() {
    document.getElementById('filtroBusqueda').value  = '';
    document.getElementById('filtroDesde').value    = '';
    document.getElementById('filtroHasta').value    = '';
    document.getElementById('filtroPrecioMin').value = '';
    document.getElementById('filtroPrecioMax').value = '';
    aplicarFiltros();
}

// ============================================
// RENDERIZADO DE TABLA
// ============================================

function renderizarTabla(lista) {
    const tbody = document.getElementById('listaHistorial');

    if (!lista || lista.length === 0) {
        tbody.innerHTML =
            '<tr><td colspan="10" class="estado-vacio">' +
            '<span class="estado-vacio-icono">📋</span>' +
            'No se encontraron cotizaciones con los filtros aplicados.' +
            '</td></tr>';
        return;
    }

    let html = '';
    lista.forEach(function (c, idx) {
        const nombre  = (c.nombre_pieza || '—');
        const fecha   = formatearFecha(c.fecha_completa || c.fecha);
        const cantidad = parseInt(c.cantidad_piezas) || 0;
        const pFinal  = '$' + formatearNumero(c.precio_final);
        const pMin    = '$' + formatearNumero(c.precio_minorista);
        const pMay    = '$' + formatearNumero(c.precio_mayorista);
        const badgePost = parseInt(c.incluir_postprocesado)
            ? '<span class="badge-si">✅ Sí</span>'
            : '<span class="badge-no">— No</span>';
        const badgeDel = parseInt(c.requiere_delivery)
            ? '<span class="badge-si">✅ Sí</span>'
            : '<span class="badge-no">— No</span>';

        // Escapar nombre para uso seguro en atributos onclick
        const idEsc     = escapeAttr(c.id);
        const nombreEsc = escapeAttr(nombre);

        html += '<tr>' +
            '<td>' + (idx + 1) + '</td>' +
            '<td><span class="pieza-nombre" title="' + nombreEsc + '">' + escaparHTML(nombre) + '</span></td>' +
            '<td>' + fecha + '</td>' +
            '<td>' + cantidad + '</td>' +
            '<td><strong>' + pFinal + '</strong></td>' +
            '<td style="color:#3b82f6;font-weight:600;">' + pMin + '</td>' +
            '<td style="color:#8b5cf6;font-weight:600;">' + pMay + '</td>' +
            '<td>' + badgePost + '</td>' +
            '<td>' + badgeDel + '</td>' +
            '<td>' +
                '<div class="acciones-fila">' +
                    '<button class="btn-accion btn-accion-ver"     onclick="verDetalle(\'' + idEsc + '\')">👁 Ver</button>' +
                    '<button class="btn-accion btn-accion-duplicar" onclick="duplicarCotizacion(\'' + idEsc + '\')">📋 Duplicar</button>' +
                    '<button class="btn-accion btn-accion-factura"  onclick="abrirFactura(\'' + idEsc + '\')">🧾 Factura</button>' +
                    '<button class="btn-accion btn-accion-csv"      onclick="exportarFilaCSV(\'' + idEsc + '\')">📤 CSV</button>' +
                    '<button class="btn-accion btn-accion-eliminar" onclick="confirmarEliminar(\'' + idEsc + '\', \'' + nombreEsc + '\')">🗑 Eliminar</button>' +
                '</div>' +
            '</td>' +
            '</tr>';
    });

    tbody.innerHTML = html;
}

// ============================================
// MODAL: VER DETALLE
// ============================================

function verDetalle(id) {
    const c = EstadoHistorial.cotizaciones.find(function (x) { return x.id === id; });
    if (!c) {
        mostrarNotificacion('Cotización no encontrada', 'error');
        return;
    }
    EstadoHistorial.cotizacionActual = c;

    const fmt = function (n) { return '$' + formatearNumero(n); };
    const bool = function (v) { return parseInt(v) ? '✅ Sí' : '— No'; };

    const html =
        '<div class="detalle-grid">' +

        // Columna izquierda — Datos de la pieza
        '<div class="detalle-seccion">' +
            '<h4>📦 Datos de la Pieza</h4>' +
            filaDetalle('Nombre',            escaparHTML(c.nombre_pieza || '—')) +
            filaDetalle('Cantidad piezas',   c.cantidad_piezas) +
            filaDetalle('Piezas por lote',   c.piezas_por_lote) +
            filaDetalle('Peso pieza',        (c.peso_pieza || 0) + ' g') +
            filaDetalle('Tiempo impresión',  (c.tiempo_impresion || 0) + ' min') +
            filaDetalle('Factor seguridad',  c.factor_seguridad) +
            filaDetalle('Costo carrete',     fmt(c.costo_carrete)) +
            filaDetalle('Peso carrete',      (c.peso_carrete || 0) + ' g') +
            filaDetalle('Horas diseño',      c.horas_diseno) +
            filaDetalle('Costo / h diseño',  fmt(c.costo_hora_diseno)) +
            filaDetalle('Margen minorista',  (c.margen_minorista || 0) + '%') +
            filaDetalle('Margen mayorista',  (c.margen_mayorista || 0) + '%') +
            filaDetalle('GIF',               (c.gif || 0) + '%') +
            filaDetalle('AIU',               (c.aiu || 0) + '%') +
            filaDetalle('Marca de agua',     bool(c.incluir_marca_agua)) +
            filaDetalle('Postprocesado',     bool(c.incluir_postprocesado)) +
            filaDetalle('Paquetería',        bool(c.incluir_paqueteria)) +
            filaDetalle('Delivery',          bool(c.requiere_delivery)) +
            filaDetalle('Fecha',             formatearFecha(c.fecha_completa || c.fecha)) +
        '</div>' +

        // Columna derecha — Resultados económicos
        '<div class="detalle-seccion">' +
            '<h4>💰 Resultados Económicos</h4>' +
            filaDetalle('Costo fabricación',  fmt(c.costo_fabricacion)) +
            filaDetalle('Costo energía',      fmt(c.costo_energia)) +
            filaDetalle('Costo diseño',       fmt(c.costo_diseno)) +
            filaDetalle('Depreciación',       fmt(c.costo_depreciacion)) +
            filaDetalle('Subtotal fabric.',   fmt(c.subtotal_fabricacion)) +
            filaDetalle('Postprocesado',      fmt(c.costo_postprocesado || c.costo_mano_obra_postprocesado)) +
            filaDetalle('Paquetería',         fmt(c.costo_paqueteria || c.costo_total_paqueteria)) +
            filaDetalle('Delivery',           fmt(c.costo_delivery_calculado || c.costo_delivery_total)) +
            '<div class="detalle-fila">' +
                '<span class="detalle-label">Precio final (unit.)</span>' +
                '<span class="detalle-valor detalle-valor-destacado">' + fmt(c.precio_final) + '</span>' +
            '</div>' +
            '<div class="detalle-fila">' +
                '<span class="detalle-label">Precio minorista</span>' +
                '<span class="detalle-valor detalle-valor-minorista">' + fmt(c.precio_minorista) + '</span>' +
            '</div>' +
            '<div class="detalle-fila">' +
                '<span class="detalle-label">Precio mayorista</span>' +
                '<span class="detalle-valor detalle-valor-mayorista">' + fmt(c.precio_mayorista) + '</span>' +
            '</div>' +
            '<div class="detalle-fila">' +
                '<span class="detalle-label">P. unit. minorista</span>' +
                '<span class="detalle-valor detalle-valor-minorista">' + fmt(c.precio_unitario_minorista || c.precio_minorista) + '</span>' +
            '</div>' +
            '<div class="detalle-fila">' +
                '<span class="detalle-label">P. unit. mayorista</span>' +
                '<span class="detalle-valor detalle-valor-mayorista">' + fmt(c.precio_unitario_mayorista || c.precio_mayorista) + '</span>' +
            '</div>' +
        '</div>' +

        '</div>';

    document.getElementById('contenidoDetalle').innerHTML = html;
    document.getElementById('modalDetalle').style.display = 'flex';
}

function filaDetalle(label, valor) {
    return '<div class="detalle-fila">' +
        '<span class="detalle-label">' + label + '</span>' +
        '<span class="detalle-valor">' + (valor !== undefined && valor !== null ? valor : '—') + '</span>' +
        '</div>';
}

function cerrarModalDetalle() {
    document.getElementById('modalDetalle').style.display = 'none';
}

function duplicarDesdeDetalle() {
    if (EstadoHistorial.cotizacionActual) {
        duplicarCotizacion(EstadoHistorial.cotizacionActual.id);
    }
}

function facturaDesdeDetalle() {
    cerrarModalDetalle();
    if (EstadoHistorial.cotizacionActual) {
        abrirFactura(EstadoHistorial.cotizacionActual.id);
    }
}

// ============================================
// DUPLICAR COTIZACIÓN
// ============================================

function duplicarCotizacion(id) {
    window.location.href = 'cotizacion.html?duplicar=' + encodeURIComponent(id);
}

// ============================================
// ELIMINAR COTIZACIÓN
// ============================================

function confirmarEliminar(id, nombre) {
    document.getElementById('eliminarNombre').textContent = '"' + nombre + '"';
    document.getElementById('btnConfirmarEliminar').dataset.id = id;
    document.getElementById('modalEliminar').style.display = 'flex';
}

function cerrarModalEliminar() {
    document.getElementById('modalEliminar').style.display = 'none';
}

async function ejecutarEliminar() {
    const id = document.getElementById('btnConfirmarEliminar').dataset.id;
    if (!id) return;

    try {
        const _apiBase = typeof API_CONFIG !== 'undefined'
            ? API_CONFIG.baseURL
            : window.location.pathname.replace(/\/[^\/]+$/, '') + '/api';
        const url = _apiBase + '/api_cotizaciones.php?action=delete&id=' + encodeURIComponent(id);

        const respuesta = await fetch(url);
        const texto     = await respuesta.text();
        let datos;
        try {
            datos = JSON.parse(texto);
        } catch (e) {
            throw new Error('Respuesta inválida del servidor');
        }

        if (!datos.success) {
            throw new Error(datos.message || 'Error al eliminar');
        }

        // Actualizar estado local
        EstadoHistorial.cotizaciones = EstadoHistorial.cotizaciones.filter(function (c) {
            return c.id !== id;
        });
        aplicarFiltros();
        actualizarDashboard();
        cerrarModalEliminar();
        mostrarNotificacion('Cotización eliminada correctamente', 'exito');

    } catch (error) {
        console.error('Error ejecutarEliminar:', error);
        mostrarNotificacion('Error al eliminar: ' + error.message, 'error');
    }
}

// ============================================
// EXPORTAR CSV
// ============================================

function exportarTodoCSV() {
    const lista = EstadoHistorial.filtradas.length > 0
        ? EstadoHistorial.filtradas
        : EstadoHistorial.cotizaciones;

    if (!lista || lista.length === 0) {
        mostrarNotificacion('No hay cotizaciones para exportar', 'warning');
        return;
    }
    generarDescargaCSV(lista, 'historial_cotizaciones');
}

function exportarFilaCSV(id) {
    const c = EstadoHistorial.cotizaciones.find(function (x) { return x.id === id; });
    if (!c) {
        mostrarNotificacion('Cotización no encontrada', 'error');
        return;
    }
    generarDescargaCSV([c], 'cotizacion_' + (c.nombre_pieza || id).replace(/[^a-zA-Z0-9]/g, '_'));
}

function generarDescargaCSV(filas, nombreArchivo) {
    const encabezados = [
        'ID', 'Nombre Pieza', 'Fecha', 'Cantidad Piezas', 'Piezas por Lote',
        'Peso Pieza (g)', 'Tiempo Impresion (min)', 'Factor Seguridad',
        'Costo Carrete', 'Peso Carrete (g)', 'Horas Diseno', 'Costo Hora Diseno',
        'Margen Minorista %', 'Margen Mayorista %', 'GIF %', 'AIU %',
        'Costo Fabricacion', 'Costo Energia', 'Costo Diseno', 'Costo Depreciacion',
        'Subtotal Fabricacion', 'Costo Postprocesado', 'Costo Paqueteria', 'Costo Delivery',
        'Precio Final', 'Precio Minorista', 'Precio Mayorista',
        'Incluir Postprocesado', 'Incluir Paqueteria', 'Requiere Delivery'
    ];

    const filaCSV = function (c) {
        const q = function (s) {
            return '"' + (s !== null && s !== undefined ? String(s).replace(/"/g, '""') : '') + '"';
        };
        return [
            q(c.id),
            q(c.nombre_pieza),
            q(c.fecha_completa || c.fecha),
            c.cantidad_piezas || 0,
            c.piezas_por_lote || 0,
            c.peso_pieza || 0,
            c.tiempo_impresion || 0,
            c.factor_seguridad || 0,
            c.costo_carrete || 0,
            c.peso_carrete || 0,
            c.horas_diseno || 0,
            c.costo_hora_diseno || 0,
            c.margen_minorista || 0,
            c.margen_mayorista || 0,
            c.gif || 0,
            c.aiu || 0,
            c.costo_fabricacion || 0,
            c.costo_energia || 0,
            c.costo_diseno || 0,
            c.costo_depreciacion || 0,
            c.subtotal_fabricacion || 0,
            c.costo_postprocesado || c.costo_mano_obra_postprocesado || 0,
            c.costo_paqueteria || c.costo_total_paqueteria || 0,
            c.costo_delivery_calculado || c.costo_delivery_total || 0,
            c.precio_final || 0,
            c.precio_minorista || 0,
            c.precio_mayorista || 0,
            parseInt(c.incluir_postprocesado) ? 'Si' : 'No',
            parseInt(c.incluir_paqueteria) ? 'Si' : 'No',
            parseInt(c.requiere_delivery) ? 'Si' : 'No'
        ].join(',');
    };

    const contenidoCSV = '\uFEFF' + encabezados.join(',') + '\n'
        + filas.map(filaCSV).join('\n');

    const blob = new Blob([contenidoCSV], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href     = url;
    link.download = nombreArchivo + '_' + new Date().toISOString().split('T')[0] + '.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    mostrarNotificacion('CSV exportado correctamente', 'exito');
}

// ============================================
// MODAL: FACTURA
// ============================================

function abrirFactura(id) {
    const c = EstadoHistorial.cotizaciones.find(function (x) { return x.id === id; });
    if (!c) {
        mostrarNotificacion('Cotización no encontrada', 'error');
        return;
    }
    EstadoHistorial.cotizacionActual = c;
    renderizarFactura(c);
    document.getElementById('modalFactura').style.display = 'flex';
}

function renderizarFactura(c) {
    const fmt     = function (n) { return '$' + formatearNumero(n); };
    const numFac  = 'FAC-' + Date.now().toString().slice(-6);
    const fecha   = formatearFecha(c.fecha_completa || c.fecha);
    const cantidad = parseInt(c.cantidad_piezas) || 1;

    // Cálculo de totales para la factura
    const precioUnitMin = parseFloat(c.precio_unitario_minorista || c.precio_minorista) || 0;
    const totalFila     = precioUnitMin * cantidad;
    const subtotal      = parseFloat(c.subtotal_fabricacion) || 0;
    const costoPost     = parseFloat(c.costo_postprocesado || c.costo_mano_obra_postprocesado) || 0;
    const costoPaq      = parseFloat(c.costo_paqueteria || c.costo_total_paqueteria) || 0;
    const costoDel      = parseFloat(c.costo_delivery_calculado || c.costo_delivery_total) || 0;
    const total         = parseFloat(c.precio_minorista) * cantidad || totalFila;

    // Filas de totales condicionales
    let filasTotal = '<div class="total-fila"><span class="total-label">Subtotal fabricación</span><span>' + fmt(subtotal) + '</span></div>';
    if (costoPost > 0) {
        filasTotal += '<div class="total-fila"><span class="total-label">Postprocesado</span><span>' + fmt(costoPost) + '</span></div>';
    }
    if (costoPaq > 0) {
        filasTotal += '<div class="total-fila"><span class="total-label">Paquetería</span><span>' + fmt(costoPaq) + '</span></div>';
    }
    if (costoDel > 0) {
        filasTotal += '<div class="total-fila"><span class="total-label">Delivery</span><span>' + fmt(costoDel) + '</span></div>';
    }
    filasTotal += '<div class="total-fila"><span class="total-label">TOTAL</span><span>' + fmt(total) + '</span></div>';

    const html =
        // --- Encabezado empresa ---
        '<div class="factura-header">' +
            '<div class="empresa-info">' +
                '<img class="empresa-logo" src="img/logo-odi3d.svg" alt="ODI3D">' +
                '<input class="empresa-nombre-input" type="text" placeholder="Nombre de tu empresa" value="ODI3D">' +
                '<input class="empresa-dato-input" type="text" placeholder="NIT: 000.000.000-0">' +
                '<input class="empresa-dato-input" type="text" placeholder="Tel: +57 300 000 0000">' +
                '<input class="empresa-dato-input" type="text" placeholder="Dirección o ciudad">' +
            '</div>' +
            '<div class="factura-meta">' +
                '<div class="factura-numero">' + numFac + '</div>' +
                '<div class="factura-meta-dato">📅 Fecha: ' + fecha + '</div>' +
                '<div class="factura-meta-dato">🖨️ Tipo: Impresión 3D</div>' +
                '<span class="factura-estado-badge">Cotización</span>' +
            '</div>' +
        '</div>' +

        // --- Datos del cliente ---
        '<div class="cliente-section">' +
            '<h4>👤 Datos del Cliente</h4>' +
            '<div class="cliente-fila"><label>Nombre:</label><input class="cliente-input" type="text" placeholder="Nombre del cliente"></div>' +
            '<div class="cliente-fila"><label>Teléfono:</label><input class="cliente-input" type="text" placeholder="+57 300 000 0000"></div>' +
            '<div class="cliente-fila"><label>Ciudad:</label><input class="cliente-input" type="text" placeholder="Ciudad / Municipio"></div>' +
        '</div>' +

        // --- Tabla de ítems ---
        '<table class="factura-tabla">' +
            '<thead>' +
                '<tr>' +
                    '<th>Descripción</th>' +
                    '<th>Cant.</th>' +
                    '<th>P. Unit. Minorista</th>' +
                    '<th>P. Unit. Mayorista</th>' +
                    '<th>Total Minorista</th>' +
                '</tr>' +
            '</thead>' +
            '<tbody>' +
                '<tr>' +
                    '<td>' + escaparHTML(c.nombre_pieza || '—') + ' (Impresión 3D)</td>' +
                    '<td>' + cantidad + '</td>' +
                    '<td>' + fmt(c.precio_unitario_minorista || c.precio_minorista) + '</td>' +
                    '<td>' + fmt(c.precio_unitario_mayorista || c.precio_mayorista) + '</td>' +
                    '<td><strong>' + fmt(totalFila) + '</strong></td>' +
                '</tr>' +
            '</tbody>' +
        '</table>' +

        // --- Totales ---
        '<div class="factura-totales">' +
            '<div class="totales-box">' + filasTotal + '</div>' +
        '</div>' +

        // --- Pago: QR Bre-B / Nequi ---
        '<div class="factura-pago">' +
            '<div class="pago-qr"><img src="img/qr-pagos-brebe.png" alt="QR de pago Bre-B / Nequi Negocios"></div>' +
            '<div class="pago-info">' +
                '<h4>💳 Pagos</h4>' +
                '<p>Escanea el código QR desde tu app Nequi para pagar con <strong>Bre-B</strong>.</p>' +
                '<p class="pago-titular">ODI3D — Juan Ortiz</p>' +
            '</div>' +
        '</div>' +

        // --- Notas ---
        '<div class="factura-notas">' +
            '<h4>📝 Notas y Términos</h4>' +
            '<textarea placeholder="Válido por 30 días. Precios sujetos a disponibilidad de material. Tiempo de entrega a coordinar. Incluye acabado estándar en capa 0.2mm.">' +
            '</textarea>' +
        '</div>' +

        // --- Footer ---
        '<div class="factura-footer-text">¡Gracias por confiar en nuestros servicios de impresión 3D! 🖨️</div>';

    document.getElementById('contenidoFactura').innerHTML = html;
}

function imprimirFactura() {
    const cont = document.getElementById('contenidoFactura');
    if (!cont) { window.print(); return; }

    const htmlContent = cont.innerHTML;
    const baseURL = window.location.href.split('?')[0].replace(/\/[^/]+$/, '/');

    const win = window.open('', '_blank', 'width=840,height=960,scrollbars=yes,resizable=yes');
    if (!win) {
        alert('Permite las ventanas emergentes del navegador para imprimir correctamente.');
        window.print();
        return;
    }

    win.document.write('<!DOCTYPE html>\n<html lang="es"><head>' +
        '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">' +
        '<title>Factura ODI3D</title>' +
        '<base href="' + baseURL + '">' +
        '<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">' +
        '<link rel="stylesheet" href="css/stylehistorial.css">' +
        '<style>' +
        '@page{size:A4;margin:1.5cm}' +
        '*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}' +
        'body{padding:0;background:#fff;margin:0}' +
        '.modal,.modal-header,.modal-footer,.modal-close,.btn{display:none!important}' +
        'input,textarea{border:none!important;outline:none;background:transparent;padding:2px 0!important}' +
        '</style>' +
        '</head><body style="padding:1cm">' +
        htmlContent +
        '<script>window.addEventListener("load",function(){setTimeout(function(){window.print();},400)});<\/script>' +
        '</body></html>');
    win.document.close();
}

async function descargarImagenFactura() {
    const btn = document.getElementById('btnDescargaImagenFactura');
    const textoOrig = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Generando...'; }
    try {
        if (!window.html2canvas) {
            await new Promise(function (resolve, reject) {
                const s = document.createElement('script');
                s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
                s.crossOrigin = 'anonymous';
                s.onload = resolve; s.onerror = reject;
                document.head.appendChild(s);
            });
        }
        const cont = document.getElementById('contenidoFactura');
        const canvas = await window.html2canvas(cont, {
            scale: 2, backgroundColor: '#ffffff',
            useCORS: true, logging: false, removeContainer: true,
        });
        const link = document.createElement('a');
        link.download = 'factura-odi3d-' + new Date().toISOString().slice(0, 10) + '.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (err) {
        console.error('[historial] Error imagen factura:', err);
        mostrarNotificacion('No se pudo generar la imagen. Usa "Imprimir / PDF" como alternativa.', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = textoOrig; }
    }
}

function cerrarModalFactura() {
    document.getElementById('modalFactura').style.display = 'none';
}

// ============================================
// NOTIFICACIONES
// ============================================

function mostrarNotificacion(mensaje, tipo) {
    const iconos = {
        exito:   '✅',
        error:   '❌',
        warning: '⚠️',
        info:    'ℹ️'
    };

    const contenedor = document.getElementById('notificaciones');
    const notif = document.createElement('div');
    notif.className = 'notificacion notificacion-' + (tipo || 'info');
    notif.innerHTML = '<span>' + (iconos[tipo] || 'ℹ️') + '</span><span>' + mensaje + '</span>';
    contenedor.appendChild(notif);

    setTimeout(function () {
        if (notif.parentNode) notif.parentNode.removeChild(notif);
    }, 3500);
}

// ============================================
// UTILIDADES
// ============================================

function formatearNumero(n) {
    return new Intl.NumberFormat('es-CO').format(parseFloat(n) || 0);
}

function formatearFecha(fechaStr) {
    if (!fechaStr) return '—';
    try {
        const d = new Date(fechaStr);
        if (isNaN(d.getTime())) return fechaStr;
        return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
        return fechaStr;
    }
}

function formatearFechaCorta(fechaStr) {
    if (!fechaStr) return '—';
    try {
        const d = new Date(fechaStr);
        if (isNaN(d.getTime())) return fechaStr;
        return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit' });
    } catch (e) {
        return fechaStr;
    }
}

function escaparHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
    if (!str) return '';
    return String(str).replace(/'/g, "\\'").replace(/"/g, '\\"');
}
