// ============================================
// INTEGRACIÓN KIRI:MOTO - MÓDULO ADAPTATIVO
// ============================================

const KiriMotoIntegration = {
    // Configuración
    config: {
        workerUrl: 'https://grid.space/kiri/engine.html',
        iframeUrl: 'https://grid.space/kiri/',
        buildVolume: { x: 220, y: 220, z: 250 }, // Volumen de impresión en mm
        isMobile: false,
        mode: null // 'worker' o 'iframe'
    },

    // Estado
    state: {
        worker: null,
        iframe: null,
        currentFile: null,
        modelData: null,
        isProcessing: false
    },

    // ============================================
    // INICIALIZACIÓN
    // ============================================
    
    init() {
        this.detectDevice();
        this.setupUI();
        this.setupMessageListener();
        console.log(`🚀 Kiri:Moto inicializado en modo: ${this.config.mode}`);
    },

    setupMessageListener() {
        // Escuchar mensajes del iframe de Kiri:Moto
        window.addEventListener('message', (event) => {
            // Verificar origen por seguridad
            if (event.origin === 'https://grid.space' || event.origin === window.location.origin) {
                this.handleIframeMessage(event.data);
            }
        });
        
        console.log('📡 Listener de mensajes configurado');
    },

    detectDevice() {
        // Detectar si es móvil
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isSmallScreen = window.innerWidth <= 768;
        
        this.config.isMobile = isMobile || isSmallScreen;
        this.config.mode = this.config.isMobile ? 'worker' : 'iframe';
    },

    setupUI() {
        // Buscar el mejor lugar para insertar el botón de carga
        // Intentamos varios selectores en orden de prioridad
        
        const selectors = [
            '#nombrePieza',           // Buscar por ID del input de nombre
            'input[id="nombrePieza"]', // Alternativa
            '.form-group:first-child', // Primer form-group
            '.step-container .form-group', // Cualquier form-group en step-container
            'form .form-group',        // Form-group dentro de un form
        ];

        let targetElement = null;
        
        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
                // Si es un input, tomamos su form-group padre
                if (element.tagName === 'INPUT') {
                    targetElement = element.closest('.form-group');
                } else {
                    targetElement = element;
                }
                console.log('✅ Encontrado lugar para insertar usando:', selector);
                break;
            }
        }

        if (targetElement) {
            const uploadSection = this.createUploadSection();
            // Insertar después del elemento encontrado
            targetElement.parentElement.insertBefore(uploadSection, targetElement.nextSibling);
            console.log('✅ Sección de carga STL insertada correctamente');
        } else {
            console.error('❌ No se encontró un lugar válido para insertar la sección de carga STL');
            console.log('💡 Solución: Agrega manualmente el div con id="kiri-upload-container" en tu HTML');
        }

        // Crear contenedor para Kiri:Moto
        this.createKiriContainer();
    },

    createUploadSection() {
        const section = document.createElement('div');
        section.className = 'form-group kiri-upload-section';
        section.innerHTML = `
            <label>
                <span class="upload-icon">📦</span> Cargar Modelo 3D
                <span class="mode-badge">${this.config.mode === 'worker' ? '📱 Modo Ligero' : '🖥️ Modo Completo'}</span>
            </label>
            <div class="upload-controls">
                <input type="file" id="stlFileInput" accept=".stl,.obj,.3mf" style="display: none;">
                <button type="button" class="btn btn-primary" onclick="KiriMotoIntegration.selectFile()">
                    📂 Seleccionar Archivo STL
                </button>
                <div id="fileStatus" class="file-status"></div>
            </div>
            
            ${this.config.mode === 'iframe' ? `
                <button type="button" class="btn btn-outline" onclick="KiriMotoIntegration.toggleKiriView()" style="margin-top: 10px;">
                    👁️ Ver/Editar Modelo
                </button>
            ` : ''}
        `;

        return section;
    },

    createKiriContainer() {
        if (this.config.mode === 'iframe') {
            const container = document.createElement('div');
            container.id = 'kiriContainer';
            container.className = 'kiri-iframe-container';
            container.innerHTML = `
                <div class="kiri-header">
                    <h3>🎨 Editor Kiri:Moto</h3>
                    <button class="kiri-close" onclick="KiriMotoIntegration.closeKiriView()">✕</button>
                </div>
                <iframe id="kiriFrame" src="${this.config.iframeUrl}"></iframe>
                <div class="kiri-controls">
                    <button class="btn btn-success" onclick="KiriMotoIntegration.applyChanges()">
                        ✓ Aplicar Cambios
                    </button>
                    <button class="btn btn-outline" onclick="KiriMotoIntegration.closeKiriView()">
                        ✕ Cancelar
                    </button>
                </div>
            `;
            document.body.appendChild(container);
        }
    },

    // ============================================
    // MANEJO DE ARCHIVOS
    // ============================================

    selectFile() {
        const input = document.getElementById('stlFileInput');
        if (!input) return;

        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                this.loadFile(file);
            }
        };

        input.click();
    },

    async loadFile(file) {
        if (this.state.isProcessing) {
            alert('⏳ Ya hay un archivo procesándose. Por favor espera.');
            return;
        }

        this.updateStatus(`📥 Cargando ${file.name}...`, 'loading');
        this.state.isProcessing = true;
        this.state.currentFile = file;

        try {
            if (this.config.mode === 'worker') {
                await this.processWithWorker(file);
            } else {
                await this.processWithIframe(file);
            }
        } catch (error) {
            console.error('Error procesando archivo:', error);
            this.updateStatus(`❌ Error: ${error.message}`, 'error');
            this.state.isProcessing = false;
        }
    },

    // ============================================
    // MODO WEB WORKER (MÓVIL)
    // ============================================

    async processWithWorker(file) {
        this.updateStatus('⚙️ Procesando modelo...', 'loading');

        // Crear worker si no existe
        if (!this.state.worker) {
            this.state.worker = await this.createWorker();
        }

        // Leer archivo
        const fileData = await this.readFileAsArrayBuffer(file);

        // Enviar al worker para procesar
        this.state.worker.postMessage({
            cmd: 'slice',
            file: {
                name: file.name,
                data: fileData
            },
            settings: this.getSliceSettings()
        });

        // Escuchar respuesta
        this.state.worker.onmessage = (event) => {
            this.handleWorkerResponse(event.data);
        };
    },

    async createWorker() {
        // Cargar el script del worker
        const script = document.createElement('script');
        script.src = this.config.workerUrl;
        document.head.appendChild(script);

        return new Promise((resolve) => {
            script.onload = () => {
                // Kiri:Moto expone un worker global
                const worker = new Worker(this.config.workerUrl);
                resolve(worker);
            };
        });
    },

    handleWorkerResponse(data) {
        if (data.error) {
            this.updateStatus(`❌ Error: ${data.error}`, 'error');
            this.state.isProcessing = false;
            return;
        }

        if (data.done) {
            // Extraer datos del modelo
            const modelInfo = {
                weight: data.weight || 0, // gramos
                printTime: data.time || 0, // minutos
                volume: data.volume || 0,
                bounds: data.bounds || {}
            };

            this.state.modelData = modelInfo;
            this.updateFormWithData(modelInfo);
            this.updateStatus(`✅ ${this.state.currentFile.name} procesado`, 'success');
            this.state.isProcessing = false;
        }
    },

    // ============================================
    // MODO IFRAME (ESCRITORIO)
    // ============================================

    async processWithIframe(file) {
        const iframe = document.getElementById('kiriFrame');
        
        if (!iframe) {
            throw new Error('iFrame no encontrado');
        }

        // Esperar a que el iframe cargue
        if (!iframe.contentWindow) {
            await new Promise(resolve => {
                iframe.onload = resolve;
            });
        }

        // Usar la API de mensajería de Kiri:Moto
        const fileData = await this.readFileAsArrayBuffer(file);
        
        iframe.contentWindow.postMessage({
            cmd: 'load',
            file: {
                name: file.name,
                data: fileData
            }
        }, '*');

        // Mostrar el viewer
        this.toggleKiriView();
        
        this.updateStatus(`✅ ${file.name} cargado en editor`, 'success');
        this.state.isProcessing = false;
    },

    handleIframeMessage(data) {
        console.log('📨 Mensaje recibido del iframe:', data);
        
        // Manejar diferentes tipos de mensajes de Kiri:Moto
        if (data.state) {
            // Estado del modelo
            console.log('Estado:', data.state);
        }
        
        if (data.stats) {
            // Estadísticas del slicing
            console.log('📊 Estadísticas recibidas:', data.stats);
            this.state.modelData = {
                weight: data.stats.weight || data.stats.material || 0,
                printTime: data.stats.time || data.stats.print_time || 0,
                volume: data.stats.volume || 0,
                bounds: data.stats.bounds || data.bounds || {}
            };
        }
        
        if (data.weight !== undefined || data.time !== undefined) {
            // Formato alternativo de datos
            this.state.modelData = {
                weight: data.weight || data.material || 0,
                printTime: data.time || data.print_time || 0,
                volume: data.volume || 0,
                bounds: data.bounds || {}
            };
        }
    },

    applyChanges() {
        const iframe = document.getElementById('kiriFrame');
        
        if (!iframe || !iframe.contentWindow) {
            alert('⚠️ Error: No se pudo comunicar con Kiri:Moto');
            return;
        }

        console.log('🔄 Abriendo ventana de captura de datos...');
        
        // Mostrar ventana de captura manual
        this.showDataCaptureModal();
    },

    showDataCaptureModal() {
        // Crear modal para captura de datos
        const modal = document.createElement('div');
        modal.className = 'kiri-data-modal';
        modal.innerHTML = `
            <div class="kiri-data-modal-content">
                <div class="kiri-data-header">
                    <h3>📊 Extraer Datos de Kiri:Moto</h3>
                    <button class="kiri-data-close" onclick="this.closest('.kiri-data-modal').remove()">✕</button>
                </div>
                
                <div class="kiri-data-body">
                    <div class="kiri-instructions">
                        <p><strong>📋 Instrucciones:</strong></p>
                        <ol>
                            <li>En la ventana de <strong>Exportar</strong> de Kiri:Moto, busca:</li>
                            <li><strong>"printed weight (g)"</strong> - Copia ese número</li>
                            <li><strong>"time estimate (h:m:s)"</strong> - Anota el tiempo</li>
                        </ol>
                        <p style="background: #fef3c7; padding: 10px; border-radius: 6px; margin-top: 10px;">
                            💡 <strong>Tip:</strong> Si el tiempo dice "02:26:33", son 2 horas y 26 minutos = <strong>146 minutos</strong>
                        </p>
                    </div>

                    <div class="kiri-data-inputs">
                        <div class="kiri-input-group">
                            <label>
                                ⚖️ Peso Impreso (gramos)
                                <span class="hint">Ejemplo: 19.69</span>
                            </label>
                            <input 
                                type="number" 
                                id="kiriWeightInput" 
                                placeholder="19.69"
                                step="0.01"
                                min="0.01"
                            >
                        </div>

                        <div class="kiri-input-group">
                            <label>
                                ⏱️ Tiempo de Impresión (minutos)
                                <span class="hint">Si dice "02:26:33" = 146 minutos</span>
                            </label>
                            <input 
                                type="number" 
                                id="kiriTimeInput" 
                                placeholder="146"
                                step="1"
                                min="1"
                            >
                        </div>

                        <div class="kiri-helper">
                            <strong>🧮 Convertidor de tiempo:</strong>
                            <div style="display: flex; gap: 10px; margin-top: 8px;">
                                <input type="number" id="kiriHours" placeholder="Horas" min="0" style="width: 80px;">
                                <span>:</span>
                                <input type="number" id="kiriMinutes" placeholder="Min" min="0" max="59" style="width: 80px;">
                                <button onclick="KiriMotoIntegration.convertTime()" class="btn-convert">→ Convertir</button>
                            </div>
                        </div>
                    </div>

                    <div class="kiri-data-actions">
                        <button class="btn btn-success" onclick="KiriMotoIntegration.applyManualData()">
                            ✓ Aplicar Datos
                        </button>
                        <button class="btn btn-outline" onclick="this.closest('.kiri-data-modal').remove()">
                            ✕ Cancelar
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Focus en el primer input
        setTimeout(() => {
            document.getElementById('kiriWeightInput').focus();
        }, 100);
    },

    convertTime() {
        const hours = parseInt(document.getElementById('kiriHours').value) || 0;
        const minutes = parseInt(document.getElementById('kiriMinutes').value) || 0;
        const totalMinutes = (hours * 60) + minutes;
        
        document.getElementById('kiriTimeInput').value = totalMinutes;
        
        // Feedback visual
        const timeInput = document.getElementById('kiriTimeInput');
        timeInput.style.background = '#d1fae5';
        setTimeout(() => {
            timeInput.style.background = '';
        }, 1000);
    },

    applyManualData() {
        const weight = parseFloat(document.getElementById('kiriWeightInput').value);
        const time = parseFloat(document.getElementById('kiriTimeInput').value);
        
        if (!weight || !time) {
            alert('⚠️ Por favor ingresa ambos valores (peso y tiempo)');
            return;
        }

        if (weight <= 0 || time <= 0) {
            alert('⚠️ Los valores deben ser mayores a 0');
            return;
        }

        const extractedData = {
            weight: weight,
            printTime: time,
            volume: 0,
            bounds: {}
        };
        
        this.state.modelData = extractedData;
        this.updateFormWithData(extractedData);
        
        // Cerrar modales
        document.querySelector('.kiri-data-modal')?.remove();
        this.closeKiriView();
        
        this.updateStatus(`✅ Datos aplicados: ${weight}g, ${time} min`, 'success');
        
        console.log('✅ Datos aplicados:', extractedData);
    },

    extractDataFromIframe() {
        const iframe = document.getElementById('kiriFrame');
        
        try {
            // Intentar acceder directamente al DOM del iframe
            const iframeDoc = iframe.contentWindow.document;
            
            // Buscar elementos que contengan los datos del slicing
            // Kiri:Moto suele mostrar estos datos en la UI
            const timeElements = iframeDoc.querySelectorAll('[data-time], .print-time, .time-estimate');
            const weightElements = iframeDoc.querySelectorAll('[data-weight], .material-weight, .filament-weight');
            
            console.log('Buscando datos en el iframe...');
            console.log('Elementos de tiempo encontrados:', timeElements.length);
            console.log('Elementos de peso encontrados:', weightElements.length);
            
            // Si encontramos datos, extraerlos
            let extractedData = this.parseUIElements(iframeDoc);
            
            if (extractedData.weight > 0 || extractedData.printTime > 0) {
                this.state.modelData = extractedData;
                this.updateFormWithData(extractedData);
                this.closeKiriView();
                this.updateStatus('✅ Datos extraídos del slicing', 'success');
            } else {
                // Si no hay datos, pedir al usuario que los ingrese manualmente
                this.promptManualInput();
            }
            
        } catch (error) {
            console.error('❌ No se pudo acceder al contenido del iframe (CORS):', error);
            console.log('💡 Intentando método alternativo...');
            this.promptManualInput();
        }
    },

    parseUIElements(iframeDoc) {
        // Intentar parsear los datos de la interfaz de Kiri:Moto
        let weight = 0;
        let printTime = 0;
        
        try {
            // Buscar en el texto de la página
            const bodyText = iframeDoc.body.innerText || '';
            
            // Buscar patrones como "15.5g", "15.5 g", "Material: 15.5g"
            const weightMatch = bodyText.match(/(\d+\.?\d*)\s*g(?:rams?)?/i);
            if (weightMatch) {
                weight = parseFloat(weightMatch[1]);
                console.log('✅ Peso encontrado:', weight, 'g');
            }
            
            // Buscar tiempo en formato "1h 30m", "90m", "1:30"
            const timeMatch = bodyText.match(/(\d+)h\s*(\d+)m|(\d+)m|(\d+):(\d+)/i);
            if (timeMatch) {
                if (timeMatch[1] && timeMatch[2]) {
                    // Formato "1h 30m"
                    printTime = parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2]);
                } else if (timeMatch[3]) {
                    // Formato "90m"
                    printTime = parseInt(timeMatch[3]);
                } else if (timeMatch[4] && timeMatch[5]) {
                    // Formato "1:30"
                    printTime = parseInt(timeMatch[4]) * 60 + parseInt(timeMatch[5]);
                }
                console.log('✅ Tiempo encontrado:', printTime, 'minutos');
            }
            
        } catch (error) {
            console.error('Error al parsear elementos:', error);
        }
        
        return { weight, printTime, volume: 0, bounds: {} };
    },

    promptManualInput() {
        console.log('📝 Solicitando entrada manual de datos...');
        
        const weight = prompt('No se pudieron extraer los datos automáticamente.\n\n¿Cuántos gramos de filamento usa? (mira en Kiri:Moto)');
        const time = prompt('¿Cuántos MINUTOS tarda la impresión? (mira en Kiri:Moto)');
        
        if (weight && time) {
            const extractedData = {
                weight: parseFloat(weight),
                printTime: parseFloat(time),
                volume: 0,
                bounds: {}
            };
            
            this.state.modelData = extractedData;
            this.updateFormWithData(extractedData);
            this.closeKiriView();
            this.updateStatus('✅ Datos ingresados manualmente', 'success');
        } else {
            this.closeKiriView();
            this.updateStatus('⚠️ No se ingresaron datos', 'warning');
        }
    },

    // ============================================
    // ACTUALIZACIÓN DE FORMULARIO
    // ============================================

    updateFormWithData(modelInfo) {
        // Actualizar peso de la pieza
        const pesoPieza = document.getElementById('pesoPieza');
        if (pesoPieza && modelInfo.weight) {
            pesoPieza.value = Math.round(modelInfo.weight * 10) / 10;
            pesoPieza.dispatchEvent(new Event('input')); // Trigger recálculo
        }

        // Actualizar tiempo de impresión
        const tiempoImpresion = document.getElementById('tiempoImpresion');
        if (tiempoImpresion && modelInfo.printTime) {
            tiempoImpresion.value = Math.round(modelInfo.printTime);
            tiempoImpresion.dispatchEvent(new Event('input'));
        }

        // Validar límites de construcción
        this.validateBuildVolume(modelInfo.bounds);

        // Auto-calcular precio
        if (typeof calcularPrecio === 'function') {
            calcularPrecio();
        }
    },

    validateBuildVolume(bounds) {
        if (!bounds) return;

        const { x, y, z } = this.config.buildVolume;
        const oversized = {
            x: bounds.x > x,
            y: bounds.y > y,
            z: bounds.z > z
        };

        if (oversized.x || oversized.y || oversized.z) {
            const mensaje = `⚠️ ADVERTENCIA: El modelo excede el área de impresión:\n` +
                `${oversized.x ? `• Ancho: ${bounds.x}mm > ${x}mm\n` : ''}` +
                `${oversized.y ? `• Profundidad: ${bounds.y}mm > ${y}mm\n` : ''}` +
                `${oversized.z ? `• Altura: ${bounds.z}mm > ${z}mm\n` : ''}` +
                `\nConsidera escalar el modelo.`;
            
            alert(mensaje);
            this.updateStatus('⚠️ Modelo muy grande', 'warning');
        }
    },

    // ============================================
    // UTILIDADES
    // ============================================

    getSliceSettings() {
        return {
            process: 'FDM',
            device: 'generic',
            quality: 'standard',
            infill: 20,
            shells: 3,
            top: 3,
            bottom: 3
        };
    },

    readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsArrayBuffer(file);
        });
    },

    updateStatus(message, type = 'info') {
        const statusEl = document.getElementById('fileStatus');
        if (!statusEl) return;

        statusEl.textContent = message;
        statusEl.className = `file-status status-${type}`;

        if (type === 'success' || type === 'error') {
            setTimeout(() => {
                statusEl.textContent = '';
                statusEl.className = 'file-status';
            }, 5000);
        }
    },

    toggleKiriView() {
        const container = document.getElementById('kiriContainer');
        if (container) {
            container.classList.toggle('active');
        }
    },

    closeKiriView() {
        const container = document.getElementById('kiriContainer');
        if (container) {
            container.classList.remove('active');
        }
    }
};

// ============================================
// AUTO-INICIALIZACIÓN
// ============================================

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        KiriMotoIntegration.init();
    });
} else {
    KiriMotoIntegration.init();
}