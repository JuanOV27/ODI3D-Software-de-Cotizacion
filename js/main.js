// ============================================
// MAIN.JS - SISTEMA CENTRAL DE GESTIÓN 3D (Versión API MySQL)
// ============================================

// ============================================
// 1. ESTRUCTURA DE DATOS Y ESTADO GLOBAL
// ============================================

const SistemaGestion3D = {
    version: "5.0-MySQL",
    
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
    async inicializar() {
        try {
            await this.cargarDatosDesdeAPI();
            console.log("✅ Sistema de Gestión 3D inicializado (MySQL)");
        } catch (error) {
            console.error("❌ Error al inicializar sistema:", error);
            // Fallback a localStorage si falla la API
            this.cargarDatosLocales();
        }
    },

    // NUEVO: Cargar datos desde la API
    async cargarDatosDesdeAPI() {
        try {
            // Cargar perfiles
            this.estado.perfilesFilamento = await GestionFilamentos.listarPerfiles();
            
            // Cargar inventario
            const inventario = await apiClient.get(
                API_CONFIG.endpoints.inventario,
                { action: 'list' }
            );
            this.estado.inventarioCarretes = inventario || [];
            
            // Cargar cotizaciones
            this.estado.historialCotizaciones = await GestionCotizaciones.obtenerHistorial();
            
            console.log("✅ Datos cargados desde MySQL");
            console.log(`   - Perfiles: ${this.estado.perfilesFilamento.length}`);
            console.log(`   - Carretes: ${this.estado.inventarioCarretes.length}`);
            console.log(`   - Cotizaciones: ${this.estado.historialCotizaciones.length}`);
            
        } catch (error) {
            console.error("❌ Error al cargar datos desde la API:", error);
            throw error;
        }
    },

    // Guardar datos locales (mantenido por compatibilidad pero ya no se usa)
    guardarDatosLocales() {
        // Los datos ahora se guardan automáticamente en la base de datos
        // Este método se mantiene por compatibilidad pero ya no es necesario
        console.log("ℹ️ Los datos se guardan automáticamente en MySQL");
    },

    // Cargar datos locales (fallback)
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
                console.log("⚠️ Datos cargados desde localStorage (fallback)");
            } catch (error) {
                console.error("Error al cargar datos de localStorage:", error);
            }
        }
    }
};

// ============================================
// 2. GESTIÓN DE PERFILES DE FILAMENTO (API)
// ============================================

