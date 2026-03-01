/**
 * Script de Puente para Comunicación
 * Sistema de Cotización 3D ↔ HandHelHearts
 *
 * Este script se debe incluir en cotizacion.html para permitir
 * la comunicación con el sistema principal de HandHelHearts
 */

(function() {
    'use strict';

    console.log('🌉 Bridge HandHelHearts inicializado');
    console.log('📍 Script cargado desde:', window.location.href);
    console.log('🔗 Parent window:', window.parent !== window ? 'Sí (en iframe)' : 'No (ventana principal)');

    // Configuración
    const CONFIG = {
        targetOrigin: '*', // En producción, especificar el dominio exacto
        enableAutoSync: true,
        syncOnCalculate: true
    };

    console.log('⚙️ Configuración del bridge:', CONFIG);

    /**
     * Capturar datos de la cotización cuando se calcula
     */
    function capturarDatosCotizacion() {
        const datos = {
            type: 'cotizacion-data',
            timestamp: new Date().toISOString(),
            nombrePieza: document.getElementById('nombrePieza')?.value || '',
            pesoPieza: parseFloat(document.getElementById('pesoPieza')?.value) || 0,
            tiempoImpresion: parseFloat(document.getElementById('tiempoImpresion')?.value) || 0,

            // Datos de filamento
            filamento: {
                tipo: document.getElementById('perfilFilamentoCotizacion')?.options[
                    document.getElementById('perfilFilamentoCotizacion')?.selectedIndex
                ]?.text || '',
                costoCarrete: parseFloat(document.getElementById('costoCarrete')?.value) || 0,
                pesoCarrete: parseFloat(document.getElementById('pesoCarrete')?.value) || 0
            },

            // Cantidad
            cantidadPiezas: parseFloat(document.getElementById('cantidadPiezas')?.value) || 1,
            piezasPorLote: parseFloat(document.getElementById('piezasPorLote')?.value) || 1,

            // Precios principales
            precioBase: parseFloat(document.getElementById('precioFinal')?.textContent?.replace(/[$,]/g, '')) || 0,
            precioMinorista: parseFloat(document.getElementById('precioMinorista')?.textContent?.replace(/[$,]/g, '')) || 0,
            precioMayorista: parseFloat(document.getElementById('precioMayorista')?.textContent?.replace(/[$,]/g, '')) || 0,

            // Costos detallados
            costos: {
                fabricacion: parseFloat(document.getElementById('costoFabricacion')?.textContent?.replace(/[$,]/g, '')) || 0,
                energia: parseFloat(document.getElementById('costoEnergia')?.textContent?.replace(/[$,]/g, '')) || 0,
                diseno: parseFloat(document.getElementById('costoDiseno')?.textContent?.replace(/[$,]/g, '')) || 0,
                depreciacion: parseFloat(document.getElementById('depreciacionMaquina')?.textContent?.replace(/[$,]/g, '')) || 0,
                gif: parseFloat(document.getElementById('costoGIF')?.textContent?.replace(/[$,]/g, '')) || 0,
                aiu: parseFloat(document.getElementById('costoAIU')?.textContent?.replace(/[$,]/g, '')) || 0,
                postprocesado: {
                    manoObra: parseFloat(document.getElementById('costoManoObraPostprocesadoDisplay')?.textContent?.replace(/[$,]/g, '')) || 0,
                    insumos: parseFloat(document.getElementById('costoInsumosPostprocesadoDisplay')?.textContent?.replace(/[$,]/g, '')) || 0
                },
                paqueteria: parseFloat(document.getElementById('costoPaqueteriaDisplay')?.textContent?.replace(/[$,]/g, '')) || 0,
                delivery: parseFloat(document.getElementById('costoDeliveryDisplay')?.textContent?.replace(/[$,]/g, '')) || 0
            },

            // Totales del pedido
            totales: {
                costoTotal: parseFloat(document.getElementById('desgloseCostoTotalPedido')?.textContent?.replace(/[$,]/g, '')) || 0,
                totalMinorista: parseFloat(document.getElementById('desgloseTotalMinorista')?.textContent?.replace(/[$,]/g, '')) || 0,
                totalMayorista: parseFloat(document.getElementById('desgloseTotalMayorista')?.textContent?.replace(/[$,]/g, '')) || 0,
                filamentoTotal: parseFloat(document.getElementById('desgloseFilamentoTotal')?.textContent?.replace(/[g,]/g, '')) || 0,
                tiempoTotal: document.getElementById('desgloseTiempoTotal')?.textContent || '0h'
            }
        };

        return datos;
    }

    /**
     * Enviar datos al sistema principal
     */
    function enviarDatosAlPadre(datos) {
        if (window.parent && window.parent !== window) {
            console.log('📤 Enviando datos al sistema principal:', datos);
            window.parent.postMessage(datos, CONFIG.targetOrigin);
        }
    }

    /**
     * Escuchar solicitudes del sistema principal
     */
    window.addEventListener('message', function(event) {
        // Verificar origen (en producción)
        // if (event.origin !== 'http://localhost') return;

        if (event.data && event.data.type === 'get-cotizacion-data') {
            console.log('📥 Solicitud de datos recibida del sistema principal');
            const datos = capturarDatosCotizacion();
            enviarDatosAlPadre(datos);
        }

        if (event.data && event.data.type === 'load-cotizacion-data') {
            console.log('📥 Recibiendo datos para cargar:', event.data.datos);
            cargarDatosEnFormulario(event.data.datos);
        }
    });

    /**
     * Cargar datos recibidos en el formulario
     */
    function cargarDatosEnFormulario(datos) {
        if (datos.nombrePieza) {
            const nombreInput = document.getElementById('nombrePieza');
            if (nombreInput) nombreInput.value = datos.nombrePieza;
        }

        if (datos.pesoPieza) {
            const pesoInput = document.getElementById('pesoPieza');
            if (pesoInput) pesoInput.value = datos.pesoPieza;
        }

        if (datos.tiempoImpresion) {
            const tiempoInput = document.getElementById('tiempoImpresion');
            if (tiempoInput) tiempoInput.value = datos.tiempoImpresion;
        }

        if (datos.cantidadPiezas) {
            const cantidadInput = document.getElementById('cantidadPiezas');
            if (cantidadInput) cantidadInput.value = datos.cantidadPiezas;
        }

        console.log('✅ Datos cargados en el formulario');
    }

    /**
     * Interceptar el cálculo de cotización
     */
    function interceptarCalculoCotizacion() {
        const botonCalcular = document.querySelector('button[onclick*="calcularPrecio"]');

        if (botonCalcular) {
            console.log('🎯 Botón de cálculo encontrado, agregando interceptor');

            // Guardar la función original
            const calcularPrecioOriginal = window.calcularPrecio;

            // Sobrescribir la función
            window.calcularPrecio = function() {
                // Ejecutar la función original
                if (calcularPrecioOriginal) {
                    calcularPrecioOriginal.apply(this, arguments);
                }

                // Esperar un poco para que se actualice el DOM
                setTimeout(() => {
                    if (CONFIG.syncOnCalculate) {
                        const datos = capturarDatosCotizacion();
                        enviarDatosAlPadre(datos);
                        console.log('✅ Datos sincronizados automáticamente después del cálculo');
                    }
                }, 500);
            };
        }
    }

    /**
     * Agregar botón de sincronización manual
     */
    function agregarBotonSincronizacion() {
        // Buscar el panel de acciones
        const accionesPanel = document.querySelector('.acciones-cotizacion');

        if (accionesPanel && !document.getElementById('btnSyncHandHelHearts')) {
            const botonSync = document.createElement('button');
            botonSync.id = 'btnSyncHandHelHearts';
            botonSync.type = 'button';
            botonSync.className = 'btn-accion';
            botonSync.innerHTML = `
                <span style="font-size: 1.3rem;">🔄</span>
                <span>Enviar a HandHelHearts</span>
            `;
            botonSync.style.cssText = `
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                color: white;
                border: none;
                padding: 14px 20px;
                border-radius: 10px;
                font-weight: 600;
                font-size: 0.95rem;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3);
                transition: all 0.3s ease;
                margin-top: 12px;
            `;

            botonSync.addEventListener('mouseover', function() {
                this.style.transform = 'translateY(-2px)';
                this.style.boxShadow = '0 6px 12px rgba(16, 185, 129, 0.4)';
            });

            botonSync.addEventListener('mouseout', function() {
                this.style.transform = 'translateY(0)';
                this.style.boxShadow = '0 4px 6px rgba(16, 185, 129, 0.3)';
            });

            botonSync.addEventListener('click', function() {
                const datos = capturarDatosCotizacion();
                enviarDatosAlPadre(datos);

                // Feedback visual
                this.innerHTML = '<span style="font-size: 1.3rem;">✅</span><span>¡Enviado!</span>';
                setTimeout(() => {
                    this.innerHTML = '<span style="font-size: 1.3rem;">🔄</span><span>Enviar a HandHelHearts</span>';
                }, 2000);
            });

            accionesPanel.querySelector('div').appendChild(botonSync);
            console.log('✅ Botón de sincronización agregado');
        }
    }

    /**
     * Inicializar el puente
     */
    function inicializar() {
        console.log('🚀 Inicializando puente de comunicación...');

        // Esperar a que el DOM esté listo
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                setTimeout(() => {
                    interceptarCalculoCotizacion();
                    agregarBotonSincronizacion();
                }, 1000);
            });
        } else {
            setTimeout(() => {
                interceptarCalculoCotizacion();
                agregarBotonSincronizacion();
            }, 1000);
        }

        // Notificar al padre que estamos listos
        setTimeout(() => {
            if (window.parent && window.parent !== window) {
                window.parent.postMessage({
                    type: 'cotizacion-ready',
                    message: 'Sistema de cotización listo'
                }, CONFIG.targetOrigin);
                console.log('✅ Sistema de cotización listo y comunicado al padre');
            }
        }, 2000);
    }

    // Exponer funciones globalmente
    window.HandHelHeartsBridge = {
        capturarDatos: capturarDatosCotizacion,
        enviarDatos: function() {
            const datos = capturarDatosCotizacion();
            enviarDatosAlPadre(datos);
        },
        cargarDatos: cargarDatosEnFormulario,
        config: CONFIG
    };

    // Inicializar
    inicializar();

    console.log('🌉 Bridge HandHelHearts listo para usar');
})();
