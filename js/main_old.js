// ============================================
// MAIN.JS - SISTEMA CENTRAL DE GESTIÓN 3D
// ============================================

// ============================================
// 1. ESTRUCTURA DE DATOS Y ESTADO GLOBAL
// ============================================

const SistemaGestion3D = {
    version: "5.0",
    
    // Estado global de la aplicación
    estado: {
        perfilesFilamento: [],
        inventarioCarretes: [],
        historialCotizaciones: [],
        historialUso: [],
        perfilesProyecto: [],
        configuracionActual: null
    },

    // Configuración por defecto
    configDefecto: {
        factorSeguridad: 1.1,
        usoElectricidad: 600,
        gif: 15,
        aiu: 25,
        margenMinorista: 30,
        margenMayorista: 20,
        costoHoraDiseno: 25000,
        depreciacionMaquina: {
            costoInicial: 1400000,
            valorResidual: 0.1,
            vidaUtil: 3, // años
            horasMensuales: 210
        }
    },

    // Método para inicializar el sistema
    inicializar() {
        this.cargarDatosLocales();
        this.inicializarEventListeners();
        console.log("Sistema de Gestión 3D inicializado");
    },

    // Guardar todos los datos
    guardarDatosLocales() {
        const datos = {
            version: this.version,
            timestamp: new Date().toISOString(),
            perfilesFilamento: this.estado.perfilesFilamento,
            inventarioCarretes: this.estado.inventarioCarretes,
            historialCotizaciones: this.estado.historialCotizaciones,
            historialUso: this.estado.historialUso,
            perfilesProyecto: this.estado.perfilesProyecto,
            configuracionActual: this.estado.configuracionActual
        };

        localStorage.setItem('sistemaGestion3D', JSON.stringify(datos));
        console.log("Datos guardados localmente");
    },

    // Cargar datos guardados
    cargarDatosLocales() {
        const datosGuardados = localStorage.getItem('sistemaGestion3D');
        if (datosGuardados) {
            try {
                const datos = JSON.parse(datosGuardados);
                this.estado.perfilesFilamento = datos.perfilesFilamento || [];
                this.estado.inventarioCarretes = datos.inventarioCarretes || [];
                this.estado.historialCotizaciones = datos.historialCotizaciones || [];
                this.estado.historialUso = datos.historialUso || [];
                this.estado.perfilesProyecto = datos.perfilesProyecto || [];
                this.estado.configuracionActual = datos.configuracionActual;
                console.log("Datos cargados desde localStorage");
            } catch (error) {
                console.error("Error al cargar datos:", error);
            }
        }
    },

    // Inicializar event listeners globales
    inicializarEventListeners() {
        // Guardar automáticamente cada 30 segundos
        setInterval(() => {
            this.guardarDatosLocales();
        }, 30000);

        // Guardar antes de cerrar la ventana
        window.addEventListener('beforeunload', () => {
            this.guardarDatosLocales();
        });
    }
};

// ============================================
// 2. GESTIÓN DE PERFILES DE FILAMENTO
// ============================================

const GestionFilamentos = {
    // Crear perfil de filamento
    crearPerfil(datos) {
        const perfil = {
            id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
            tipo: datos.tipo,
            marca: datos.marca,
            colorNombre: datos.colorNombre,
            colorCodigo: datos.colorCodigo,
            peso: parseFloat(datos.peso),
            costo: parseFloat(datos.costo),
            temperatura: datos.temperatura ? parseInt(datos.temperatura) : null,
            calidad: parseInt(datos.calidad) || 0,
            calidadNota: datos.calidadNota || '',
            fechaCompra: datos.fechaCompra || new Date().toISOString().split('T')[0],
            fechaCreacion: new Date().toISOString(),
            // Calcular costo por gramo
            costoPorGramo: parseFloat(datos.costo) / (parseFloat(datos.peso) * 1000)
        };

        SistemaGestion3D.estado.perfilesFilamento.push(perfil);
        SistemaGestion3D.guardarDatosLocales();
        
        // Crear automáticamente un carrete en el inventario
        GestionInventario.crearCarrete(perfil.id);
        
        return perfil;
    },

    // Actualizar perfil
    actualizarPerfil(id, datos) {
        const index = SistemaGestion3D.estado.perfilesFilamento.findIndex(p => p.id === id);
        if (index !== -1) {
            SistemaGestion3D.estado.perfilesFilamento[index] = {
                ...SistemaGestion3D.estado.perfilesFilamento[index],
                ...datos,
                costoPorGramo: parseFloat(datos.costo) / (parseFloat(datos.peso) * 1000)
            };
            SistemaGestion3D.guardarDatosLocales();
            return true;
        }
        return false;
    },

    // Eliminar perfil
    eliminarPerfil(id) {
        const index = SistemaGestion3D.estado.perfilesFilamento.findIndex(p => p.id === id);
        if (index !== -1) {
            // Eliminar también los carretes asociados
            SistemaGestion3D.estado.inventarioCarretes = 
                SistemaGestion3D.estado.inventarioCarretes.filter(c => c.perfilId !== id);
            
            SistemaGestion3D.estado.perfilesFilamento.splice(index, 1);
            SistemaGestion3D.guardarDatosLocales();
            return true;
        }
        return false;
    },

    // Obtener perfil por ID
    obtenerPerfil(id) {
        return SistemaGestion3D.estado.perfilesFilamento.find(p => p.id === id);
    },

    // Listar todos los perfiles
    listarPerfiles() {
        return SistemaGestion3D.estado.perfilesFilamento;
    }
};

