// ============================================
// RESIZER.JS - Funcionalidad de Redimensionamiento de Paneles
// ============================================

(function() {
    'use strict';
    
    // Esperar a que el DOM esté listo
    document.addEventListener('DOMContentLoaded', function() {
        initializeResizer();
    });
    
    function initializeResizer() {
        const resizer = document.getElementById('resizer');
        const stepsColumn = document.querySelector('.steps-column');
        const resultsColumn = document.querySelector('.results-column');
        
        if (!resizer || !stepsColumn || !resultsColumn) {
            console.warn('⚠️ Elementos del resizer no encontrados');
            return;
        }
        
        let isResizing = false;
        let startX = 0;
        let startWidth = 0;
        
        // Obtener el ancho inicial de la columna de pasos
        function getInitialWidth() {
            const computed = window.getComputedStyle(stepsColumn);
            return parseInt(computed.getPropertyValue('flex-basis'), 10);
        }
        
        // Iniciar el redimensionamiento
        resizer.addEventListener('mousedown', function(e) {
            isResizing = true;
            startX = e.clientX;
            startWidth = getInitialWidth();
            
            // Agregar clase al body para cambiar el cursor globalmente
            document.body.classList.add('resizing');
            
            // Prevenir selección de texto durante el arrastre
            e.preventDefault();
            
            console.log('🔄 Iniciando resize desde:', startWidth + 'px');
        });
        
        // Durante el redimensionamiento
        document.addEventListener('mousemove', function(e) {
            if (!isResizing) return;
            
            const deltaX = e.clientX - startX;
            const newWidth = startWidth + deltaX;
            
            // Limitar el ancho mínimo y máximo
            const minWidth = 350;
            const maxWidth = 800;
            
            if (newWidth >= minWidth && newWidth <= maxWidth) {
                // Actualizar el ancho de la columna de pasos
                stepsColumn.style.flexBasis = newWidth + 'px';
                stepsColumn.style.minWidth = newWidth + 'px';
                stepsColumn.style.maxWidth = newWidth + 'px';
                
                // Guardar el tamaño en localStorage para persistencia
                try {
                    localStorage.setItem('stepsColumnWidth', newWidth);
                } catch (err) {
                    console.warn('No se pudo guardar el tamaño en localStorage:', err);
                }
            }
        });
        
        // Finalizar el redimensionamiento
        document.addEventListener('mouseup', function() {
            if (isResizing) {
                isResizing = false;
                document.body.classList.remove('resizing');
                
                const finalWidth = getInitialWidth();
                console.log('✅ Resize completado. Nuevo ancho:', finalWidth + 'px');
            }
        });
        
        // Cargar el tamaño guardado al iniciar
        function loadSavedWidth() {
            try {
                const savedWidth = localStorage.getItem('stepsColumnWidth');
                if (savedWidth) {
                    const width = parseInt(savedWidth, 10);
                    if (width >= 350 && width <= 800) {
                        stepsColumn.style.flexBasis = width + 'px';
                        stepsColumn.style.minWidth = width + 'px';
                        stepsColumn.style.maxWidth = width + 'px';
                        console.log('📏 Tamaño restaurado:', width + 'px');
                    }
                }
            } catch (err) {
                console.warn('No se pudo cargar el tamaño guardado:', err);
            }
        }
        
        // Restablecer tamaño por defecto (doble clic en el divisor)
        resizer.addEventListener('dblclick', function() {
            const defaultWidth = 500;
            stepsColumn.style.flexBasis = defaultWidth + 'px';
            stepsColumn.style.minWidth = defaultWidth + 'px';
            stepsColumn.style.maxWidth = defaultWidth + 'px';
            
            try {
                localStorage.removeItem('stepsColumnWidth');
            } catch (err) {
                console.warn('No se pudo eliminar el tamaño guardado:', err);
            }
            
            console.log('🔄 Tamaño restablecido a:', defaultWidth + 'px');
            
            // Feedback visual
            resizer.style.background = 'linear-gradient(to right, transparent, rgba(16, 185, 129, 0.3) 50%, transparent)';
            setTimeout(() => {
                resizer.style.background = '';
            }, 300);
        });
        
        // Cargar el tamaño guardado
        loadSavedWidth();
        
        console.log('✅ Resizer inicializado correctamente');
        console.log('💡 Tip: Arrastra el divisor para ajustar el tamaño');
        console.log('💡 Tip: Doble clic en el divisor para restablecer');
    }
    
})();