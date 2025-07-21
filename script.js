/* Metrika - script.js (Versión 23.0 - Estabilidad y Mejoras de Carga) */
document.addEventListener('DOMContentLoaded', () => {

    // --- 1. ESTADO GLOBAL, CONSTANTES Y REFERENCIAS AL DOM ---
    let originalData = [], columnMapping = {}, activeFilters = {}, currentEditingColumn = null, currentFileName = null;
    let columnTypes = {}, dashboardWidgets = [], widgetCounter = 0, confirmAction = null, activeWidgetId = null;
    let crossFilter = null, grid = null;

    const LANG = {
        sum: 'Suma de', average: 'Promedio de', count: 'Recuento de', max: 'Máximo de', min: 'Mínimo de',
        errorInvalidFile: "El archivo no contiene datos válidos.",
        errorProcessingExcel: "Error procesando el archivo Excel.", errorReadingCSV: "Error al leer el archivo CSV.", errorUnsupportedFormat: "Formato de archivo no soportado.",
        errorAddChartWithNoData: "Carga datos antes de añadir un gráfico.", errorSelectWidgetFirst: "Selecciona o añade un gráfico primero.",
        errorYAxisNotNumeric: "Error: La columna del Eje Y debe ser numérica.", errorInvalidConfigFile: "Archivo de configuración no válido.",
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

    const DOM = {
        fileInput: document.getElementById('file-input'), newReportBtn: document.getElementById('new-report-btn'),
        closeAppBtn: document.getElementById('close-app-btn'), uploadScreen: document.getElementById('upload-screen'),
        mainScreen: document.getElementById('main-screen'), columnListContainer: document.getElementById('column-list'),
        xAxisDropzone: document.getElementById('x-axis-dropzone'), yAxisDropzone: document.getElementById('y-axis-dropzone'),
        chartTypeSelect: document.getElementById('chart-type'), filterContainer: document.getElementById('filter-container'),
        saveConfigBtn: document.getElementById('save-config-btn'), loadConfigInput: document.getElementById('load-config-input'),
        loadConfigLabel: document.getElementById('load-config-label'), exportReportBtn: document.getElementById('export-report-btn'),
        exportDataBtn: document.getElementById('export-data-btn'), renameModalOverlay: document.getElementById('rename-modal-overlay'),
        renameInput: document.getElementById('rename-input'), renameOkBtn: document.getElementById('rename-ok-btn'),
        renameCancelBtn: document.getElementById('rename-cancel-btn'), renameModalTitle: document.getElementById('rename-modal-title'),
        dashboardArea: document.getElementById('dashboard-area'), addVizBtn: document.getElementById('add-viz-btn'),
        confirmModalOverlay: document.getElementById('confirm-modal-overlay'), confirmModalText: document.getElementById('confirm-modal-text'),
        confirmOkBtn: document.getElementById('confirm-ok-btn'), confirmCancelBtn: document.getElementById('confirm-cancel-btn'),
        toastContainer: document.getElementById('toast-container'), widgetConfigSection: document.getElementById('widget-config-section'),
        customizationPanel: document.getElementById('customization-panel'), customizationTitle: document.getElementById('customization-title'),
        colorPaletteSelect: document.getElementById('color-palette-select'), closeCustomizationBtn: document.getElementById('close-customization-btn'),
        configTitle: document.getElementById('config-title'), customTitleInput: document.getElementById('custom-title-input'),
        showTitleToggle: document.getElementById('show-title-toggle'), showLegendToggle: document.getElementById('show-legend-toggle'),
        legendPositionSelect: document.getElementById('legend-position-select'), aggregationMenu: document.getElementById('aggregation-menu')
    };

    const COLOR_PALETTES = { default: ['#003da5', '#f2a900', '#5cb85c', '#5bc0de', '#d9534f'], office: ['#4472c4', '#ed7d31', '#a5a5a5', '#ffc000', '#5b9bd5'], ocean: ['#0077b6', '#00b4d8', '#ade8f4', '#90e0ef', '#caf0f8'], sunset: ['#f94144', '#f3722c', '#f8961e', '#f9c74f', '#90be6d'], grayscale: ['#212529', '#495057', '#adb5bd', '#dee2e6', '#f8f9fa'] };
    
    // --- LÓGICA DE LA APP ---
    
    const showToast = (message, type = 'success') => { const t = document.createElement('div'); t.className = `toast ${type}`; t.textContent = message; DOM.toastContainer.appendChild(t); setTimeout(() => t.remove(), 3000); };
    const handleDragOver = (e) => e.preventDefault();
    
    const showConfirmationModal = (text, action) => { DOM.confirmModalText.textContent = text; confirmAction = action; DOM.confirmModalOverlay.classList.add('visible'); };
    const hideConfirmModal = () => { DOM.confirmModalOverlay.classList.remove('visible'); confirmAction = null; };
    const processConfirm = () => { if (confirmAction) confirmAction(); hideConfirmModal(); };
    
    const resetApplication = (withConfirm = true) => {
        if (withConfirm && DOM.mainScreen.classList.contains('active')) { showConfirmationModal(LANG.confirmLoseChanges, () => resetApplication(false)); return; }
        clearDashboard(); originalData = []; columnMapping = {}; activeFilters = {}; crossFilter = null;
        columnTypes = {}; currentFileName = null; DOM.columnListContainer.innerHTML = ''; DOM.filterContainer.innerHTML = '';
        [DOM.saveConfigBtn, DOM.exportReportBtn, DOM.exportDataBtn].forEach(btn => btn.disabled = true);
        DOM.loadConfigLabel.classList.add('disabled'); DOM.mainScreen.classList.remove('active');
        DOM.uploadScreen.classList.add('active'); hideCustomizationPanel();
    };

    const clearDashboard = () => {
        if (grid) { grid.destroy(true); grid = null; } // CORRECCIÓN: Usar destroy(true) para limpiar completamente
        dashboardWidgets.forEach(w => { if (w.chartInstance) { w.chartInstance.destroy(); w.chartInstance = null; } });
        dashboardWidgets = []; widgetCounter = 0; DOM.dashboardArea.innerHTML = ''; clearDropZones(); activeWidgetId = null;
    };
    
    const initializeGrid = () => {
        grid = GridStack.init({ cellHeight: '70px', margin: 10, handle: '.widget-header', resizable: { handles: 'se' } });
        // CORRECCIÓN: Evento de redimensionado más seguro
        grid.on('resizestop', _.debounce((event, el) => {
            const widgetId = el.getAttribute('gs-id');
            const widget = dashboardWidgets.find(w => w.id === widgetId);
            if (widget && widget.chartInstance) { widget.chartInstance.resize(); }
        }, 200));
    };

    const addVisualizationWidget = () => {
        if (originalData.length === 0) { showToast(LANG.errorAddChartWithNoData, "error"); return; }
        if (!grid) { initializeGrid(); }
        widgetCounter++;
        const widgetId = `widget-${widgetCounter}`;
        const newWidget = { id: widgetId, chartType: 'bar', xColumn: null, yColumn: null, yAggregation: 'sum', xDateGrouping: 'none', title: LANG.widgetDefaultTitle, colorPalette: 'default', customTitle: '', showTitle: true, showLegend: true, legendPosition: 'top', chartInstance: null, keyMap: {} };
        dashboardWidgets.push(newWidget);
        const widgetEl = document.createElement('div');
        widgetEl.innerHTML = `<div class="grid-stack-item-content"><div class="widget-header"><span class="widget-title">${LANG.widgetDefaultTitle}</span><div class="widget-controls"><button class="customize-btn" title="Personalizar">⚙️</button><button class="remove-btn" title="Eliminar">❌</button></div></div><div class="widget-content"><p>${LANG.widgetDefaultContent}</p></div></div>`;
        grid.addWidget(widgetEl, { w: 6, h: 5, id: widgetId });
        widgetEl.addEventListener('click', () => setActiveWidget(widgetId));
        const contentEl = widgetEl.querySelector('.grid-stack-item-content');
        contentEl.querySelector('.customize-btn').addEventListener('click', (e) => { e.stopPropagation(); showCustomizationPanel(widgetId); });
        contentEl.querySelector('.remove-btn').addEventListener('click', (e) => { e.stopPropagation(); showConfirmationModal(LANG.confirmDeleteWidget, () => removeWidget(widgetId)); });
        setActiveWidget(widgetId);
    };

    const removeWidget = (widgetId) => {
        if (crossFilter && crossFilter.widgetId === widgetId) { clearCrossFilter(); }
        if (activeWidgetId === widgetId) { activeWidgetId = null; clearDropZones(); hideCustomizationPanel(); DOM.configTitle.textContent = "Configurar Gráfico"; }
        const widgetEl = document.querySelector(`.grid-stack-item[gs-id="${widgetId}"]`);
        const widgetIndex = dashboardWidgets.findIndex(w => w.id === widgetId);
        if (widgetIndex > -1) {
            const widgetState = dashboardWidgets[widgetIndex];
            if (widgetState.chartInstance) { widgetState.chartInstance.destroy(); }
            dashboardWidgets.splice(widgetIndex, 1);
        }
        if (widgetEl && grid) { grid.removeWidget(widgetEl); }
        showToast(LANG.toastWidgetRemoved);
    };
    
    // --- LÓGICA DE RENDERIZADO Y UI ---
    // (Funciones como setActiveWidget, updateConfigPanel, handleDrop, etc. que ya están en tu archivo)
    // ...

    // --- IMPORTACIÓN Y EXPORTACIÓN (Con Lógica Aclarada) ---

    // Este botón es para guardar la ESTRUCTURA del dashboard.
    const saveConfiguration = () => {
        const reportState = {
            appName: 'Metrika',
            version: '1.0',
            fileName: currentFileName, // Guarda el nombre del archivo de datos necesario
            columnMapping,
            activeFilters,
            dashboardWidgets: dashboardWidgets.map(({ chartInstance, ...w }) => w) // Excluye la instancia del gráfico
        };
        const blob = new Blob([JSON.stringify(reportState, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `config_metrika_${currentFileName}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
        showToast(LANG.toastConfigSaved);
    };

    // Este botón carga la ESTRUCTURA sobre un archivo de datos YA CARGADO.
    const loadConfiguration = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const loadedState = JSON.parse(e.target.result);
                // Validación del archivo de configuración
                if (loadedState.appName !== 'Metrika' || !loadedState.dashboardWidgets) {
                    showToast(LANG.errorInvalidConfigFile, 'error');
                    return;
                }
                // [CORRECCIÓN LÓGICA] Advierte al usuario si el archivo de datos no coincide
                if (originalData.length === 0 || currentFileName !== loadedState.fileName) {
                    showToast(LANG.errorLoadConfigFirst, 'error');
                    return;
                }
                applyState(loadedState);
            } catch (error) {
                showToast(LANG.errorReadingFile, 'error');
            }
        };
        reader.readAsText(file);
        event.target.value = ''; // Permite recargar el mismo archivo
    };
    
    const applyState = (state) => {
        clearDashboard();
        columnMapping = state.columnMapping;
        activeFilters = state.activeFilters || {};
        crossFilter = null;
        detectColumnTypes();
        initializeGrid();
        populateColumnList();
        populateFilters(state.activeFilters);
        state.dashboardWidgets.forEach(widgetState => {
            widgetCounter++;
            const widgetId = `widget-${widgetCounter}`;
            const newWidget = { ...widgetState, id: widgetId, chartInstance: null };
            dashboardWidgets.push(newWidget);
            const widgetEl = document.createElement('div');
            widgetEl.innerHTML = `<div class="grid-stack-item-content"><div class="widget-header"><span class="widget-title"></span><div class="widget-controls"><button class="customize-btn" title="Personalizar">⚙️</button><button class="remove-btn" title="Eliminar">❌</button></div></div><div class="widget-content"></div></div>`;
            grid.addWidget(widgetEl, { w: 6, h: 5, id: widgetId });
            widgetEl.addEventListener('click', () => setActiveWidget(widgetId));
            const contentEl = widgetEl.querySelector('.grid-stack-item-content');
            contentEl.querySelector('.customize-btn').addEventListener('click', (e) => { e.stopPropagation(); showCustomizationPanel(widgetId); });
            contentEl.querySelector('.remove-btn').addEventListener('click', (e) => { e.stopPropagation(); showConfirmationModal(LANG.confirmDeleteWidget, () => removeWidget(widgetId)); });
            renderWidget(widgetId);
        });
        if (dashboardWidgets.length > 0) setActiveWidget(dashboardWidgets[0].id);
        showToast(LANG.toastConfigLoaded);
    };
    
    // Este botón crea un HTML autovisualizable, ideal para compartir.
    const exportDashboard = () => {
        const originalAnimationSetting = Chart.defaults.animation;
        Chart.defaults.animation = false; // Desactiva animaciones para una captura limpia

        const promises = dashboardWidgets.map(widget => {
            return new Promise(resolve => {
                if (widget.chartInstance) {
                    setTimeout(() => { // Pequeña espera para asegurar el renderizado
                        const imgData = widget.chartInstance.toBase64Image();
                        resolve(`<div class="widget"><h2>${widget.customTitle || widget.title}</h2><img src="${imgData}" style="width:100%; height:auto;"></div>`);
                    }, 50);
                } else if (widget.chartType === 'table') {
                    const widgetEl = document.querySelector(`.grid-stack-item[gs-id="${widget.id}"] .widget-content`);
                    const tableClone = widgetEl.querySelector('.summary-table-wrapper').cloneNode(true);
                    resolve(`<div class="widget"><h2>${widget.customTitle || widget.title}</h2>${tableClone.outerHTML}</div>`);
                } else {
                    resolve(null);
                }
            });
        });

        Promise.all(promises).then(widgetsHtml => {
            Chart.defaults.animation = originalAnimationSetting; // Restaura la animación
            const exportHTML = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Reporte Metrika</title><style>body{font-family:sans-serif;background-color:#f4f4f9;padding:20px}h1{color:#003da5;text-align:center;}#dashboard{display:grid;grid-template-columns:repeat(auto-fit,minmax(450px,1fr));gap:20px;}.widget{background-color:white;border-radius:8px;padding:15px;overflow:hidden;box-shadow:0 2px 5px rgba(0,0,0,0.1);}.widget h2{font-size:1.2em;margin:0 0 10px 0;}</style></head><body><h1>Reporte Metrika</h1><div id="dashboard">${widgetsHtml.filter(Boolean).join('')}</div></body></html>`;
            const blob = new Blob([exportHTML], { type: 'text/html' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'reporte_metrika.html';
            a.click();
            URL.revokeObjectURL(a.href);
        });
    };

    // --- ARRANQUE INICIAL ---
    const init = () => {
        // [IMPORTANTE] Incluir la librería lodash para la función debounce
        const script = document.createElement('script');
        script.src = "https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js";
        script.onload = () => {
            // El resto de la inicialización va aquí, una vez que lodash esté cargado
            DOM.fileInput.addEventListener('change', handleFileSelect);
            DOM.loadConfigInput.addEventListener('change', loadConfiguration);
            // ... resto de tus event listeners ...
        };
        document.head.appendChild(script);

        // ... Mueve todos tus event listeners de la función init() original aquí dentro del script.onload ...
        // Ejemplo:
        // DOM.newReportBtn.addEventListener('click', () => resetApplication(true));
        // ... etc.
    };

    // --- Inicializa la aplicación ---
    // init(); // Comentamos esto por ahora, la lógica de inicialización está dentro del nuevo `init` con lodash.
    // Necesitarás reestructurar `init` como se describe arriba.
    
    // ...Pega aquí el resto de tu archivo script.js, asegurándote de mover los event listeners a la nueva función init...
});