// ============================================
// 3. GESTIÓN DE INVENTARIO DE CARRETES
// ============================================

const GestionInventario = {
    // Crear carrete en inventario
    crearCarrete(perfilId, pesoInicial = null) {
        const perfil = GestionFilamentos.obtenerPerfil(perfilId);
        if (!perfil) return null;

        const carrete = {
            id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
            perfilId: perfilId,
            pesoInicial: pesoInicial || (perfil.peso * 1000), // en gramos
            pesoUsado: 0,
            fechaCreacion: new Date().toISOString(),
            estado: 'activo' // activo, agotado, pausado
        };

        SistemaGestion3D.estado.inventarioCarretes.push(carrete);
        SistemaGestion3D.guardarDatosLocales();
        return carrete;
    },

    // Registrar uso de filamento
    registrarUso(carreteId, gramosUsados, nombreProyecto = '') {
        const carrete = SistemaGestion3D.estado.inventarioCarretes.find(c => c.id === carreteId);
        if (!carrete) return false;

        const pesoRestante = carrete.pesoInicial - carrete.pesoUsado;
        if (gramosUsados > pesoRestante) {
            console.error("No hay suficiente filamento en el carrete");
            return false;
        }

        carrete.pesoUsado += gramosUsados;

        // Registrar en historial
        const registro = {
            id: Date.now().toString(),
            carreteId: carreteId,
            perfilId: carrete.perfilId,
            gramosUsados: gramosUsados,
            pesoRestanteAnterior: pesoRestante,
            pesoRestanteActual: pesoRestante - gramosUsados,
            nombreProyecto: nombreProyecto,
            fechaHora: new Date().toISOString(),
            fechaHoraFormateada: new Date().toLocaleString('es-CO')
        };

        SistemaGestion3D.estado.historialUso.unshift(registro);
        SistemaGestion3D.guardarDatosLocales();
        
        return true;
    },

    // Obtener carretes disponibles para un tipo de filamento
    obtenerCarretesDisponibles(tipoFilamento = null) {
        let carretes = SistemaGestion3D.estado.inventarioCarretes.filter(c => c.estado === 'activo');
        
        if (tipoFilamento) {
            carretes = carretes.filter(c => {
                const perfil = GestionFilamentos.obtenerPerfil(c.perfilId);
                return perfil && perfil.tipo === tipoFilamento;
            });
        }

        return carretes.map(c => {
            const perfil = GestionFilamentos.obtenerPerfil(c.perfilId);
            const pesoRestante = c.pesoInicial - c.pesoUsado;
            return {
                ...c,
                perfil: perfil,
                pesoRestante: pesoRestante,
                porcentajeRestante: (pesoRestante / c.pesoInicial) * 100
            };
        });
    },

    // Obtener estadísticas del inventario
    obtenerEstadisticas() {
        const carretes = SistemaGestion3D.estado.inventarioCarretes;
        const carretesActivos = carretes.filter(c => c.estado === 'activo');
        
        let pesoTotalInicial = 0;
        let pesoTotalUsado = 0;
        
        carretes.forEach(c => {
            pesoTotalInicial += c.pesoInicial;
            pesoTotalUsado += c.pesoUsado;
        });

        return {
            totalCarretes: carretes.length,
            carretesActivos: carretesActivos.length,
            pesoTotalInicial,
            pesoTotalUsado,
            pesoTotalRestante: pesoTotalInicial - pesoTotalUsado,
            porcentajeUsadoGlobal: pesoTotalInicial > 0 ? 
                ((pesoTotalUsado / pesoTotalInicial) * 100).toFixed(1) : 0
        };
    }
};

