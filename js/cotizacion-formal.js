/**
 * Cotización Formal — módulo compartido (ODI3D)
 * ------------------------------------------------------------------
 * Genera un documento simple de "cotización formal" para el cliente
 * (distinto de la factura de venta del historial: sin QR de pago ni
 * datos fiscales). Permite elegir qué precio queda plasmado (base,
 * minorista, mayorista o manual), define las condiciones de pago
 * (pago único o abono + saldo) y, opcionalmente, envía el precio
 * elegido a la solicitud vinculada (api_solicitudes.php?action=cambiar_estado).
 *
 * Se usa tanto desde el Cotizador (cotizacion.html) como desde el
 * Panel de Solicitudes (panel-solicitudes.html) — por eso es un
 * módulo autocontenido: inyecta su propio CSS y construye su propio
 * modal en tiempo de ejecución, sin depender del HTML de la página
 * que lo invoque.
 *
 * Uso:
 *   abrirCotizacionFormal({
 *     solicitudId: 'abc123' | null,
 *     estadoActual: 'recibida' | ... ,   // estado actual de la solicitud (si aplica)
 *     cliente: 'Nombre del cliente',
 *     descripcion: 'Descripción del proyecto',
 *     cantidad: 3,
 *     precios: { base: 50000, minorista: 65000, mayorista: 55000 }, // opcional
 *     permiteEnvio: true,                // muestra "Enviar a la solicitud"
 *     alEnviar: function (info) { ... }  // callback opcional tras enviar con éxito
 *   });
 */
