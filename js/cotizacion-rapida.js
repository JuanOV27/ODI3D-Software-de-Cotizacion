// ============================================================
// COTIZACIÓN RÁPIDA — Auto-slice con Kiri:Moto
// ODI3D Sistema de Cotización 3D
// ============================================================

const CotizacionRapida = {

    // ─── Configuración ─────────────────────────────────────────
    KIRI_ORIGIN: 'http://localhost:8080',
    KIRI_URL:    'http://localhost:8080/kiri/auto-slice.html',

    _iframeTimeout: null,
    _sliceTimeout:  null,
    _mirrorInterval: null,

    // ─── Estado ────────────────────────────────────────────────
    state: {
        mode:          'manual',
        sliceDone:     false,
        iframeReady:   false,
        kiriAvailable: null,   // null=desconocido, true, false
        pesoGramos:    null,
        tiempoMinutos: null,
        pendingFile:   null,
    },

    // ─── Init ──────────────────────────────────────────────────
    init() {
        this.setupMessageListener();
        // Copiar opciones de los selects del modo manual al modo rápido
        this._mirrorInterval = setInterval(() => this._tryMirrorDropdowns(), 500);
        setTimeout(() => {
            clearInterval(this._mirrorInterval);
            this._mirrorInterval = null;
        }, 15000);
    },

    // ─── Switch de modo ────────────────────────────────────────
    setMode(mode) {
        this.state.mode = mode;

        const manualPanel = document.getElementById('stepsColumnManual');
        const quickPanel  = document.getElementById('stepsColumnRapido');
        const btnManual   = document.getElementById('btnModoManual');
        const btnRapido   = document.getElementById('btnModoRapido');

        if (mode === 'rapida') {
            manualPanel.style.display = 'none';
            quickPanel.style.display  = '';
            btnManual.classList.remove('mode-btn--active');
            btnRapido.classList.add('mode-btn--active');
            this.ensureIframeReady();
        } else {
            manualPanel.style.display = '';
            quickPanel.style.display  = 'none';
            btnManual.classList.add('mode-btn--active');
            btnRapido.classList.remove('mode-btn--active');
        }
    },

    // ─── Arranque del iframe de Kiri ───────────────────────────
    ensureIframeReady() {
        if (this.state.kiriAvailable === false) {
            this.setStatus('error',
                '⚠️ Kiri:Moto no disponible en localhost:8080. ' +
                'Inicia el servidor: cd grid-apps && npm run dev');
            return;
        }
        if (this.state.iframeReady) return;

        this.setStatus('loading', 'Cargando motor de laminado...');

        const iframe = document.getElementById('quickKiriFrame');

        // iframe.onload solo confirma que el HTML cargó.
        // iframeReady=true se establece cuando llega { event:'kiri.ready' }
        // (después de que los módulos ES terminan de importarse).
        iframe.onload = () => {
            this.setStatus('loading', 'Inicializando módulos de Kiri:Moto...');
        };

        // Timeout generoso: los módulos ES tardan en cargarse en cascada
        this._iframeTimeout = setTimeout(() => {
            if (!this.state.iframeReady) {
                this.state.kiriAvailable = false;
                this.setStatus('error',
                    '⚠️ Tiempo de espera agotado. Verifica que el servidor ' +
                    'esté corriendo con "cd grid-apps && npm run dev".');
            }
        }, 20000);

        if (!iframe.src || iframe.src === 'about:blank') {
            iframe.src = this.KIRI_URL;
        }
    },

    // ─── Manejo de archivos ────────────────────────────────────
    triggerFileSelect() {
        document.getElementById('quickFileInput').click();
    },

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) this.processFile(file);
        event.target.value = '';
    },

    handleDrop(event) {
        event.preventDefault();
        document.getElementById('quickDropzone').classList.remove('dragover');
        const file = event.dataTransfer.files[0];
        if (!file) return;
        const name = file.name.toLowerCase();
        if (name.endsWith('.stl') || name.endsWith('.3mf')) {
            this.processFile(file);
        } else {
            this.setStatus('warning', 'Formato no soportado. Usa archivos .STL o .3MF');
        }
    },

    processFile(file) {
        this.resetSliceState();
        this.setProgressStep('upload', 'active');
        this.setStatus('loading', `Cargando "${file.name}"...`);

        const label = document.querySelector('.quick-dropzone__label');
        if (label) label.textContent = file.name;

        if (!this.state.iframeReady) {
            this.state.pendingFile = file;
            this.ensureIframeReady();
            return;
        }

        this.loadFileIntoKiri(file);
    },

    async loadFileIntoKiri(file) {
        this.setProgressStep('slice', 'active');
        this.setStatus('loading', 'Enviando a Kiri:Moto para análisis...');

        let buffer;
        try {
            buffer = await this.readAsArrayBuffer(file);
        } catch (e) {
            this.setStatus('error', 'Error al leer el archivo. Intenta de nuevo.');
            return;
        }

        const iframe = document.getElementById('quickKiriFrame');
        const ext    = file.name.split('.').pop().toLowerCase();

        iframe.contentWindow.postMessage(
            { parse: buffer, type: ext },
            this.KIRI_ORIGIN,
            [buffer]
        );

        this.setStatus('loading', 'Calculando peso y tiempo de impresión...');

        // Timeout de seguridad (60s para modelos grandes)
        clearTimeout(this._sliceTimeout);
        this._sliceTimeout = setTimeout(() => {
            if (!this.state.sliceDone) {
                this.setStatus('error',
                    'El análisis tardó demasiado. Verifica que el modelo sea válido e inténtalo de nuevo.');
                this.setProgressStep('slice', 'idle');
            }
        }, 60000);
    },

    // ─── Listener de mensajes de Kiri ─────────────────────────
    setupMessageListener() {
        window.addEventListener('message', (event) => {
            if (event.origin !== this.KIRI_ORIGIN) return;
            const data = event.data;
            if (!data) return;
            // kiri.ready y kiri.pong siempre se procesan (no dependen del modo)
            if (data.event === 'kiri.ready' || data.event === 'kiri.pong') {
                this.handleKiriMessage(data);
                return;
            }
            // El resto solo en modo rápido
            if (this.state.mode !== 'rapida') return;
            this.handleKiriMessage(data);
        });
    },

    handleKiriMessage(data) {
        if (!data) return;

        // Handshake: auto-slice.html terminó de cargar sus módulos ES
        if (data.event === 'kiri.ready') {
            clearTimeout(this._iframeTimeout);
            this.state.iframeReady   = true;
            this.state.kiriAvailable = true;
            this.setStatus('idle', 'Sube un archivo STL o 3MF para comenzar');
            if (this.state.pendingFile) {
                const f = this.state.pendingFile;
                this.state.pendingFile = null;
                this.loadFileIntoKiri(f);
            }
            return;
        }

        // Actualizaciones de progreso desde auto-slice.html
        if (data.event === 'kiri.progress') {
            this.setStatus('loading', data.message || 'Procesando...');
            return;
        }

        if (data.event === 'slice.done') {
            this.onSliceDone(data.data || data);
            return;
        }
        if (data.event === 'slice.error') {
            clearTimeout(this._sliceTimeout);
            this.setStatus('error', '⚠️ ' + (data.message || 'Error en el análisis'));
            this.setProgressStep('slice', 'idle');
            return;
        }
        // Fallback para builds de Kiri que envían stats directamente
        if (data.stats || (data.time !== undefined && data.distance !== undefined)) {
            this.onSliceDone(data.stats || data);
        }
    },

    onSliceDone(output) {
        clearTimeout(this._sliceTimeout);

        const extrudedMm = output.distance || output.filament || output.extruded || 0;
        const timeSec    = output.time || output.print_time || 0;

        // Filamento mm → gramos (PLA 1.75mm, ø=1.75mm→radio=0.875mm, densidad 1.24 g/cm³)
        let peso = 0;
        if (extrudedMm > 0) {
            peso = (extrudedMm * Math.PI * Math.pow(0.875, 2) * 1.24) / 1000;
        } else if (output.weight || output.material) {
            peso = parseFloat(output.weight || output.material) || 0;
        }

        const tiempo = timeSec > 60
            ? Math.round(timeSec / 60)
            : (output.minutes || Math.round(timeSec));

        if (peso <= 0 && tiempo <= 0) {
            this.setStatus('warning',
                'No se pudieron obtener datos del modelo. Verifica que el archivo sea válido.');
            return;
        }

        this.state.pesoGramos    = Math.round(peso * 10) / 10 || 1;
        this.state.tiempoMinutos = tiempo || 1;
        this.state.sliceDone     = true;

        document.getElementById('quickPesoDisplay').textContent   = this.state.pesoGramos + ' g';
        document.getElementById('quickTiempoDisplay').textContent = this.state.tiempoMinutos + ' min';
        document.getElementById('quickSliceResults').style.display = '';

        this.setProgressStep('upload', 'done');
        this.setProgressStep('slice', 'done');
        this.setProgressStep('ready', 'done');
        this.setStatus('success', '✓ Modelo analizado. Completa los parámetros y calcula el precio.');

        document.getElementById('quickCalcBtn').disabled = false;
        document.getElementById('quickCalcHint').style.display = 'none';
    },

    // ─── Bridge hacia calcularPrecio() ────────────────────────
    calcular() {
        if (!this.state.sliceDone) return;

        const filVal = document.getElementById('quickFilamento').value;
        const maqVal = document.getElementById('quickMaquina').value;

        if (!filVal) {
            this.setStatus('warning', 'Selecciona un filamento antes de calcular.');
            return;
        }
        if (!maqVal) {
            this.setStatus('warning', 'Selecciona una máquina antes de calcular.');
            return;
        }

        // 1. Escribir valores extraídos del laminado en los campos canónicos
        this._setField('pesoPieza',       this.state.pesoGramos);
        this._setField('tiempoImpresion', this.state.tiempoMinutos);

        // 2. Escribir los demás campos del formulario rápido
        this._setField('nombrePieza',     document.getElementById('quickNombrePieza').value || 'Pieza rápida');
        this._setField('cantidadPiezas',  document.getElementById('quickCantidad').value);
        this._setField('piezasPorLote',   document.getElementById('quickPiezasLote').value);
        this._setField('margenMinorista', document.getElementById('quickMargenMin').value);
        this._setField('margenMayorista', document.getElementById('quickMargenMay').value);
        this._setField('horasDiseno',     document.getElementById('quickHorasDiseno').value);
        this._setField('costoHoraDiseno', document.getElementById('quickCostoHoraDiseno').value);

        // 3. Sincronizar filamento
        const canonFilamento = document.getElementById('perfilFilamentoCotizacion');
        if (canonFilamento) {
            canonFilamento.value = filVal;
            if (typeof cargarPerfilFilamentoEnCotizacion === 'function') {
                cargarPerfilFilamentoEnCotizacion();
            }
        }

        // 4. Sincronizar máquina — modo máquina única
        const modoUnica = document.querySelector('input[name="modoMaquina"][value="unica"]');
        if (modoUnica && !modoUnica.checked) {
            modoUnica.checked = true;
            modoUnica.dispatchEvent(new Event('change'));
        }
        const canonMaquina = document.getElementById('maquinaSeleccionada');
        if (canonMaquina) {
            canonMaquina.value = maqVal;
            if (typeof actualizarInfoMaquina === 'function') {
                actualizarInfoMaquina();
            } else {
                canonMaquina.dispatchEvent(new Event('change'));
            }
        }

        // 5. Desactivar secciones opcionales para cotización limpia
        const cbPost = document.getElementById('incluirPostprocesado');
        if (cbPost && cbPost.checked) cbPost.click();

        const cbPaq = document.getElementById('incluirPaqueteria');
        if (cbPaq && cbPaq.checked) cbPaq.click();

        const cbDel = document.getElementById('requiereDelivery');
        if (cbDel && cbDel.checked) cbDel.click();

        // 6. Llamar a la función de cálculo compartida
        if (typeof calcularPrecio === 'function') {
            calcularPrecio();
        }
    },

    _setField(id, value) {
        const el = document.getElementById(id);
        if (el) el.value = value;
    },

    // ─── Copia de dropdowns Manual → Rápido ───────────────────
    _tryMirrorDropdowns() {
        const filDone = this._mirrorSelect(
            'perfilFilamentoCotizacion', 'quickFilamento',
            () => CotizacionRapida._onQuickFilamentoChange()
        );
        const maqDone = this._mirrorSelect('maquinaSeleccionada', 'quickMaquina', null);

        if (filDone && maqDone) {
            clearInterval(this._mirrorInterval);
            this._mirrorInterval = null;
        }
    },

    _mirrorSelect(sourceId, targetId, onchange) {
        const source = document.getElementById(sourceId);
        const target = document.getElementById(targetId);
        if (!source || !target) return false;
        if (source.options.length <= 1) return false;

        const currentVal = target.value;
        target.innerHTML = source.innerHTML;
        if (currentVal) target.value = currentVal;
        if (onchange) target.onchange = onchange;
        return true;
    },

    _onQuickFilamentoChange() {
        const quickVal  = document.getElementById('quickFilamento').value;
        const canonical = document.getElementById('perfilFilamentoCotizacion');
        if (!canonical) return;
        canonical.value = quickVal;
        if (typeof cargarPerfilFilamentoEnCotizacion === 'function') {
            cargarPerfilFilamentoEnCotizacion();
        }
    },

    // ─── Helpers de UI ─────────────────────────────────────────
    resetSliceState() {
        clearTimeout(this._sliceTimeout);
        this.state.sliceDone     = false;
        this.state.pesoGramos    = null;
        this.state.tiempoMinutos = null;

        const results = document.getElementById('quickSliceResults');
        if (results) results.style.display = 'none';

        const btn = document.getElementById('quickCalcBtn');
        if (btn) btn.disabled = true;

        const hint = document.getElementById('quickCalcHint');
        if (hint) hint.style.display = '';

        ['upload', 'slice', 'ready'].forEach(s => this.setProgressStep(s, 'idle'));
    },

    setProgressStep(step, state) {
        const el = document.getElementById('qstep-' + step);
        if (!el) return;
        el.className = 'quick-step' + (state !== 'idle' ? ' quick-step--' + state : '');
    },

    setStatus(type, msg) {
        const el = document.getElementById('quickStatusMsg');
        if (!el) return;
        el.textContent = msg;
        el.className   = 'quick-status-msg' + (type !== 'idle' ? ' quick-status-msg--' + type : '');
    },

    readAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload  = e => resolve(e.target.result);
            reader.onerror = () => reject(new Error('FileReader error'));
            reader.readAsArrayBuffer(file);
        });
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => CotizacionRapida.init());
} else {
    CotizacionRapida.init();
}

window.CotizacionRapida = CotizacionRapida;