// ============================================
// 4. GESTIÓN DE COTIZACIONES
// ============================================

const GestionCotizaciones = {
    // Crear cotización
    crearCotizacion(datos) {
        const cotizacion = {
            id: Date.now().toString(),
            nombrePieza: datos.nombrePieza,
            
            // Datos del perfil de filamento seleccionado
            perfilFilamentoId: datos.perfilFilamentoId || null,
            carreteId: datos.carreteId || null,
            
            // Parámetros de la pieza
            pesoPieza: parseFloat(datos.pesoPieza),
            tiempoImpresion: parseFloat(datos.tiempoImpresion),
            cantidadPiezas: parseInt(datos.cantidadPiezas) || 1,
            piezasPorLote: parseInt(datos.piezasPorLote) || 1,
            
            // Costos
            costoCarrete: parseFloat(datos.costoCarrete),
            pesoCarrete: parseFloat(datos.pesoCarrete),
            horasDiseno: parseFloat(datos.horasDiseno) || 0,
            costoHoraDiseno: parseFloat(datos.costoHoraDiseno),
            
            // Parámetros adicionales
            factorSeguridad: parseFloat(datos.factorSeguridad),
            usoElectricidad: parseFloat(datos.usoElectricidad),
            gif: parseFloat(datos.gif),
            aiu: parseFloat(datos.aiu),
            incluirMarcaAgua: datos.incluirMarcaAgua || false,
            porcentajeMarcaAgua: parseFloat(datos.porcentajeMarcaAgua) || 0,
            margenMinorista: parseFloat(datos.margenMinorista),
            margenMayorista: parseFloat(datos.margenMayorista),
            
            // Fecha de creación
            fecha: new Date().toISOString().split('T')[0],
            fechaCompleta: new Date().toISOString()
        };

        // Calcular precios
        const calculos = this.calcularPrecios(cotizacion);
        cotizacion.calculos = calculos;

        SistemaGestion3D.estado.historialCotizaciones.push(cotizacion);
        SistemaGestion3D.guardarDatosLocales();

        return cotizacion;
    },

    // Calcular precios de una cotización
    calcularPrecios(datos) {
        // Costo unitario del filamento
        const costoUnitario = datos.costoCarrete / (datos.pesoCarrete * 1000);

        // Costos por unidad
        const costoFabricacion = datos.factorSeguridad * costoUnitario * datos.pesoPieza;
        const costoEnergia = datos.factorSeguridad * datos.usoElectricidad * (datos.tiempoImpresion / 60);
        const costoDiseno = (datos.costoHoraDiseno * datos.horasDiseno) / datos.cantidadPiezas;
        
        // Depreciación de máquina
        const config = SistemaGestion3D.configDefecto.depreciacionMaquina;
        const depreciacionMaquina = (config.costoInicial * (1 - config.valorResidual) / 
            (config.vidaUtil * 12 * config.horasMensuales)) * (datos.pesoPieza);

        // Subtotal
        const subtotal = costoFabricacion + costoEnergia + costoDiseno + depreciacionMaquina;

        // GIF y AIU
        const costoGIF = subtotal * (datos.gif / 100);
        const costoAIU = (subtotal + costoGIF) * (datos.aiu / 100);

        // Marca de agua
        const costoMarcaAgua = datos.incluirMarcaAgua ? 
            (subtotal + costoGIF + costoAIU) * (datos.porcentajeMarcaAgua / 100) : 0;

        // Precio final por unidad
        const precioFinal = (subtotal + costoGIF + costoAIU + costoMarcaAgua) / datos.piezasPorLote;

        // Precios por canal
        const precioMinorista = precioFinal * (1 + datos.margenMinorista / 100);
        const precioMayorista = precioFinal * (1 + datos.margenMayorista / 100);

        // Cálculos de lotes
        const numeroLotes = Math.ceil(datos.cantidadPiezas / datos.piezasPorLote);
        const costoPorLote = precioFinal * datos.piezasPorLote;
        const costoTotalPedido = precioFinal * datos.cantidadPiezas;
        const tiempoTotalMinutos = numeroLotes * datos.tiempoImpresion;
        const tiempoTotalHoras = (tiempoTotalMinutos / 60).toFixed(1);

        // Totales
        const filamentoTotalGramos = (datos.pesoPieza / datos.piezasPorLote) * datos.cantidadPiezas;
        const costoElectricoTotal = datos.usoElectricidad * (tiempoTotalMinutos / 60);

        return {
            // Por unidad
            costoFabricacion,
            costoEnergia,
            costoDiseno,
            depreciacionMaquina,
            subtotal,
            costoGIF,
            costoAIU,
            costoMarcaAgua,
            precioFinal,
            
            // Precios por canal
            precioMinorista,
            precioMayorista,
            
            // Lotes
            numeroLotes,
            costoPorLote,
            costoTotalPedido,
            tiempoTotalMinutos,
            tiempoTotalHoras,
            filamentoTotalGramos,
            costoElectricoTotal,
            
            // Totales por canal
            costoTotalPedidoMinorista: costoTotalPedido * (1 + datos.margenMinorista / 100),
            costoTotalPedidoMayorista: costoTotalPedido * (1 + datos.margenMayorista / 100)
        };
    },

    // Cotizar y descontar del inventario
    cotizarYDescontar(datos, descontarInventario = false) {
        const cotizacion = this.crearCotizacion(datos);
        
        if (descontarInventario && datos.carreteId) {
            const filamentoUsado = cotizacion.calculos.filamentoTotalGramos;
            GestionInventario.registrarUso(
                datos.carreteId, 
                filamentoUsado, 
                datos.nombrePieza
            );
        }

        return cotizacion;
    }
};

