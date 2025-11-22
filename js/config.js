// ============================================
// CONFIG.JS - Cliente API para Sistema de Gestión 3D
// ============================================

// Configuración de la API
const API_CONFIG = {
    baseURL: '/gestion3d/api',
    endpoints: {
        perfiles: 'api_perfiles.php',
        inventario: 'api_inventario.php',
        cotizaciones: 'api_cotizaciones.php'
    }
};

// ============================================
// CLASE CLIENTE API
// ============================================

class APIClient {
    
    constructor(baseURL) {
        this.baseURL = baseURL;
    }
    
    /**
     * Realiza una petición GET
     */
    async get(endpoint, params = {}) {
        const url = new URL(`${window.location.origin}${this.baseURL}/${endpoint}`);
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message || 'Error en la petición');
            }
            
            return data.data;
        } catch (error) {
            console.error('Error en GET:', error);
            throw error;
        }
    }
    
    /**
     * Realiza una petición POST
     */
    async post(endpoint, params = {}, body = {}) {
        const url = new URL(`${window.location.origin}${this.baseURL}/${endpoint}`);
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message || 'Error en la petición');
            }
            
            return data.data;
        } catch (error) {
            console.error('Error en POST:', error);
            throw error;
        }
    }
    
    /**
     * Realiza una petición PUT
     */
    async put(endpoint, params = {}, body = {}) {
        const url = new URL(`${window.location.origin}${this.baseURL}/${endpoint}`);
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
        
        try {
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message || 'Error en la petición');
            }
            
            return data.data;
        } catch (error) {
            console.error('Error en PUT:', error);
            throw error;
        }
    }
    
    /**
     * Realiza una petición DELETE
     */
    async delete(endpoint, params = {}, body = {}) {
        const url = new URL(`${window.location.origin}${this.baseURL}/${endpoint}`);
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
        
        try {
            const response = await fetch(url, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message || 'Error en la petición');
            }
            
            return data.data;
        } catch (error) {
            console.error('Error en DELETE:', error);
            throw error;
        }
    }
}

// Instancia global del cliente API
const apiClient = new APIClient(API_CONFIG.baseURL);

console.log('✅ API Client inicializado');