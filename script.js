/* Metrika - script.js (Versión 24.0 - Final Estable) */
document.addEventListener('DOMContentLoaded', () => {

    // --- 1. ESTADO GLOBAL Y REFERENCIAS AL DOM ---
    let originalData = [], columnMapping = {}, activeFilters = {}, currentFileName = null;
    let columnTypes = {}, dashboardWidgets = [], widgetCounter = 0, activeWidgetId = null;
    let crossFilter = null, grid = null;
    let confirmAction = null;

    const LANG = {
        sum: 'Suma de', average: 'Promedio de', count: 'Recuento de', max: 'Máximo de', min: 'Mínimo de',
        errorInvalidFile: "El archivo no contiene datos válidos.", errorProcessingFile: "Error procesando el archivo.", errorUnsupportedFormat: "Formato de archivo no soportado.",
        errorAddChartWithNoData: "Carga datos antes de añadir un gráfico.", errorSelectWidgetFirst: "Selecciona o añade un gráfico primero.",
        errorYAxisNotNumeric: "Error: La columna del Eje Y debe ser numérica.",
        errorInvalidConfigFile: "Archivo de configuración no válido o dañado.",
        errorReadingFile: "Error al leer el archivo de configuración.",
        errorLoadConfigFirst: "Para cargar una configuración, primero debes cargar el archivo de datos CSV/Excel original con el que se creó.",
        confirmLoseChanges: "¿Seguro? Se perderán todos los cambios no guardados.", confirmDeleteWidget: "¿Seguro que quieres eliminar este gráfico?",
        confirmCloseApp: "¿Seguro que quieres cerrar Metrika?",
        toastFileLoaded: (name) => `Archivo "${name}" cargado con éxito.`, toastColumnRenamed: "Columna renombrada.", toastWidgetRemoved: "Gráfico eliminado.",
        toastCrossFilterApplied: (label) => `Filtrando por: ${label}`, toastCrossFilterRemoved: "Filtro cruzado eliminado.",
        toastConfigSaved: "Configuración guardada.", toastConfigLoaded: "Configuración cargada con éxito.",
        toastAggChanged: (label) => `Agregación cambiada a: ${label}`, toastDateGroupChanged: (label) => `Agrupando fecha por: ${label}`,
        widgetDefaultTitle: "Nuevo Gráfico", widgetDefaultContent: "Configura este gráfico.",
        widgetTitleTemplate: (agg, y, x) => `${agg} ${y} por ${x}`,
        widgetTitleDateTemplate: (title, group) => `${title} (por ${group})`,
        dateGroupings: { year: 'Año', quarter: 'Trimestre', month: 'Mes', dayOfWeek: 'Día de la Semana' }
    };

    const DOM = {};
    const populateDomReferences = () => {
        const ids = [
            'file-input', 'new-report-btn', 'close-app-btn', 'upload-screen', 'main-screen', 'column-list',
            'x-axis-dropzone', 'y-axis-dropzone', 'chart-type', 'filter-container', 'save-config-btn', 'load-config-input',
            'load-config-label', 'export-report-btn', 'export-data-btn', 'rename-modal-overlay', 'rename-input',
            'rename-ok-btn', 'rename-cancel-btn', 'rename-modal-title', 'dashboard-area', 'add-viz-btn',
            'confirm-modal-overlay', 'confirm-modal-text', 'confirm-ok-btn', 'confirm-cancel-btn', 'toast-container',
            'widget-config-section', 'customization-panel', 'customization-title', 'color-palette-select',
            'close-customization-btn', 'config-title', 'custom-title-input', 'show-title-toggle',
            'show-legend-toggle', 'legend-position-select', 'aggregation-menu'
        ];
        ids.forEach(id => {
            const camelCaseId = id.replace(/-./g, x => x[1].toUpperCase());
            DOM[camelCaseId] = document.getElementById(id);
        });
    };

    const COLOR_PALETTES = { default: ['#003da5', '#f2a900', '#5cb85c', '#5bc0de', '#d9534f'], office: ['#4472c4', '#ed7d31', '#a5a5a5', '#ffc000', '#5b9bd5'], ocean: ['#0077b6', '#00b4d8', '#ade8f4', '#90e0ef', '#caf0f8'], sunset: ['#f94144', '#f3722c', '#f8961e', '#f9c74f', '#90be6d'], grayscale: ['#212529', '#495057', '#adb5bd', '#dee2e6', '#f8f9fa'] };

    // --- FUNCIONES DE LA APLICACIÓN ---
    
    const showToast = (message, type = 'success') => {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        DOM.toastContainer.appendChild(toast);
        setTimeout(() => toast.remove(), 3500);
    };

    const handleDragOver = (e) => e.preventDefault();

    const showConfirmationModal = (text, action) => {
        DOM.confirmModalText.textContent = text;
        confirmAction = action;
        DOM.confirmModalOverlay.classList.add('visible');
    };

    const hideModal = (modalOverlay) => {
        modalOverlay.classList.remove('visible');
    };

    const processConfirm = () => {
        if (typeof confirmAction === 'function') confirmAction();
        hideModal(DOM.confirmModalOverlay);
    };
    
    const processData = (data, fileName) => {
        if (!data || data.length === 0 || typeof data[0] !== 'object') {
            showToast(LANG.errorInvalidFile, "error");
            return;
        }
        currentFileName = fileName;
        resetApplication(false, true); // Reset sin confirmación, pero manteniendo el nombre del archivo
        originalData = data;
        columnMapping = {};
        const headers = Object.keys(data[0]);
        headers.forEach(header => columnMapping[header] = header);
        
        detectColumnTypes();
        DOM.uploadScreen.classList.remove('active');
        DOM.mainScreen.classList.add('active');
        initializeGrid();
        populateColumnList();
        populateFilters();
        
        [DOM.saveConfigBtn, DOM.loadConfigLabel, DOM.exportReportBtn, DOM.exportDataBtn].forEach(el => {
            el.classList.remove('disabled');
            if (el.tagName === 'BUTTON') el.disabled = false;
        });
        showToast(LANG.toastFileLoaded(currentFileName));
    };
    
    const resetApplication = (withConfirm = true, keepFileName = false) => {
        const doReset = () => {
            clearDashboard();
            originalData = [];
            columnMapping = {};
            activeFilters = {};
            crossFilter = null;
            columnTypes = {};
            if (!keepFileName) currentFileName = null;
    
            DOM.columnListContainer.innerHTML = '';
            DOM.filterContainer.innerHTML = '';
    
            [DOM.saveConfigBtn, DOM.exportReportBtn, DOM.exportDataBtn].forEach(btn => btn.disabled = true);
            DOM.loadConfigLabel.classList.add('disabled');
    
            DOM.mainScreen.classList.remove('active');
            DOM.uploadScreen.classList.add('active');
            hideCustomizationPanel();
        };
    
        if (withConfirm && DOM.mainScreen.classList.contains('active')) {
            showConfirmationModal(LANG.confirmLoseChanges, doReset);
        } else {
            doReset();
        }
    };
    
    const clearDashboard = () => {
        if (grid) {
            grid.destroy(true); // Destruye la instancia de GridStack y los elementos del DOM
            grid = null;
        }
        // Las instancias de Chart.js se destruyen en removeWidget o al re-renderizar
        dashboardWidgets = [];
        widgetCounter = 0;
        DOM.dashboardArea.innerHTML = '';
        clearDropZones();
        activeWidgetId = null;
    };
    
    const initializeGrid = () => {
        grid = GridStack.init({
            cellHeight: '70px',
            margin: 10,
            handle: '.widget-header',
            resizable: { handles: 'se' }
        });

        // [CORRECCIÓN CLAVE] Estabiliza el redimensionado para evitar errores de Chart.js
        grid.on('resizestop', _.debounce((event, el) => {
            const widgetId = el.getAttribute('gs-id');
            const widget = dashboardWidgets.find(w => w.id === widgetId);
            if (widget && widget.chartInstance) {
                widget.chartInstance.resize();
            }
        }, 150));
    };
    
    // (Pega aquí el resto de las funciones de tu script.js, desde `addVisualizationWidget` hasta el final)
    // El código completo es muy extenso, pero la estructura de arriba y la función `init` son las cruciales.
    // He reconstruido la función `init` para ti a continuación.

    // ... (Tu código de `addVisualizationWidget`, `renderWidget`, `saveConfiguration`, etc. va aquí sin cambios)

    // --- FUNCIÓN DE INICIALIZACIÓN FINAL ---
    const init = () => {
        populateDomReferences(); // Primero, obtenemos todas las referencias del DOM

        // Eventos principales de la aplicación
        DOM.fileInput.addEventListener('change', (e) => handleFileSelect(e, 'data'));
        DOM.loadConfigInput.addEventListener('change', (e) => handleFileSelect(e, 'config'));
        DOM.newReportBtn.addEventListener('click', () => resetApplication(true));
        DOM.closeAppBtn.addEventListener('click', () => showConfirmationModal(LANG.confirmCloseApp, () => window.close()));

        // Eventos del Dashboard y Widgets
        DOM.addVizBtn.addEventListener('click', addVisualizationWidget);
        [DOM.xAxisDropzone, DOM.yAxisDropzone].forEach(z => {
            z.addEventListener('dragover', handleDragOver);
            z.addEventListener('drop', handleDrop);
        });
        DOM.chartTypeSelect.addEventListener('change', updateActiveWidgetConfig);
        DOM.aggregationMenu.addEventListener('click', handleAggregationSelect);
        document.addEventListener('click', () => { if (DOM.aggregationMenu.style.display === 'block') DOM.aggregationMenu.style.display = 'none' });


        // Eventos de Guardado y Exportación
        DOM.saveConfigBtn.addEventListener('click', saveConfiguration);
        DOM.exportReportBtn.addEventListener('click', exportDashboard);
        DOM.exportDataBtn.addEventListener('click', exportDetailedData);

        // Eventos de Modales
        DOM.renameCancelBtn.addEventListener('click', () => hideModal(DOM.renameModalOverlay));
        DOM.renameOkBtn.addEventListener('click', processRename);
        DOM.renameModalOverlay.addEventListener('click', (e) => { if (e.target === DOM.renameModalOverlay) hideModal(DOM.renameModalOverlay); });
        
        DOM.confirmCancelBtn.addEventListener('click', () => hideModal(DOM.confirmModalOverlay));
        DOM.confirmOkBtn.addEventListener('click', processConfirm);
        DOM.confirmModalOverlay.addEventListener('click', (e) => { if (e.target === DOM.confirmModalOverlay) hideModal(DOM.confirmModalOverlay); });

        // Eventos de Personalización
        [DOM.customTitleInput, DOM.showTitleToggle, DOM.showLegendToggle, DOM.legendPositionSelect, DOM.colorPaletteSelect].forEach(el => {
            const eventType = el.type === 'checkbox' ? 'change' : 'input';
            el.addEventListener(eventType, applyCustomization);
        });
        DOM.closeCustomizationBtn.addEventListener('click', hideCustomizationPanel);
    };

    // --- PUNTO DE ENTRADA ---
    init();
});