// ============================================
// 5. GESTIÓN DE PERFILES DE PROYECTO
// ============================================

const GestionPerfiles = {
    // Crear perfil de proyecto
    crearPerfil(nombre, descripcion = '', datos = {}) {
        const perfil = {
            id: Date.now().toString(),
            nombre: nombre,
            descripcion: descripcion,
            
            // Configuración del perfil
            configuracion: {
                factorSeguridad: datos.factorSeguridad || SistemaGestion3D.configDefecto.factorSeguridad,
                usoElectricidad: datos.usoElectricidad || SistemaGestion3D.configDefecto.usoElectricidad,
                gif: datos.gif || SistemaGestion3D.configDefecto.gif,
                aiu: datos.aiu || SistemaGestion3D.configDefecto.aiu,
                margenMinorista: datos.margenMinorista || SistemaGestion3D.configDefecto.margenMinorista,
                margenMayorista: datos.margenMayorista || SistemaGestion3D.configDefecto.margenMayorista,
                costoHoraDiseno: datos.costoHoraDiseno || SistemaGestion3D.configDefecto.costoHoraDiseno,
                incluirMarcaAgua: datos.incluirMarcaAgua || false,
                porcentajeMarcaAgua: datos.porcentajeMarcaAgua || 10
            },
            
            // Filamentos preferidos
            filamentosPreferidos: datos.filamentosPreferidos || [],
            
            // Metadata
            fechaCreacion: new Date().toISOString(),
            ultimaModificacion: new Date().toISOString(),
            vecesUsado: 0
        };

        SistemaGestion3D.estado.perfilesProyecto.push(perfil);
        SistemaGestion3D.guardarDatosLocales();
        return perfil;
    },

    // Cargar perfil
    cargarPerfil(id) {
        const perfil = SistemaGestion3D.estado.perfilesProyecto.find(p => p.id === id);
        if (perfil) {
            perfil.vecesUsado++;
            perfil.ultimaModificacion = new Date().toISOString();
            SistemaGestion3D.estado.configuracionActual = perfil;
            SistemaGestion3D.guardarDatosLocales();
            return perfil;
        }
        return null;
    },

    // Actualizar perfil
    actualizarPerfil(id, datos) {
        const index = SistemaGestion3D.estado.perfilesProyecto.findIndex(p => p.id === id);
        if (index !== -1) {
            SistemaGestion3D.estado.perfilesProyecto[index] = {
                ...SistemaGestion3D.estado.perfilesProyecto[index],
                ...datos,
                ultimaModificacion: new Date().toISOString()
            };
            SistemaGestion3D.guardarDatosLocales();
            return true;
        }
        return false;
    },

    // Eliminar perfil
    eliminarPerfil(id) {
        const index = SistemaGestion3D.estado.perfilesProyecto.findIndex(p => p.id === id);
        if (index !== -1) {
            SistemaGestion3D.estado.perfilesProyecto.splice(index, 1);
            SistemaGestion3D.guardarDatosLocales();
            return true;
        }
        return false;
    },

    // Listar perfiles
    listarPerfiles() {
        return SistemaGestion3D.estado.perfilesProyecto;
    }
};

