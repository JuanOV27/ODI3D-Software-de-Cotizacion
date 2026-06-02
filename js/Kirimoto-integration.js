// ============================================
// INTEGRACIÓN KIRI:MOTO — PANEL LATERAL LOCAL
// ODI3D Sistema de Cotización 3D
// ============================================
// Requiere servidor local: cd grid-apps && npm run dev
// URL del laminador: http://localhost:8080/kiri/
// ============================================

const KiriMotoIntegration = {

    config: {
        localUrl: 'http://localhost:8080/kiri/',
        buildVolume: { x: 220, y: 220, z: 250 },
    },

    state: {
        panelOpen: true,
        panelExpanded: false,
        modelData: null,
    },

    // ============================================
    // INICIALIZACIÓN
    // ============================================

    init() {
        this.setupMessageListener();
        console.log('🚀 Kiri:Moto panel lateral inicializado — ' + this.config.localUrl);
    },

    // ============================================
    // CONTROL DEL PANEL
    // ============================================

    togglePanel() {
        const panel = document.getElementById('kiriSidePanel');
        if (!panel) return;

        const isOpen = panel.classList.contains('kiri-panel-open') ||
                       panel.classList.contains('kiri-panel-expanded');

        if (isOpen) {
            // Colapsar
            panel.classList.remove('kiri-panel-open', 'kiri-panel-expanded');
            document.body.classList.remove('kiri-panel-open', 'kiri-panel-expanded');
            this.state.panelOpen = false;
            this.state.panelExpanded = false;
            this._resetExpandBtn();
        } else {
            // Abrir en modo normal
            panel.classList.add('kiri-panel-open');
            panel.classList.remove('kiri-panel-expanded');
            document.body.classList.add('kiri-panel-open');
            document.body.classList.remove('kiri-panel-expanded');
            this.state.panelOpen = true;
            this.state.panelExpanded = false;
            this._resetExpandBtn();
        }
    },

    expandPanel() {
        const panel = document.getElementById('kiriSidePanel');
        if (!panel) return;

        const isExpanded = panel.classList.contains('kiri-panel-expanded');
        const btn = document.getElementById('kiriExpandBtn');

        if (isExpanded) {
            // Reducir a tamaño normal (50vw)
            panel.classList.remove('kiri-panel-expanded');
            panel.classList.add('kiri-panel-open');
            document.body.classList.remove('kiri-panel-expanded');
            document.body.classList.add('kiri-panel-open');
            this.state.panelExpanded = false;
            this.state.panelOpen = true;
            if (btn) { btn.textContent = '⊞'; btn.title = 'Expandir a 70%'; }
        } else {
            // Expandir a 70vw
            panel.classList.add('kiri-panel-expanded');
            panel.classList.remove('kiri-panel-open');
            document.body.classList.add('kiri-panel-expanded');
            document.body.classList.remove('kiri-panel-open');
            this.state.panelExpanded = true;
            this.state.panelOpen = false;
            if (btn) { btn.textContent = '⊟'; btn.title = 'Reducir panel'; }
        }
    },

    _resetExpandBtn() {
        const btn = document.getElementById('kiriExpandBtn');
        if (btn) { btn.textContent = '⊞'; btn.title = 'Expandir a 70%'; }
    },

    // ============================================
    // RECEPCIÓN DE DATOS DESDE KIRI:MOTO
    // Kiri:Moto envía postMessage con datos al exportar
    // ============================================

    setupMessageListener() {
        window.addEventListener('message', (event) => {
            // Aceptar mensajes del kirimoto local o del origen actual
            const allowed = [
                'http://localhost:8080',
                'http://localhost',
                'https://grid.space',
                window.location.origin,
            ];
            if (!allowed.includes(event.origin)) return;

            this.handleIframeMessage(event.data);
        });
        console.log('📡 Listener de mensajes Kiri:Moto configurado');
    },

    handleIframeMessage(data) {
        if (!data || typeof data !== 'object') return;

        console.log('📨 Mensaje de Kiri:Moto recibido:', data);

        let weight = 0;
        let printTime = 0;

        // Formato 1: { stats: { weight, time, material } }
        if (data.stats) {
            weight    = parseFloat(data.stats.weight || data.stats.material || 0);
            printTime = this._parseTime(data.stats.time || data.stats.print_time || 0);
        }

        // Formato 2: { weight, time } o { material, print_time }
        if (data.weight !== undefined) {
            weight = parseFloat(data.weight || data.material || 0);
        }
        if (data.time !== undefined) {
            printTime = this._parseTime(data.time || data.print_time || 0);
        }

        // Formato 3: evento de exportación { event: 'slice'|'export', weight, time }
        if (data.event === 'slice' || data.event === 'export') {
            weight    = parseFloat(data.weight || data.material || weight);
            printTime = this._parseTime(data.time   || data.print_time || printTime);
        }

        if (weight > 0 || printTime > 0) {
            this.state.modelData = { weight, printTime };
            this.updateFormWithData({ weight, printTime });
            this._showAutoStatus(
                `✅ Datos recibidos: ${weight.toFixed(1)} g — ${Math.round(printTime)} min`,
                true
            );
        }
    },

    /**
     * Parsea el tiempo desde distintos formatos posibles:
     *   - número  → minutos directamente
     *   - "h:m:s" → convierte a minutos
     *   - "h:m"   → convierte a minutos
     */
    _parseTime(raw) {
        if (!raw) return 0;
        if (typeof raw === 'number') return raw;
        if (typeof raw === 'string') {
            const parts = raw.split(':');
            if (parts.length === 3) {
                return parseInt(parts[0]) * 60 + parseInt(parts[1]) + parseInt(parts[2]) / 60;
            }
            if (parts.length === 2) {
                return parseInt(parts[0]) * 60 + parseInt(parts[1]);
            }
            return parseFloat(raw) || 0;
        }
        return 0;
    },

    _showAutoStatus(msg, isSuccess = false) {
        const el = document.getElementById('kiriAutoStatus');
        if (!el) return;
        el.innerHTML = msg;
        el.className = 'kiri-auto-status' + (isSuccess ? ' status-success' : '');
        if (isSuccess) {
            setTimeout(() => {
                el.innerHTML = '💡 Lamina tu modelo → haz clic en <strong>Exportar</strong> para auto-completar los datos';
                el.className = 'kiri-auto-status';
            }, 8000);
        }
    },

    // ============================================
    // ACTUALIZACIÓN DEL FORMULARIO DE COTIZACIÓN
    // ============================================

    updateFormWithData(modelInfo) {
        const pesoPieza = document.getElementById('pesoPieza');
        if (pesoPieza && modelInfo.weight > 0) {
            pesoPieza.value = Math.round(modelInfo.weight * 10) / 10;
            pesoPieza.dispatchEvent(new Event('input'));
            this._flashField(pesoPieza);
        }

        const tiempoImpresion = document.getElementById('tiempoImpresion');
        if (tiempoImpresion && modelInfo.printTime > 0) {
            tiempoImpresion.value = Math.round(modelInfo.printTime);
            tiempoImpresion.dispatchEvent(new Event('input'));
            this._flashField(tiempoImpresion);
        }

        if (typeof calcularPrecio === 'function') {
            setTimeout(() => calcularPrecio(), 150);
        }

        console.log('✅ Formulario actualizado con datos de Kiri:Moto:', modelInfo);
    },

    /** Resalta un campo brevemente en verde para feedback visual */
    _flashField(el) {
        el.style.transition = 'background 0.2s ease';
        el.style.background = '#D1FAE5';
        setTimeout(() => { el.style.background = ''; }, 2200);
    },

    // ============================================
    // MODAL DE CAPTURA MANUAL DE DATOS
    // Fallback cuando no se auto-captura desde postMessage
    // ============================================



    // ============================================
    // UTILIDADES
    // ============================================

    validateBuildVolume(bounds) {
        if (!bounds) return;
        const { x, y, z } = this.config.buildVolume;
        const oversized = { x: bounds.x > x, y: bounds.y > y, z: bounds.z > z };
        if (oversized.x || oversized.y || oversized.z) {
            console.warn('⚠️ Modelo excede el volumen de construcción configurado:', bounds);
        }
    },

    // Compatibilidad hacia atrás con código antiguo que llame a estos métodos
    closeKiriView()  { /* no-op: el panel se maneja con togglePanel() */ },
    toggleKiriView() { this.togglePanel(); },
};

// ============================================
// AUTO-INICIALIZACIÓN
// ============================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => KiriMotoIntegration.init());
} else {
    KiriMotoIntegration.init();
}