const GestionFilamentos = {
    /**
     * Crear perfil de filamento
     */
    async crearPerfil(datos) {
        try {
            const perfil = await apiClient.post(
                API_CONFIG.endpoints.perfiles,
                { action: 'create' },
                datos
            );
            
            // Actualizar estado local
            SistemaGestion3D.estado.perfilesFilamento.push(perfil);
            
            console.log('✅ Perfil creado:', perfil.id);
            return perfil;
            
        } catch (error) {
            console.error('❌ Error al crear perfil:', error);
            throw error;
        }
    },

    /**
     * Actualizar perfil
     */
    async actualizarPerfil(id, datos) {
        try {
            const body = { ...datos, id };
            const perfil = await apiClient.put(
                API_CONFIG.endpoints.perfiles,
                { action: 'update' },
                body
            );
            
            // Actualizar estado local
            const index = SistemaGestion3D.estado.perfilesFilamento.findIndex(p => p.id === id);
            if (index !== -1) {
                SistemaGestion3D.estado.perfilesFilamento[index] = perfil;
            }
            
            console.log('✅ Perfil actualizado:', id);
            return perfil;
            
        } catch (error) {
            console.error('❌ Error al actualizar perfil:', error);
            throw error;
        }
    },

    /**
     * Eliminar perfil
     */
    async eliminarPerfil(id) {
        try {
            await apiClient.delete(
                API_CONFIG.endpoints.perfiles,
                { action: 'delete' },
                { id }
            );
            
            // Actualizar estado local
            SistemaGestion3D.estado.perfilesFilamento = 
                SistemaGestion3D.estado.perfilesFilamento.filter(p => p.id !== id);
            
            console.log('✅ Perfil eliminado:', id);
            return true;
            
        } catch (error) {
            console.error('❌ Error al eliminar perfil:', error);
            throw error;
        }
    },

    /**
     * Obtener perfil por ID
     */
    async obtenerPerfil(id) {
        try {
            // Buscar primero en el estado local
            let perfil = SistemaGestion3D.estado.perfilesFilamento.find(p => p.id === id);
            
            // Si no está, buscar en la API
            if (!perfil) {
                perfil = await apiClient.get(
                    API_CONFIG.endpoints.perfiles,
                    { action: 'get', id }
                );
            }
            
            return perfil;
            
        } catch (error) {
            console.error('❌ Error al obtener perfil:', error);
            return null;
        }
    },

    /**
     * Listar todos los perfiles
     */
    async listarPerfiles() {
        try {
            const perfiles = await apiClient.get(
                API_CONFIG.endpoints.perfiles,
                { action: 'list' }
            );
            
            // Actualizar estado local
            SistemaGestion3D.estado.perfilesFilamento = perfiles || [];
            
            return perfiles || [];
            
        } catch (error) {
            console.error('❌ Error al listar perfiles:', error);
            // Retornar del estado local si falla
            return SistemaGestion3D.estado.perfilesFilamento;
        }
    }
};

// ============================================
// 3. GESTIÓN DE INVENTARIO DE CARRETES (API)
// ============================================

const GestionInventario = {
    /**
     * Crear carrete en inventario
     */
    async crearCarrete(perfilId, pesoInicial = null) {
        try {
            const perfil = await GestionFilamentos.obtenerPerfil(perfilId);
            if (!perfil) {
                throw new Error('Perfil no encontrado');
            }

            const datos = {
                perfilId: perfilId,
                pesoInicial: pesoInicial || (perfil.peso * 1000),
                pesoUsado: 0,
                estado: 'activo'
            };
            
            const carrete = await apiClient.post(
                API_CONFIG.endpoints.inventario,
                { action: 'create' },
                datos
            );
            
            // Actualizar estado local
            SistemaGestion3D.estado.inventarioCarretes.push(carrete);
            
            console.log('✅ Carrete creado:', carrete.id);
            return carrete;
            
        } catch (error) {
            console.error('❌ Error al crear carrete:', error);
            return null;
        }
    },

    /**
     * Registrar uso de filamento
     */
    async registrarUso(carreteId, gramosUsados, nombreProyecto = '') {
        try {
            const datos = {
                carreteId: carreteId,
                gramosUsados: gramosUsados,
                nombreProyecto: nombreProyecto
            };
            
            const resultado = await apiClient.post(
                API_CONFIG.endpoints.inventario,
                { action: 'registrarUso' },
                datos
            );
            
            // Recargar inventario
            await this.actualizarInventarioLocal();
            
            console.log('✅ Uso registrado:', gramosUsados, 'g');
            return true;
            
        } catch (error) {
            console.error('❌ Error al registrar uso:', error);
            return false;
        }
    },

    /**
     * Obtener carretes disponibles
     */
    async obtenerCarretesDisponibles(tipoFilamento = null) {
        try {
            const carretes = await apiClient.get(
                API_CONFIG.endpoints.inventario,
                { action: 'disponibles' }
            );
            
            // Filtrar por tipo si se especifica
            if (tipoFilamento) {
                return carretes.filter(c => c.tipo === tipoFilamento);
            }
            
            return carretes;
            
        } catch (error) {
            console.error('❌ Error al obtener carretes:', error);
            return [];
        }
    },

    /**
     * Obtener estadísticas del inventario
     */
    async obtenerEstadisticas() {
        try {
            const stats = await apiClient.get(
                API_CONFIG.endpoints.inventario,
                { action: 'estadisticas' }
            );
            
            return stats;
            
        } catch (error) {
            console.error('❌ Error al obtener estadísticas:', error);
            return null;
        }
    },

    /**
     * Actualizar inventario local desde la API
     */
    async actualizarInventarioLocal() {
        try {
            const inventario = await apiClient.get(
                API_CONFIG.endpoints.inventario,
                { action: 'list' }
            );
            
            SistemaGestion3D.estado.inventarioCarretes = inventario || [];
            return inventario;
            
        } catch (error) {
            console.error('❌ Error al actualizar inventario local:', error);
            return [];
        }
    }
};