(function () {
    'use strict';

    let _datos = null;
    let _overlay = null;

    // ============================================
    // ESTILOS (inyectados una sola vez)
    // ============================================
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
.cf-doc-footer { font-size: 0.76rem; color: #888; border-top: 1px solid #eee; padding-top: 0.8rem; margin-top: 0.5rem; }

.cf-modal-footer { display: flex; justify-content: flex-end; gap: 0.6rem; padding: 0.9rem 1.2rem; border-top: 1px solid #e1e8ed; flex-wrap: wrap; }
.cf-btn {
    border: none; border-radius: 6px; padding: 0.5rem 1rem; font-size: 0.85rem; font-weight: 600;
    cursor: pointer; transition: opacity 0.2s ease-out, background 0.2s ease-out;
}
.cf-btn-outline { background: #fff; border: 1px solid #ccd5dc; color: #555; }
.cf-btn-outline:hover { background: #f4f7f9; }
.cf-btn-primary { background: #1B5E7B; color: #fff; }
.cf-btn-primary:hover { opacity: 0.9; }
.cf-btn-enviar { background: #1A2E3C; color: #fff; }
.cf-btn-enviar:hover { opacity: 0.9; }
.cf-btn:disabled { opacity: 0.6; cursor: not-allowed; }

@media print {
    body * { visibility: hidden !important; }
    .cf-overlay, .cf-overlay * { visibility: visible !important; }
    .cf-overlay {
        position: absolute; inset: 0; background: #fff !important; padding: 0;
        display: flex !important;
    }
    .cf-modal { box-shadow: none; max-width: 100%; max-height: none; border-radius: 0; }
    .cf-modal-header, .cf-modal-footer, .cf-controles { display: none !important; }
    .cf-modal-body { overflow: visible; padding: 0; }
    .cf-documento { border: none; padding: 0; }
}
`;
        document.head.appendChild(style);
    }

    // ============================================
    // UTILIDADES
    // ============================================
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

    // ============================================
    // CONSTRUCCIÓN DEL MODAL (una sola vez)
    // ============================================
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
                    '<button type="button" class="cf-btn cf-btn-primary" id="cfImprimir">🖨️ Imprimir</button>' +
                    '<button type="button" class="cf-btn cf-btn-enviar" id="cfEnviar" style="display:none;">📤 Enviar a la solicitud</button>' +
                '</div>' +
            '</div>';

        document.body.appendChild(overlay);

        // Cerrar
        overlay.querySelector('#cfCerrar').addEventListener('click', cerrar);
        overlay.querySelector('#cfCancelar').addEventListener('click', cerrar);
        overlay.addEventListener('click', function (e) { if (e.target === overlay) cerrar(); });

        // Imprimir
        overlay.querySelector('#cfImprimir').addEventListener('click', function () { window.print(); });

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
        const overlay = _overlay;
        if (e.target && e.target.name === 'cfPrecio') {
            const inputManual = overlay.querySelector('#cfPrecioManual');
            if (inputManual) inputManual.disabled = (e.target.value !== 'manual');
            if (e.target.value === 'manual' && inputManual) inputManual.focus();
        }
        renderDocumento();
    }

    function cerrar() {
        if (_overlay) _overlay.classList.remove('activo');
    }

    // ============================================
    // RENDER: opciones de precio
    // ============================================
    function renderOpcionesPrecio() {
        const precios = (_datos && _datos.precios) || {};
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

    // ============================================
    // RENDER: documento (vista previa imprimible)
    // ============================================
    function renderDocumento() {
        const precio = obtenerPrecioSeleccionado();
        const cond   = obtenerCondicionesPago();
        const numDoc = 'COT-' + Date.now().toString().slice(-6);
        const fecha  = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });

        // Resumen de abono (también visible en los controles, en vivo)
        const resumenAbono = document.getElementById('cfAbonoResumen');
        let condTexto;
        if (cond.modalidad === 'partes') {
            const txt = 'Abono sugerido: ' + formatearMoneda(cond.abono) + ' (' + cond.porcentaje + '%) · Saldo contra entrega: ' + formatearMoneda(cond.saldo);
            if (resumenAbono) resumenAbono.textContent = txt;
            condTexto = 'Pago en dos partes — <strong>abono de ' + formatearMoneda(cond.abono) +
                '</strong> (' + cond.porcentaje + '% del total) para iniciar la fabricación, y <strong>saldo de ' +
                formatearMoneda(cond.saldo) + '</strong> contra entrega del proyecto. La suma de ambos pagos corresponde al precio total cotizado.';
        } else {
            if (resumenAbono) resumenAbono.textContent = '';
            condTexto = 'Pago único de <strong>' + formatearMoneda(precio) +
                '</strong>, a coordinar con el cliente antes de iniciar la fabricación o contra entrega, según se acuerde.';
        }

        document.getElementById('cfDocumento').innerHTML =
            '<div class="cf-doc-header">' +
                '<img class="cf-doc-logo" src="img/logo-odi3d.svg" alt="ODI3D">' +
                '<div class="cf-doc-meta">' +
                    '<div class="cf-doc-titulo">Cotización Formal</div>' +
                    '<div class="cf-doc-num">' + numDoc + '</div>' +
                    '<div class="cf-doc-fecha">📅 ' + fecha + '</div>' +
                '</div>' +
            '</div>' +
            '<div class="cf-doc-cliente">' +
                '<h4>👤 Cliente</h4>' +
                '<p>' + escapar((_datos && _datos.cliente) || 'Cliente') + '</p>' +
            '</div>' +
            '<div class="cf-doc-detalle">' +
                '<h4>📦 Detalle del proyecto</h4>' +
                '<p>' + escapar((_datos && _datos.descripcion) || '—') + '</p>' +
                '<p class="cf-doc-cantidad">Cantidad: <strong>' + ((_datos && _datos.cantidad) || 1) + '</strong></p>' +
            '</div>' +
            '<div class="cf-doc-precio">' +
                '<span class="cf-doc-precio-label">Precio cotizado</span>' +
                '<span class="cf-doc-precio-valor">' + formatearMoneda(precio) + '</span>' +
            '</div>' +
            '<div class="cf-doc-condiciones">' +
                '<h4>🤝 Condiciones de pago</h4>' +
                '<p>' + condTexto + '</p>' +
            '</div>' +
            '<div class="cf-doc-footer">' +
                'Esta cotización es informativa y puede estar sujeta a cambios según disponibilidad de materiales, complejidad del diseño y tiempos de producción. Para confirmar el proyecto, contáctanos a través del chat o por WhatsApp.' +
            '</div>';
    }

    // ============================================
    // ENVIAR PRECIO A LA SOLICITUD
    // ============================================
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
            // Si la solicitud aún no ha sido cotizada, avanzarla a "cotizada".
            // Si ya está en una fase posterior (aceptada, en producción, etc.)
            // se conserva su estado actual — enviar un precio no debe regresarla.
            const estadosTempranos = ['recibida', 'en_proceso'];
            const estadoDestino = estadosTempranos.indexOf(_datos.estadoActual) !== -1
                ? 'cotizada'
                : (_datos.estadoActual || 'cotizada');

            await apiClient.post('api_solicitudes.php', { action: 'cambiar_estado' }, {
                id: _datos.solicitudId,
                estado: estadoDestino,
                precio_final: precio,
                modalidad_pago: cond.modalidad,
                porcentaje_abono: cond.modalidad === 'partes' ? cond.porcentaje : null
            });

            notificar('Precio enviado a la solicitud correctamente.', 'success');

            // Limpiar borrador — la cotización ya fue comprometida
            if (typeof window.limpiarBorradorCotizacion === 'function') {
                window.limpiarBorradorCotizacion(_datos.solicitudId);
            }

            if (typeof _datos.alEnviar === 'function') {
                _datos.alEnviar({
                    precio: precio,
                    modalidad_pago: cond.modalidad,
                    porcentaje_abono: cond.modalidad === 'partes' ? cond.porcentaje : null,
                    abono_sugerido: cond.abono,
                    saldo_sugerido: cond.saldo,
                    estado: estadoDestino
                });
            }

            cerrar();
        } catch (err) {
            console.error('Error al enviar precio a la solicitud:', err);
            notificar('No se pudo enviar el precio a la solicitud. Intenta de nuevo.', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = textoOriginal;
        }
    }

    // ============================================
    // API PÚBLICA
    // ============================================
    window.abrirCotizacionFormal = function (datos) {
        _datos = datos || {};
        inyectarEstilos();
        if (!_overlay) _overlay = crearOverlay();

        // Mostrar/ocultar botón de envío
        const btnEnviar = document.getElementById('cfEnviar');
        btnEnviar.style.display = (_datos.permiteEnvio && _datos.solicitudId) ? '' : 'none';

        // Reiniciar controles a su estado inicial
        const radioUnico = _overlay.querySelector('input[name="cfModalidad"][value="unico"]');
        if (radioUnico) radioUnico.checked = true;
        document.getElementById('cfAbonoConfig').style.display = 'none';
        document.getElementById('cfPorcentajeAbono').value = 50;

        renderOpcionesPrecio();
        renderDocumento();

        _overlay.classList.add('activo');
    };

    window.cerrarCotizacionFormal = cerrar;

})();