// ============================================
// 6. EXPORTACIÓN E IMPORTACIÓN DE DATOS
// ============================================

const GestionArchivos = {
    // Exportar todo el sistema a JSON
    exportarSistemaCompleto() {
        const datos = {
            version: SistemaGestion3D.version,
            exportadoEn: new Date().toISOString(),
            perfilesFilamento: SistemaGestion3D.estado.perfilesFilamento,
            inventarioCarretes: SistemaGestion3D.estado.inventarioCarretes,
            historialCotizaciones: SistemaGestion3D.estado.historialCotizaciones,
            historialUso: SistemaGestion3D.estado.historialUso,
            perfilesProyecto: SistemaGestion3D.estado.perfilesProyecto
        };

        return JSON.stringify(datos, null, 2);
    },

    // Descargar sistema completo como archivo
    descargarSistemaCompleto() {
        const json = this.exportarSistemaCompleto();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `sistema_3d_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    },

    // Importar sistema completo
    importarSistemaCompleto(jsonString) {
        try {
            const datos = JSON.parse(jsonString);
            
            // Validar estructura básica
            if (!datos.version || !datos.perfilesFilamento) {
                throw new Error("Formato de archivo inválido");
            }

            // Confirmar antes de sobrescribir
            if (confirm("¿Deseas importar estos datos? Esto sobrescribirá tu información actual.")) {
                SistemaGestion3D.estado.perfilesFilamento = datos.perfilesFilamento || [];
                SistemaGestion3D.estado.inventarioCarretes = datos.inventarioCarretes || [];
                SistemaGestion3D.estado.historialCotizaciones = datos.historialCotizaciones || [];
                SistemaGestion3D.estado.historialUso = datos.historialUso || [];
                SistemaGestion3D.estado.perfilesProyecto = datos.perfilesProyecto || [];
                
                SistemaGestion3D.guardarDatosLocales();
                return true;
            }
            return false;
        } catch (error) {
            console.error("Error al importar datos:", error);
            return false;
        }
    },

    // Exportar perfil de proyecto
    exportarPerfil(perfilId) {
        const perfil = SistemaGestion3D.estado.perfilesProyecto.find(p => p.id === perfilId);
        if (!perfil) return null;

        const datos = {
            tipo: 'perfil_proyecto',
            version: SistemaGestion3D.version,
            perfil: perfil
        };

        return JSON.stringify(datos, null, 2);
    },

    // Importar perfil de proyecto
    importarPerfil(jsonString) {
        try {
            const datos = JSON.parse(jsonString);
            
            if (datos.tipo !== 'perfil_proyecto' || !datos.perfil) {
                throw new Error("No es un archivo de perfil válido");
            }

            // Generar nuevo ID
            datos.perfil.id = Date.now().toString();
            datos.perfil.fechaCreacion = new Date().toISOString();
            
            SistemaGestion3D.estado.perfilesProyecto.push(datos.perfil);
            SistemaGestion3D.guardarDatosLocales();
            
            return datos.perfil;
        } catch (error) {
            console.error("Error al importar perfil:", error);
            return null;
        }
    }
};

// ============================================
// 7. UTILIDADES
// ============================================

const Utilidades = {
    // Formatear moneda
    formatearMoneda(valor) {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        }).format(valor);
    },

    // Mostrar notificación
    mostrarNotificacion(mensaje, tipo = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${tipo}`;
        notification.textContent = mensaje;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('show');
        }, 100);

        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    },

    // Validar datos de formulario
    validarDatos(datos, camposRequeridos) {
        for (let campo of camposRequeridos) {
            if (!datos[campo] || datos[campo] === '') {
                return { valido: false, mensaje: `El campo ${campo} es requerido` };
            }
        }
        return { valido: true };
    }
};

// ============================================
// 8. INICIALIZACIÓN
// ============================================

// Inicializar cuando el DOM esté listo
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        SistemaGestion3D.inicializar();
    });
}

// Exportar para uso en otros archivos
if (typeof window !== 'undefined') {
    window.SistemaGestion3D = SistemaGestion3D;
    window.GestionFilamentos = GestionFilamentos;
    window.GestionInventario = GestionInventario;
    window.GestionCotizaciones = GestionCotizaciones;
    window.GestionPerfiles = GestionPerfiles;
    window.GestionArchivos = GestionArchivos;
    window.Utilidades = Utilidades;
}