// ============================================
// 4. GESTIÓN DE COTIZACIONES (API)
// ============================================

const GestionCotizaciones = {
    /**
     * Crear cotización
     */
    async crearCotizacion(datos) {
        try {
            const cotizacion = await apiClient.post(
                API_CONFIG.endpoints.cotizaciones,
                { action: 'create' },
                datos
            );
            
            // Actualizar estado local
            SistemaGestion3D.estado.historialCotizaciones.unshift(cotizacion);
            
            console.log('✅ Cotización creada:', cotizacion.id);
            return cotizacion;
            
        } catch (error) {
            console.error('❌ Error al crear cotización:', error);
            throw error;
        }
    },

    /**
     * Obtener historial de cotizaciones
     */
    async obtenerHistorial() {
        try {
            const cotizaciones = await apiClient.get(
                API_CONFIG.endpoints.cotizaciones,
                { action: 'list' }
            );
            
            // Actualizar estado local
            SistemaGestion3D.estado.historialCotizaciones = cotizaciones || [];
            
            return cotizaciones || [];
            
        } catch (error) {
            console.error('❌ Error al obtener historial:', error);
            return SistemaGestion3D.estado.historialCotizaciones;
        }
    },

    /**
     * Eliminar cotización
     */
    async eliminarCotizacion(id) {
        try {
            await apiClient.delete(
                API_CONFIG.endpoints.cotizaciones,
                { action: 'delete' },
                { id }
            );
            
            // Actualizar estado local
            SistemaGestion3D.estado.historialCotizaciones = 
                SistemaGestion3D.estado.historialCotizaciones.filter(c => c.id !== id);
            
            console.log('✅ Cotización eliminada:', id);
            return true;
            
        } catch (error) {
            console.error('❌ Error al eliminar cotización:', error);
            return false;
        }
    },

    // Los cálculos siguen siendo locales (por ahora)
    calcularPrecios(datos) {
        // Esta función se mantiene igual que antes
        // Los cálculos se hacen en el servidor al crear la cotización
        // pero mantenemos esta función por compatibilidad
        return {};
    }
};

// ============================================
// 5. UTILIDADES (Sin cambios)
// ============================================

const Utilidades = {
    mostrarNotificacion(mensaje, tipo = 'info') {
        console.log(`${tipo.toUpperCase()}: ${mensaje}`);
        // Aquí puedes agregar tu lógica de notificaciones visuales
        alert(mensaje);
    },

    validarDatos(datos, camposRequeridos) {
        for (const campo of camposRequeridos) {
            if (!datos[campo] || datos[campo] === '') {
                return {
                    valido: false,
                    mensaje: `El campo "${campo}" es requerido`
                };
            }
        }
        return { valido: true };
    },

    formatearMoneda(valor) {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        }).format(valor);
    },

    formatearFecha(fecha) {
        return new Date(fecha).toLocaleDateString('es-CO');
    }
};

// ============================================
// INICIALIZACIÓN
// ============================================

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        await SistemaGestion3D.inicializar();
    });
} else {
    // DOM ya está listo
    SistemaGestion3D.inicializar();
}

console.log('📦 main.js cargado (Versión MySQL)');