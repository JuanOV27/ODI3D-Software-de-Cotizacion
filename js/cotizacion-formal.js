/**
 * Cotización Formal — módulo compartido (ODI3D)
 * ------------------------------------------------------------------
 * Genera un documento de "cotización formal" para el cliente.
 * Se usa desde el Cotizador (cotizacion.html) y desde el Panel de
 * Solicitudes (panel-solicitudes.html).
 *
 * Mejoras v2:
 * - PDF hoja única via ventana nueva (sin páginas en blanco)
 * - Descarga como imagen PNG (html2canvas desde CDN)
 * - QR de pago ODI3D integrado en el documento
 * - Estado persistente: al reabrir la misma solicitud se restauran
 *   las selecciones de precio y condiciones de pago
 * - Soporte de tabla de ítems (cotizador multi-ítem)
 *
 * Uso:
 *   abrirCotizacionFormal({
 *     solicitudId:  'abc123' | null,
 *     estadoActual: 'recibida' | ... ,
 *     cliente:      'Nombre del cliente',
 *     descripcion:  'Descripción del proyecto',
 *     cantidad:     3,
 *     precios:      { base: 50000, minorista: 65000, mayorista: 55000 },
 *     itemsLista:   [{ nombre, cantidad, precio_final, ... }],  // opcional
 *     permiteEnvio: true,
 *     alEnviar:     function (info) { ... }
 *   });
 */
(function () {
    'use strict';

    // ── Variables de módulo ──────────────────────────────────────
    let _datos   = null;
    let _overlay = null;

    // Estado guardado por clave de solicitud (para persistencia)
    const _estadoGuardado = {};

    // Base URL para imágenes (calculado una sola vez al cargar el módulo)
    const _baseURL = (function () {
        const href = window.location.href.split('?')[0].split('#')[0];
        return href.replace(/\/[^/]+$/, '/');
    })();

    // ============================================================
    // ESTILOS (inyectados una sola vez)
    // ============================================================
    function inyectarEstilos() {
        if (document.getElementById('cf-estilos')) return;
        const style = document.createElement('style');
        style.id = 'cf-estilos';
        style.textContent = `
.cf-overlay {
    display: none; position: fixed; inset: 0; z-index: 9999;
    background: rgba(15, 23, 32, 0.72);
    align-items: center; justify-content: center; padding: 1.5rem;
}
.cf-overlay.activo { display: flex; }
.cf-modal {
    background: #fff; border-radius: 12px; width: 100%; max-width: 660px;
    max-height: 92vh; display: flex; flex-direction: column; overflow: hidden;
    box-shadow: 0 16px 48px rgba(0,0,0,0.35);
    font-family: 'Inter', Arial, sans-serif;
}
.cf-modal-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0.9rem 1.2rem; background: #1A2E3C; color: #fff;
}
.cf-modal-titulo { font-family: 'Montserrat', 'Inter', sans-serif; font-size: 1rem; font-weight: 700; }
.cf-cerrar {
    background: none; border: none; color: #fff; font-size: 1.05rem; cursor: pointer;
    padding: 0.2rem 0.5rem; opacity: 0.75; transition: opacity 0.2s ease-out;
}
.cf-cerrar:hover { opacity: 1; }
.cf-modal-body { flex: 1; overflow-y: auto; padding: 1.2rem; }

.cf-controles { background: #f4f7f9; border: 1px solid #e1e8ed; border-radius: 10px; padding: 1rem; margin-bottom: 1.2rem; }
.cf-controles h4 { margin: 0 0 0.5rem; font-family: 'Montserrat', 'Inter', sans-serif; font-size: 0.85rem; color: #1A2E3C; }
.cf-controles h4.cf-mt { margin-top: 1.1rem; }
.cf-radio { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: #333; padding: 0.3rem 0; cursor: pointer; }
.cf-radio strong { color: #1A2E3C; }
.cf-radio input[type="number"] {
    font-size: 0.82rem; padding: 0.28rem 0.55rem; border: 1px solid #ccd5dc; border-radius: 5px;
    width: 130px; transition: border-color 0.2s ease-out;
}
.cf-radio input[type="number"]:focus { outline: none; border-color: #1B5E7B; }
.cf-abono-config {
    margin-top: 0.6rem; padding: 0.7rem 0.9rem; background: #fff;
    border: 1px dashed #1B5E7B; border-radius: 8px;
}
.cf-abono-config label { font-size: 0.83rem; color: #333; display: flex; align-items: center; gap: 0.4rem; }
.cf-abono-resumen { margin: 0.5rem 0 0; font-size: 0.82rem; color: #1B5E7B; font-weight: 600; }

.cf-documento { border: 1px solid #e1e8ed; border-radius: 10px; padding: 1.4rem; }
.cf-doc-header {
    display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem;
    padding-bottom: 1rem; margin-bottom: 1rem; border-bottom: 2px solid #1A2E3C; flex-wrap: wrap;
}
.cf-doc-logo { height: 46px; width: auto; object-fit: contain; }
.cf-doc-meta { text-align: right; }
.cf-doc-titulo { font-family: 'Montserrat', 'Inter', sans-serif; font-weight: 700; font-size: 1.05rem; color: #1A2E3C; }
.cf-doc-num { font-size: 0.8rem; color: #1B5E7B; font-weight: 600; }
.cf-doc-fecha { font-size: 0.78rem; color: #777; }
.cf-doc-cliente, .cf-doc-detalle, .cf-doc-condiciones { margin-bottom: 1rem; }
.cf-documento h4 { margin: 0 0 0.35rem; font-family: 'Montserrat', 'Inter', sans-serif; font-size: 0.85rem; color: #1A2E3C; }
.cf-documento p { margin: 0 0 0.3rem; font-size: 0.88rem; color: #333; line-height: 1.5; }
.cf-doc-cantidad { font-size: 0.85rem; color: #555; }
.cf-doc-precio {
    display: flex; justify-content: space-between; align-items: center;
    background: #1A2E3C; color: #fff; border-radius: 8px; padding: 0.8rem 1.1rem; margin-bottom: 1rem;
}
.cf-doc-precio-label { font-size: 0.78rem; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.5px; }
.cf-doc-precio-valor { font-family: 'Montserrat', 'Inter', sans-serif; font-size: 1.3rem; font-weight: 700; }
/* QR de pago */
.cf-doc-qr {
    display: flex; align-items: center; gap: 1rem;
    padding: 0.8rem 1rem; background: #f8fafc;
    border: 1px solid #e1e8ed; border-radius: 8px; margin-bottom: 1rem;
}
.cf-doc-qr img { width: 72px; height: 72px; flex-shrink: 0; object-fit: contain; }
.cf-doc-qr-info h4 { font-size: 0.82rem; margin-bottom: 0.2rem; }
.cf-doc-qr-info p { font-size: 0.78rem; color: #555; margin: 0; }
.cf-doc-qr-info .qr-titular { font-size: 0.82rem; font-weight: 700; color: #1A2E3C; margin-top: 0.25rem; }
/* Tabla de ítems en cotización multi-ítem */
.cf-doc-items-table {
    width: 100%; border-collapse: collapse; font-size: 0.83rem; margin-bottom: 0.5rem;
}
.cf-doc-items-table th {
    text-align: left; padding: 0.3rem 0.5rem;
    color: #1A2E3C; border-bottom: 1px solid #ddd;
    font-size: 0.78rem; font-weight: 700;
}
.cf-doc-items-table th:last-child { text-align: right; }
.cf-doc-items-table td { padding: 0.3rem 0.5rem; border-bottom: 1px solid #f0f0f0; }
.cf-doc-items-table td:last-child { text-align: right; }
.cf-doc-footer { font-size: 0.76rem; color: #888; border-top: 1px solid #eee; padding-top: 0.8rem; margin-top: 0.5rem; }

.cf-modal-footer {
    display: flex; justify-content: flex-end; gap: 0.5rem;
    padding: 0.9rem 1.2rem; border-top: 1px solid #e1e8ed; flex-wrap: wrap;
}
.cf-btn {
    border: none; border-radius: 6px; padding: 0.5rem 1rem; font-size: 0.85rem; font-weight: 600;
    cursor: pointer; transition: opacity 0.2s ease-out, background 0.2s ease-out;
}
.cf-btn-outline { background: #fff; border: 1px solid #ccd5dc; color: #555; }
.cf-btn-outline:hover { background: #f4f7f9; }
.cf-btn-primary { background: #1B5E7B; color: #fff; }
.cf-btn-primary:hover { opacity: 0.9; }
.cf-btn-imagen { background: #6366f1; color: #fff; }
.cf-btn-imagen:hover { opacity: 0.9; }
.cf-btn-enviar { background: #1A2E3C; color: #fff; }
.cf-btn-enviar:hover { opacity: 0.9; }
.cf-btn:disabled { opacity: 0.6; cursor: not-allowed; }
`;
        document.head.appendChild(style);
    }

    // ============================================================
    // UTILIDADES
    // ============================================================
    function escapar(str) {
        const d = document.createElement('div');
        d.textContent = (str === null || str === undefined) ? '' : String(str);
        return d.innerHTML;
    }

    function formatearMoneda(valor) {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency', currency: 'COP',
            minimumFractionDigits: 0, maximumFractionDigits: 0
        }).format(valor || 0);
    }

    function notificar(mensaje, tipo) {
        const t = (tipo === 'error') ? 'error' : 'success';
        if (typeof window.mostrarNotificacionSimple === 'function') {
            window.mostrarNotificacionSimple(mensaje, t);
        } else if (typeof window.mostrarNotificacion === 'function') {
            window.mostrarNotificacion(mensaje, t === 'error' ? 'error' : 'exito');
        } else {
            alert(mensaje);
        }
    }

    // ============================================================
    // PERSISTENCIA DE ESTADO (por solicitudId)
    // ============================================================
    function _claveEstado() {
        return (_datos && _datos.solicitudId) ? 'sol_' + _datos.solicitudId : '__global__';
    }

    function _guardarEstado() {
        if (!_overlay) return;
        const selPrecio = _overlay.querySelector('input[name="cfPrecio"]:checked');
        const selModal  = _overlay.querySelector('input[name="cfModalidad"]:checked');
        const pct       = document.getElementById('cfPorcentajeAbono');
        const manual    = document.getElementById('cfPrecioManual');
        _estadoGuardado[_claveEstado()] = {
            precio:       selPrecio ? selPrecio.value : null,
            precioManual: manual ? (manual.value || '') : '',
            modalidad:    selModal ? selModal.value : 'unico',
            porcentaje:   pct ? (pct.value || '50') : '50',
        };
    }

    function _restaurarModalidad() {
        const est = _estadoGuardado[_claveEstado()];
        if (!est) return;
        const radioModal = _overlay.querySelector(`input[name="cfModalidad"][value="${est.modalidad}"]`);
        if (radioModal) radioModal.checked = true;
        const abonoConfig = document.getElementById('cfAbonoConfig');
        if (abonoConfig) abonoConfig.style.display = est.modalidad === 'partes' ? '' : 'none';
        const pct = document.getElementById('cfPorcentajeAbono');
        if (pct && est.porcentaje) pct.value = est.porcentaje;
    }

    // Debe llamarse DESPUÉS de renderOpcionesPrecio (los radios se regeneran)
    function _restaurarPrecio() {
        const est = _estadoGuardado[_claveEstado()];
        if (!est || !est.precio) return;
        const radio = _overlay.querySelector(`input[name="cfPrecio"][value="${est.precio}"]`);
        if (radio) {
            radio.checked = true;
            const inputManual = document.getElementById('cfPrecioManual');
            if (inputManual) {
                inputManual.disabled = (est.precio !== 'manual');
                if (est.precio === 'manual' && est.precioManual) {
                    inputManual.value = est.precioManual;
                }
            }
        }
    }

    // ============================================================
    // CONSTRUCCIÓN DEL MODAL (una sola vez)
    // ============================================================
    function crearOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'cf-overlay';
        overlay.id = 'cfOverlay';
        overlay.innerHTML =
            '<div class="cf-modal">' +
                '<div class="cf-modal-header">' +
                    '<span class="cf-modal-titulo">📄 Cotización Formal</span>' +
                    '<button type="button" class="cf-cerrar" id="cfCerrar">✕</button>' +
                '</div>' +
                '<div class="cf-modal-body">' +
                    '<div class="cf-controles">' +
                        '<h4>💲 Precio a mostrar en el documento</h4>' +
                        '<div id="cfOpcionesPrecio"></div>' +
                        '<h4 class="cf-mt">🤝 Condiciones de pago</h4>' +
                        '<label class="cf-radio"><input type="radio" name="cfModalidad" value="unico" checked> Pago único</label>' +
                        '<label class="cf-radio"><input type="radio" name="cfModalidad" value="partes"> Abono + saldo contra entrega</label>' +
                        '<div class="cf-abono-config" id="cfAbonoConfig" style="display:none;">' +
                            '<label>Porcentaje de abono sugerido: <input type="number" id="cfPorcentajeAbono" min="1" max="99" step="1" value="50"> %</label>' +
                            '<p class="cf-abono-resumen" id="cfAbonoResumen"></p>' +
                        '</div>' +
                    '</div>' +
                    '<div class="cf-documento" id="cfDocumento"></div>' +
                '</div>' +
                '<div class="cf-modal-footer">' +
                    '<button type="button" class="cf-btn cf-btn-outline" id="cfCancelar">Cerrar</button>' +
                    '<button type="button" class="cf-btn cf-btn-imagen" id="cfDescargarImagen">📷 Imagen</button>' +
                    '<button type="button" class="cf-btn cf-btn-primary" id="cfImprimir">🖨️ Imprimir / PDF</button>' +
                    '<button type="button" class="cf-btn cf-btn-enviar" id="cfEnviar" style="display:none;">📤 Enviar a la solicitud</button>' +
                '</div>' +
            '</div>';

        document.body.appendChild(overlay);

        // Cerrar
        overlay.querySelector('#cfCerrar').addEventListener('click', cerrar);
        overlay.querySelector('#cfCancelar').addEventListener('click', cerrar);
        overlay.addEventListener('click', function (e) { if (e.target === overlay) cerrar(); });

        // Imprimir → ventana nueva (PDF hoja única)
        overlay.querySelector('#cfImprimir').addEventListener('click', _imprimirEnVentana);

        // Descargar imagen
        overlay.querySelector('#cfDescargarImagen').addEventListener('click', _descargarImagen);

        // Enviar a la solicitud
        overlay.querySelector('#cfEnviar').addEventListener('click', enviarASolicitud);

        // Cambios en condiciones de pago
        overlay.querySelectorAll('input[name="cfModalidad"]').forEach(function (r) {
            r.addEventListener('change', function () {
                const config = overlay.querySelector('#cfAbonoConfig');
                config.style.display = (r.value === 'partes' && r.checked) ? '' : 'none';
                renderDocumento();
            });
        });
        overlay.querySelector('#cfPorcentajeAbono').addEventListener('input', renderDocumento);

        // Delegación para los radios/inputs de precio (se regeneran dinámicamente)
        overlay.querySelector('#cfOpcionesPrecio').addEventListener('change', manejarCambioPrecio);
        overlay.querySelector('#cfOpcionesPrecio').addEventListener('input', function (e) {
            if (e.target && e.target.id === 'cfPrecioManual') renderDocumento();
        });

        return overlay;
    }

    function manejarCambioPrecio(e) {
        if (e.target && e.target.name === 'cfPrecio') {
            const inputManual = document.getElementById('cfPrecioManual');
            if (inputManual) inputManual.disabled = (e.target.value !== 'manual');
            if (e.target.value === 'manual' && inputManual) inputManual.focus();
        }
        renderDocumento();
    }

    function cerrar() {
        if (_overlay) {
            _guardarEstado();
            _overlay.classList.remove('activo');
        }
    }

    // ============================================================
    // RENDER: opciones de precio
    // ============================================================
    function renderOpcionesPrecio() {
        const precios  = (_datos && _datos.precios) || {};
        const opciones = [];
        if (precios.base != null && precios.base !== '')
            opciones.push({ key: 'base', label: 'Precio base', valor: parseFloat(precios.base) || 0 });
        if (precios.minorista != null && precios.minorista !== '')
            opciones.push({ key: 'minorista', label: 'Precio minorista (al detal)', valor: parseFloat(precios.minorista) || 0 });
        if (precios.mayorista != null && precios.mayorista !== '')
            opciones.push({ key: 'mayorista', label: 'Precio mayorista (por lote)', valor: parseFloat(precios.mayorista) || 0 });

        let html = opciones.map(function (o, i) {
            return '<label class="cf-radio">' +
                '<input type="radio" name="cfPrecio" value="' + o.key + '"' + (i === 0 ? ' checked' : '') + '> ' +
                escapar(o.label) + ': <strong>' + formatearMoneda(o.valor) + '</strong>' +
            '</label>';
        }).join('');

        const sinOpciones = opciones.length === 0;
        html += '<label class="cf-radio">' +
            '<input type="radio" name="cfPrecio" value="manual"' + (sinOpciones ? ' checked' : '') + '> ' +
            'Precio manual: ' +
            '<input type="number" id="cfPrecioManual" min="0" step="100" placeholder="Ej: 80000"' + (sinOpciones ? '' : ' disabled') + '>' +
        '</label>';

        document.getElementById('cfOpcionesPrecio').innerHTML = html;
    }

    function obtenerPrecioSeleccionado() {
        const sel = _overlay.querySelector('input[name="cfPrecio"]:checked');
        if (!sel) return 0;
        if (sel.value === 'manual') {
            const input = document.getElementById('cfPrecioManual');
            return parseFloat(input && input.value) || 0;
        }
        const precios = (_datos && _datos.precios) || {};
        return parseFloat(precios[sel.value]) || 0;
    }

    function obtenerCondicionesPago() {
        const modalidad = (_overlay.querySelector('input[name="cfModalidad"]:checked') || {}).value || 'unico';
        const precio = obtenerPrecioSeleccionado();
        if (modalidad === 'partes') {
            let pct = parseFloat(document.getElementById('cfPorcentajeAbono').value);
            if (isNaN(pct)) pct = 50;
            pct = Math.min(99, Math.max(1, pct));
            const abono = Math.round(precio * pct / 100);
            const saldo = Math.max(0, precio - abono);
            return { modalidad: 'partes', porcentaje: pct, abono: abono, saldo: saldo };
        }
        return { modalidad: 'unico', porcentaje: null, abono: precio, saldo: 0 };
    }

    // ============================================================
    // RENDER: documento (vista previa imprimible)
    // ============================================================
    function renderDocumento() {
        const precio = obtenerPrecioSeleccionado();
        const cond   = obtenerCondicionesPago();
        const numDoc = 'COT-' + Date.now().toString().slice(-6);
        const fecha  = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });

        // Resumen de abono
        const resumenAbono = document.getElementById('cfAbonoResumen');
        let condTexto;
        if (cond.modalidad === 'partes') {
            const txt = 'Abono sugerido: ' + formatearMoneda(cond.abono) + ' (' + cond.porcentaje + '%) · Saldo contra entrega: ' + formatearMoneda(cond.saldo);
            if (resumenAbono) resumenAbono.textContent = txt;
            condTexto = 'Pago en dos partes — <strong>abono de ' + formatearMoneda(cond.abono) +
                '</strong> (' + cond.porcentaje + '% del total) para iniciar la fabricación, y <strong>saldo de ' +
                formatearMoneda(cond.saldo) + '</strong> contra entrega del proyecto.';
        } else {
            if (resumenAbono) resumenAbono.textContent = '';
            condTexto = 'Pago único de <strong>' + formatearMoneda(precio) +
                '</strong>, a coordinar con el cliente antes de iniciar la fabricación o contra entrega, según se acuerde.';
        }

        // Sección de detalle: tabla de ítems (multi-ítem) o descripción simple
        const items = (_datos && _datos.itemsLista) || [];
        let detalleHTML;
        if (items.length > 0) {
            const rows = items.map(function (it) {
                const pu = parseFloat(it.precio_final || 0);
                const cant = parseInt(it.cantidad || 1, 10);
                const sub  = pu * cant;
                return '<tr>' +
                    '<td>' + escapar(it.nombre || '—') + '</td>' +
                    '<td style="text-align:center">' + cant + '</td>' +
                    '<td style="text-align:right">' + (pu > 0 ? formatearMoneda(pu) : '—') + '</td>' +
                    '<td style="text-align:right">' + (sub > 0 ? formatearMoneda(sub) : '—') + '</td>' +
                '</tr>';
            }).join('');
            detalleHTML =
                '<table class="cf-doc-items-table">' +
                    '<thead><tr>' +
                        '<th>Artículo</th><th style="text-align:center">Cant.</th>' +
                        '<th style="text-align:right">P. unit.</th>' +
                        '<th style="text-align:right">Subtotal</th>' +
                    '</tr></thead>' +
                    '<tbody>' + rows + '</tbody>' +
                '</table>';
        } else {
            detalleHTML = '<p>' + escapar((_datos && _datos.descripcion) || '—') + '</p>';
            detalleHTML += '<p class="cf-doc-cantidad">Cantidad: <strong>' + ((_datos && _datos.cantidad) || 1) + '</strong></p>';
        }

        document.getElementById('cfDocumento').innerHTML =
            // Encabezado
            '<div class="cf-doc-header">' +
                '<img class="cf-doc-logo" src="' + _baseURL + 'img/logo-odi3d.svg" alt="ODI3D">' +
                '<div class="cf-doc-meta">' +
                    '<div class="cf-doc-titulo">Cotización Formal</div>' +
                    '<div class="cf-doc-num">' + numDoc + '</div>' +
                    '<div class="cf-doc-fecha">📅 ' + fecha + '</div>' +
                '</div>' +
            '</div>' +
            // Cliente
            '<div class="cf-doc-cliente">' +
                '<h4>👤 Cliente</h4>' +
                '<p>' + escapar((_datos && _datos.cliente) || 'Cliente') + '</p>' +
            '</div>' +
            // Detalle
            '<div class="cf-doc-detalle">' +
                '<h4>📦 Detalle del proyecto</h4>' +
                detalleHTML +
            '</div>' +
            // Precio
            '<div class="cf-doc-precio">' +
                '<span class="cf-doc-precio-label">Precio cotizado</span>' +
                '<span class="cf-doc-precio-valor">' + formatearMoneda(precio) + '</span>' +
            '</div>' +
            // Condiciones de pago
            '<div class="cf-doc-condiciones">' +
                '<h4>🤝 Condiciones de pago</h4>' +
                '<p>' + condTexto + '</p>' +
            '</div>' +
            // QR de pago
            '<div class="cf-doc-qr">' +
                '<img src="' + _baseURL + 'img/qr-pagos-brebe.png" alt="QR de pago ODI3D" onerror="this.parentElement.style.display=\'none\'">' +
                '<div class="cf-doc-qr-info">' +
                    '<h4>💳 Pago</h4>' +
                    '<p>Escanea el QR desde Nequi / Bre-B</p>' +
                    '<p class="qr-titular">ODI3D — Juan Ortiz</p>' +
                '</div>' +
            '</div>' +
            // Footer
            '<div class="cf-doc-footer">' +
                'Esta cotización es informativa y puede estar sujeta a cambios según disponibilidad de materiales, ' +
                'complejidad del diseño y tiempos de producción. Para confirmar el proyecto, contáctanos a través del chat o por WhatsApp.' +
            '</div>';
    }

    // ============================================================
    // IMPRIMIR EN VENTANA NUEVA (PDF hoja única, sin páginas en blanco)
    // ============================================================
    function _imprimirEnVentana() {
        const docEl = document.getElementById('cfDocumento');
        if (!docEl) { window.print(); return; }

        const htmlContent = docEl.innerHTML;
        const win = window.open('', '_blank', 'width=840,height=960,scrollbars=yes,resizable=yes');
        if (!win) {
            alert('Tu navegador bloqueó la ventana emergente.\nPermite las ventanas emergentes para imprimir correctamente.');
            return;
        }

        win.document.write('<!DOCTYPE html>\n<html lang="es"><head>' +
            '<meta charset="UTF-8">' +
            '<meta name="viewport" content="width=device-width,initial-scale=1.0">' +
            '<title>Cotización Formal — ODI3D</title>' +
            '<base href="' + _baseURL + '">' +
            '<link rel="preconnect" href="https://fonts.googleapis.com">' +
            '<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">' +
            '<style>' +
            '@page{size:A4;margin:1.5cm}' +
            '*{margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}' +
            'body{font-family:"Inter",Arial,sans-serif;padding:0;background:#fff;color:#333}' +
            '.cf-doc-header{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;padding-bottom:1rem;margin-bottom:1rem;border-bottom:2px solid #1A2E3C;flex-wrap:wrap}' +
            '.cf-doc-logo{height:46px;width:auto;object-fit:contain}' +
            '.cf-doc-meta{text-align:right}' +
            '.cf-doc-titulo{font-family:"Montserrat",sans-serif;font-weight:700;font-size:1.05rem;color:#1A2E3C}' +
            '.cf-doc-num{font-size:.8rem;color:#1B5E7B;font-weight:600}' +
            '.cf-doc-fecha{font-size:.78rem;color:#777}' +
            '.cf-doc-cliente,.cf-doc-detalle,.cf-doc-condiciones{margin-bottom:1rem}' +
            'h4{margin:0 0 .35rem;font-family:"Montserrat",sans-serif;font-size:.85rem;color:#1A2E3C}' +
            'p{margin:0 0 .3rem;font-size:.88rem;color:#333;line-height:1.5}' +
            '.cf-doc-cantidad{font-size:.85rem;color:#555}' +
            '.cf-doc-precio{display:flex;justify-content:space-between;align-items:center;background:#1A2E3C;color:#fff;border-radius:8px;padding:.8rem 1.1rem;margin-bottom:1rem}' +
            '.cf-doc-precio-label{font-size:.78rem;opacity:.8;text-transform:uppercase;letter-spacing:.5px}' +
            '.cf-doc-precio-valor{font-family:"Montserrat",sans-serif;font-size:1.3rem;font-weight:700}' +
            '.cf-doc-qr{display:flex;align-items:center;gap:1rem;padding:.8rem 1rem;background:#f8fafc;border:1px solid #e1e8ed;border-radius:8px;margin-bottom:1rem}' +
            '.cf-doc-qr img{width:72px;height:72px;flex-shrink:0}' +
            '.cf-doc-qr-info h4{font-size:.82rem;margin-bottom:.2rem}' +
            '.cf-doc-qr-info p{font-size:.78rem;color:#555;margin:0}' +
            '.cf-doc-qr-info .qr-titular{font-size:.82rem;font-weight:700;color:#1A2E3C;margin-top:.25rem}' +
            '.cf-doc-footer{font-size:.76rem;color:#888;border-top:1px solid #eee;padding-top:.8rem;margin-top:.5rem}' +
            '.cf-doc-items-table{width:100%;border-collapse:collapse;font-size:.83rem;margin-bottom:.5rem}' +
            '.cf-doc-items-table th{text-align:left;padding:.3rem .5rem;color:#1A2E3C;border-bottom:1px solid #ddd;font-size:.78rem;font-weight:700}' +
            '.cf-doc-items-table th:last-child{text-align:right}' +
            '.cf-doc-items-table td{padding:.3rem .5rem;border-bottom:1px solid #f0f0f0}' +
            '.cf-doc-items-table td:last-child{text-align:right}' +
            '</style>' +
            '</head><body>' +
            '<div style="padding:0">' + htmlContent + '</div>' +
            '<script>window.addEventListener("load",function(){setTimeout(function(){window.print();},400)});<\/script>' +
            '</body></html>');
        win.document.close();
    }

    // ============================================================
    // DESCARGAR COMO IMAGEN (html2canvas desde CDN)
    // ============================================================
    function _cargarHtml2Canvas() {
        return new Promise(function (resolve, reject) {
            if (window.html2canvas) { resolve(window.html2canvas); return; }
            const s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
            s.crossOrigin = 'anonymous';
            s.onload  = function () { resolve(window.html2canvas); };
            s.onerror = function () { reject(new Error('No se pudo cargar html2canvas desde CDN')); };
            document.head.appendChild(s);
        });
    }

    async function _descargarImagen() {
        const btn = document.getElementById('cfDescargarImagen');
        const textoOriginal = btn ? btn.textContent : '';
        if (btn) { btn.disabled = true; btn.textContent = '⏳ Generando...'; }

        try {
            const h2c   = await _cargarHtml2Canvas();
            const docEl = document.getElementById('cfDocumento');
            if (!docEl) throw new Error('Elemento no encontrado');

            const canvas = await h2c(docEl, {
                scale:           2,
                backgroundColor: '#ffffff',
                useCORS:         true,
                logging:         false,
                removeContainer: true,
            });

            const link = document.createElement('a');
            const hoy  = new Date().toISOString().slice(0, 10);
            link.download = 'cotizacion-odi3d-' + hoy + '.png';
            link.href     = canvas.toDataURL('image/png');
            link.click();
        } catch (err) {
            console.error('[cf] Error al generar imagen:', err);
            notificar('No se pudo generar la imagen. Usa "Imprimir / PDF" → guardar como PDF.', 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = textoOriginal; }
        }
    }

    // ============================================================
    // ENVIAR PRECIO A LA SOLICITUD
    // ============================================================
    async function enviarASolicitud() {
        if (!_datos || !_datos.solicitudId) return;

        const precio = obtenerPrecioSeleccionado();
        if (!precio || precio <= 0) {
            notificar('Selecciona o ingresa un precio válido antes de enviar.', 'error');
            return;
        }

        const cond = obtenerCondicionesPago();
        const btn  = document.getElementById('cfEnviar');
        const textoOriginal = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Enviando...';

        try {
            const estadosTempranos = ['recibida', 'en_proceso'];
            const estadoDestino = estadosTempranos.indexOf(_datos.estadoActual) !== -1
                ? 'cotizada'
                : (_datos.estadoActual || 'cotizada');

            await apiClient.post('api_solicitudes.php', { action: 'cambiar_estado' }, {
                id:                _datos.solicitudId,
                estado:            estadoDestino,
                precio_final:      precio,
                modalidad_pago:    cond.modalidad,
                porcentaje_abono:  cond.modalidad === 'partes' ? cond.porcentaje : null
            });

            notificar('Precio enviado a la solicitud correctamente.', 'success');

            if (typeof window.limpiarBorradorCotizacion === 'function') {
                window.limpiarBorradorCotizacion(_datos.solicitudId);
            }

            if (typeof _datos.alEnviar === 'function') {
                _datos.alEnviar({
                    precio:           precio,
                    modalidad_pago:   cond.modalidad,
                    porcentaje_abono: cond.modalidad === 'partes' ? cond.porcentaje : null,
                    abono_sugerido:   cond.abono,
                    saldo_sugerido:   cond.saldo,
                    estado:           estadoDestino
                });
            }

            cerrar();
        } catch (err) {
            console.error('[cf] Error al enviar precio:', err);
            notificar('No se pudo enviar el precio a la solicitud. Intenta de nuevo.', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = textoOriginal;
        }
    }

    // ============================================================
    // API PÚBLICA
    // ============================================================
    window.abrirCotizacionFormal = function (datos) {
        // Determinar si es la misma solicitud (para preservar el estado)
        const claveAnterior = (_datos && _datos.solicitudId)
            ? 'sol_' + _datos.solicitudId : '__global__';
        const claveNueva = (datos && datos.solicitudId)
            ? 'sol_' + datos.solicitudId : '__global__';
        const mismaSolicitud = (_datos !== null) && (claveAnterior === claveNueva);

        _datos = datos || {};
        inyectarEstilos();
        if (!_overlay) _overlay = crearOverlay();

        // Mostrar/ocultar botón de envío
        document.getElementById('cfEnviar').style.display =
            (_datos.permiteEnvio && _datos.solicitudId) ? '' : 'none';

        // Reiniciar controles solo si es una solicitud diferente
        if (!mismaSolicitud) {
            const radioUnico = _overlay.querySelector('input[name="cfModalidad"][value="unico"]');
            if (radioUnico) radioUnico.checked = true;
            document.getElementById('cfAbonoConfig').style.display = 'none';
            document.getElementById('cfPorcentajeAbono').value = 50;
        } else {
            _restaurarModalidad();
        }

        renderOpcionesPrecio();

        if (mismaSolicitud) {
            _restaurarPrecio(); // después de renderOpcionesPrecio
        }

        renderDocumento();
        _overlay.classList.add('activo');
    };

    window.cerrarCotizacionFormal = cerrar;

})();
