/* Metrika - script.js (Versión 22.0 - Reconstruida y Mejorada) */
document.addEventListener('DOMContentLoaded', () => {

    // --- 1. ESTADO GLOBAL, CONSTANTES Y REFERENCIAS AL DOM ---
    let originalData = [], columnMapping = {}, activeFilters = {}, currentEditingColumn = null, currentFileName = null;
    let columnTypes = {}, dashboardWidgets = [], widgetCounter = 0, confirmAction = null, activeWidgetId = null;
    let crossFilter = null, grid = null;

    // --- MEJORA: Centralización de textos para fácil traducción (i18n) ---
    const LANG = {
        sum: 'Suma de', average: 'Promedio de', count: 'Recuento de', max: 'Máximo de', min: 'Mínimo de',
        errorInvalidFile: "El archivo no contiene datos válidos.",
        errorProcessingExcel: "Error procesando el archivo Excel.", errorReadingCSV: "Error al leer el archivo CSV.", errorUnsupportedFormat: "Formato de archivo no soportado.",
        errorAddChartWithNoData: "Carga datos antes de añadir un gráfico.", errorSelectWidgetFirst: "Selecciona o añade un gráfico primero.",
        errorYAxisNotNumeric: "Error: La columna del Eje Y debe ser numérica.", errorInvalidConfigFile: "Archivo de configuración no válido.",
        errorReadingFile: "Error al leer el archivo de configuración.",
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
    
    // --- 2. DEFINICIÓN DE FUNCIONES ---
    
    // Funciones de utilidad y UI general
    const showToast = (message, type = 'success') => { const t = document.createElement('div'); t.className = `toast ${type}`; t.textContent = message; DOM.toastContainer.appendChild(t); setTimeout(() => t.remove(), 3000); };
    const handleDragOver = (e) => e.preventDefault();
    
    // Modales de confirmación y renombre
    const showConfirmationModal = (text, action) => { DOM.confirmModalText.textContent = text; confirmAction = action; DOM.confirmModalOverlay.classList.add('visible'); };
    const hideConfirmModal = () => { DOM.confirmModalOverlay.classList.remove('visible'); confirmAction = null; };
    const processConfirm = () => { if (confirmAction) confirmAction(); hideConfirmModal(); };
    const showRenameModal = (h) => { currentEditingColumn = h; DOM.renameModalTitle.textContent = `Renombrar "${columnMapping[h]}"`; DOM.renameInput.value = columnMapping[h]; DOM.renameModalOverlay.classList.add('visible'); DOM.renameInput.focus(); DOM.renameInput.select(); };
    const hideRenameModal = () => { DOM.renameModalOverlay.classList.remove('visible'); currentEditingColumn = null; };
    const processRename = () => { const n = DOM.renameInput.value.trim(); if (n && currentEditingColumn) { columnMapping[currentEditingColumn] = n; populateColumnList(); populateFilters(activeFilters); rerenderAllWidgets(); showToast(LANG.toastColumnRenamed); } hideRenameModal(); };
    
    // Lógica principal de la aplicación
    const processData = (data) => {
        if (!data || data.length === 0 || typeof data[0] !== 'object') { showToast(LANG.errorInvalidFile, "error"); return; }
        resetApplication(false);
        originalData = data;
        columnMapping = {};
        const headers = Object.keys(data[0]);
        headers.forEach(f => { columnMapping[f] = f; });
        detectColumnTypes();
        DOM.uploadScreen.classList.remove('active');
        DOM.mainScreen.classList.add('active');
        initializeGrid();
        populateColumnList();
        populateFilters();
        [DOM.saveConfigBtn, DOM.exportReportBtn, DOM.exportDataBtn].forEach(btn => btn.disabled = false);
        DOM.loadConfigLabel.classList.remove('disabled');
        showToast(LANG.toastFileLoaded(currentFileName));
    };

    const resetApplication = (withConfirm = true) => {
        if (withConfirm && DOM.mainScreen.classList.contains('active')) { showConfirmationModal(LANG.confirmLoseChanges, () => resetApplication(false)); return; }
        clearDashboard();
        originalData = []; columnMapping = {}; activeFilters = {}; crossFilter = null;
        columnTypes = {}; currentEditingColumn = null; currentFileName = null;
        DOM.columnListContainer.innerHTML = ''; DOM.filterContainer.innerHTML = '';
        [DOM.saveConfigBtn, DOM.exportReportBtn, DOM.exportDataBtn].forEach(btn => btn.disabled = true);
        DOM.loadConfigLabel.classList.add('disabled');
        DOM.mainScreen.classList.remove('active');
        DOM.uploadScreen.classList.add('active');
        hideCustomizationPanel();
    };

    const clearDashboard = () => {
        if (grid) { grid.destroy(false); grid = null; }
        dashboardWidgets.forEach(w => { if (w.chartInstance) w.chartInstance.destroy(); });
        dashboardWidgets = [];
        widgetCounter = 0;
        DOM.dashboardArea.innerHTML = '';
        clearDropZones();
        activeWidgetId = null;
    };
    
    // Gestión de GridStack y Widgets
    const initializeGrid = () => {
        grid = GridStack.init({ cellHeight: '70px', margin: 10, handle: '.widget-header', resizable: { handles: 'se' } });
        grid.on('resizestop', (event, el) => {
            const widgetId = el.getAttribute('gs-id');
            const widget = dashboardWidgets.find(w => w.id === widgetId);
            if (widget && widget.chartInstance) { setTimeout(() => { widget.chartInstance.resize(); }, 100); }
        });
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
        if (activeWidgetId === widgetId) { activeWidgetId = null; clearDropZones(); hideCustomizationPanel(); DOM.configTitle.textContent = LANG.configTitle; }
        const widgetEl = document.querySelector(`.grid-stack-item[gs-id="${widgetId}"]`);
        if (widgetEl && grid) { grid.removeWidget(widgetEl); }
        const widgetIndex = dashboardWidgets.findIndex(w => w.id === widgetId);
        if (widgetIndex > -1) {
            const widgetState = dashboardWidgets[widgetIndex];
            if (widgetState.chartInstance) widgetState.chartInstance.destroy();
            dashboardWidgets.splice(widgetIndex, 1);
        }
        showToast(LANG.toastWidgetRemoved);
    };
    
    // Lógica de Renderizado y Actualización de Widgets
    const renderWidget = (widgetId) => {
        const widgetState = dashboardWidgets.find(w => w.id === widgetId);
        if (!widgetState) return;
        const widgetItem = document.querySelector(`.grid-stack-item[gs-id="${widgetId}"]`);
        const widgetElement = widgetItem?.querySelector('.grid-stack-item-content');
        if (!widgetElement) return;

        const contentArea = widgetElement.querySelector('.widget-content');
        contentArea.innerHTML = ''; // Limpiar siempre
        if (widgetState.chartInstance) { widgetState.chartInstance.destroy(); widgetState.chartInstance = null; }

        if (!widgetState.xColumn || !widgetState.yColumn) {
            contentArea.innerHTML = `<p>${LANG.widgetDefaultContent}</p>`;
            return;
        }

        // --- MEJORA: Manejo de error para Eje Y no numérico ---
        if (columnTypes[widgetState.yColumn] !== 'number') {
            contentArea.innerHTML = `<div class="widget-error"><p>⚠️</p><p>${LANG.errorYAxisNotNumeric}</p></div>`;
            widgetElement.querySelector('.widget-title').textContent = "Error de Configuración";
            return;
        }

        const { xColumn, yColumn, chartType, yAggregation, xDateGrouping } = widgetState;
        const aggregatedDataResult = getAggregatedData(xColumn, yColumn, yAggregation, xDateGrouping);
        widgetState.keyMap = aggregatedDataResult.keyMap; // --- MEJORA: Guardar el mapa de claves para el filtro cruzado
        
        const xDisplayName = columnMapping[xColumn], yDisplayName = columnMapping[yColumn], aggLabel = LANG[yAggregation];
        widgetState.title = LANG.widgetTitleTemplate(aggLabel, yDisplayName, xDisplayName);
        if (xDateGrouping !== 'none') {
            widgetState.title = LANG.widgetTitleDateTemplate(widgetState.title, LANG.dateGroupings[xDateGrouping]);
        }
        const displayTitle = widgetState.customTitle || widgetState.title;
        widgetElement.querySelector('.widget-title').textContent = displayTitle;

        if (chartType === 'table') {
            contentArea.innerHTML = createSummaryTableHTML(aggregatedDataResult.data, xDisplayName, yDisplayName, aggLabel);
        } else {
            const canvas = document.createElement('canvas');
            contentArea.appendChild(canvas);
            const chartConfig = createChartConfig(widgetState, aggregatedDataResult.data, xDisplayName, yDisplayName);
            chartConfig.options.onClick = (event) => handleChartClick(event, widgetState);
            widgetState.chartInstance = new Chart(canvas.getContext('2d'), chartConfig);
        }
    };

    const rerenderAllWidgets = () => {
        dashboardWidgets.forEach(w => renderWidget(w.id));
        document.querySelectorAll('.grid-stack-item-content').forEach(el => {
            const item = el.closest('.grid-stack-item');
            if (item) { el.classList.toggle('filtering-widget', crossFilter && item.getAttribute('gs-id') === crossFilter.widgetId); }
        });
    };
    
    // Gestión de UI del Sidebar y Configuración
    const setActiveWidget = (widgetId) => {
        if (activeWidgetId === widgetId && DOM.customizationPanel.style.display === 'none') return;
        activeWidgetId = widgetId;
        document.querySelectorAll('.grid-stack-item-content').forEach(w => w.classList.remove('active-widget'));
        const widgetItem = document.querySelector(`.grid-stack-item[gs-id="${widgetId}"]`);
        if (widgetItem) { widgetItem.querySelector('.grid-stack-item-content').classList.add('active-widget'); }
        const widget = dashboardWidgets.find(w => w.id === widgetId);
        if (widget) { DOM.configTitle.textContent = `Configurar: ${widget.title || 'Gráfico'}`; updateConfigPanel(widget); hideCustomizationPanel(); }
    };

    const updateConfigPanel = (widget) => {
        DOM.chartTypeSelect.value = widget.chartType;
        const xDropzone = DOM.xAxisDropzone, xOptionsContainer = xDropzone.querySelector('#x-axis-options'), xCol = widget.xColumn;
        if (xCol) {
            xDropzone.classList.add('filled'); xDropzone.querySelector('p').innerHTML = columnMapping[xCol];
            if (columnTypes[xCol] === 'date') {
                xOptionsContainer.style.display = 'block';
                xOptionsContainer.innerHTML = `<label for="date-grouping">Agrupar por:</label><select id="date-grouping"><option value="none">Fecha Exacta</option><option value="dayOfWeek">Día de la Semana</option><option value="month">Mes</option><option value="quarter">Trimestre</option><option value="year">Año</option></select>`;
                const select = xOptionsContainer.querySelector('#date-grouping');
                select.value = widget.xDateGrouping; select.addEventListener('change', handleDateGroupingChange);
            } else { xOptionsContainer.style.display = 'none'; }
        } else {
            xDropzone.classList.remove('filled'); xDropzone.querySelector('p').innerHTML = `Arrastra aquí para Eje X`; xOptionsContainer.style.display = 'none';
        }
        const yDropzone = DOM.yAxisDropzone, yCol = widget.yColumn, yAgg = widget.yAggregation;
        if (yCol) {
            yDropzone.classList.add('filled');
            const aggText = LANG[yAgg] || 'Suma de';
            yDropzone.querySelector('p').innerHTML = `(${aggText.replace(' de','')}) ${columnMapping[yCol]}`;
            const icon = yDropzone.querySelector('.agg-menu-icon');
            icon.style.display = 'block'; icon.onclick = (e) => showAggregationMenu(e, widget.id);
        } else {
            yDropzone.classList.remove('filled'); yDropzone.querySelector('p').innerHTML = `Arrastra aquí para Eje Y`; yDropzone.querySelector('.agg-menu-icon').style.display = 'none';
        }
    };
    
    const updateActiveWidgetConfig = () => { if (!activeWidgetId) return; const widget = dashboardWidgets.find(w => w.id === activeWidgetId); if (!widget) return; widget.chartType = DOM.chartTypeSelect.value; if (widget.xColumn && widget.yColumn) { renderWidget(widget.id); } };
    const handleDrop = (e) => {
        e.preventDefault();
        if (!activeWidgetId) { showToast(LANG.errorSelectWidgetFirst, "error"); return; }
        const columnName = e.dataTransfer.getData('text/plain');
        const dropzone = e.currentTarget;
        const activeWidget = dashboardWidgets.find(w => w.id === activeWidgetId);
        if (!activeWidget) return;
        
        activeWidget.chartType = DOM.chartTypeSelect.value;
        if (dropzone.id === 'x-axis-dropzone') {
            activeWidget.xColumn = columnName;
            activeWidget.xDateGrouping = (columnTypes[columnName] === 'date') ? 'month' : 'none';
        }
        if (dropzone.id === 'y-axis-dropzone') {
            if (columnTypes[columnName] !== 'number') { // --- MEJORA ---
                showToast(LANG.errorYAxisNotNumeric, "error");
                renderWidget(activeWidget.id); 
                return;
            }
            activeWidget.yColumn = columnName;
        }
        updateConfigPanel(activeWidget);
        renderWidget(activeWidget.id);
    };

    const applyCustomization = () => { if (!activeWidgetId) return; const widget = dashboardWidgets.find(w => w.id === activeWidgetId); if (!widget) return; widget.customTitle = DOM.customTitleInput.value; widget.showTitle = DOM.showTitleToggle.checked; widget.showLegend = DOM.showLegendToggle.checked; widget.legendPosition = DOM.legendPositionSelect.value; widget.colorPalette = DOM.colorPaletteSelect.value; DOM.legendPositionSelect.disabled = !widget.showLegend; renderWidget(activeWidgetId); };
    const hideCustomizationPanel = () => { DOM.customizationPanel.style.display = 'none'; DOM.widgetConfigSection.style.display = 'block'; };
    const showCustomizationPanel = (widgetId) => { const widget = dashboardWidgets.find(w => w.id === widgetId); if (!widget) return; setActiveWidget(widgetId); DOM.widgetConfigSection.style.display = 'none'; DOM.customizationPanel.style.display = 'block'; DOM.customizationTitle.textContent = `Personalizar: ${widget.title || 'Gráfico'}`; DOM.customTitleInput.value = widget.customTitle || widget.title; DOM.showTitleToggle.checked = widget.showTitle; DOM.showLegendToggle.checked = widget.showLegend; DOM.legendPositionSelect.value = widget.legendPosition; DOM.legendPositionSelect.disabled = !widget.showLegend; DOM.colorPaletteSelect.value = widget.colorPalette; };
    
    // --- MEJORA: Detección de tipos de columna más precisa ---
    const detectColumnTypes = () => {
        columnTypes = {}; if (originalData.length === 0) return;
        const headers = Object.keys(columnMapping);
        const sampleSize = Math.min(originalData.length, 200); // Aumentado de 50 a 200
        for (const header of headers) {
            let dateCount = 0, numCount = 0;
            for (let i = 0; i < sampleSize; i++) {
                const value = originalData[i][header];
                if (value === null || value === '') continue;
                if (!isNaN(parseFloat(value)) && isFinite(value)) { numCount++; }
                if (typeof value === 'string' && (/\d{4}-\d{2}-\d{2}/.test(value) || /\d{1,2}\/\d{1,2}\/\d{4}/.test(value)) && !isNaN(new Date(value).getTime())) {
                    dateCount++;
                }
            }
            if (dateCount / sampleSize > 0.7) { columnTypes[header] = 'date'; } 
            else if (numCount / sampleSize > 0.9) { columnTypes[header] = 'number'; } 
            else { columnTypes[header] = 'string'; }
        }
    };

    // Lógica de Datos y Filtros
    const getFilteredData = () => {
        let data = [...originalData];
        if (Object.keys(activeFilters).length > 0) { data = data.filter(r => Object.entries(activeFilters).every(([c, v]) => r[c] == v)); }
        if (crossFilter) {
            data = data.filter(row => {
                const rowValue = row[crossFilter.column];
                if (rowValue === null || rowValue === undefined) return false;
                if (columnTypes[crossFilter.column] === 'date') {
                    const date = new Date(rowValue);
                    if (isNaN(date.getTime())) return false;
                    return getGroupedDateValue(date, crossFilter.dateGrouping) == crossFilter.value;
                }
                return rowValue == crossFilter.value;
            });
        }
        return data;
    };
    
    // --- MEJORA: Filtro cruzado optimizado con keyMap ---
    const getAggregatedData = (xCol, yCol, aggType = 'sum', dateGrouping = 'none') => {
        const filteredData = getFilteredData();
        const intermediate = {};
        const keyMap = {}; // Mapa para búsqueda rápida: { displayKey -> originalKey }

        filteredData.forEach(row => {
            let originalKey = row[xCol];
            const value = parseFloat(row[yCol]);
            if (originalKey == null || isNaN(value)) return;
            
            let displayKey = originalKey;
            if (columnTypes[xCol] === 'date' && dateGrouping !== 'none') {
                const date = new Date(originalKey);
                if (isNaN(date.getTime())) return;
                originalKey = getGroupedDateValue(date, dateGrouping); // Clave para agrupar
                displayKey = getDisplayDateValue(date, dateGrouping, originalKey); // Clave para mostrar
            }
            
            keyMap[displayKey] = originalKey; // Guardar el mapeo

            if (!intermediate[originalKey]) intermediate[originalKey] = { sum: 0, count: 0, min: Infinity, max: -Infinity, displayKey: displayKey };
            intermediate[originalKey].sum += value;
            intermediate[originalKey].count++;
            if (value < intermediate[originalKey].min) intermediate[originalKey].min = value;
            if (value > intermediate[originalKey].max) intermediate[originalKey].max = value;
        });

        const sortedKeys = Object.keys(intermediate).sort((a, b) => {
             if (dateGrouping === 'dayOfWeek') return a - b;
             return String(a).localeCompare(String(b), undefined, { numeric: true });
        });
        
        const finalData = {};
        for (const key of sortedKeys) {
            const group = intermediate[key];
            const displayKey = group.displayKey;
            switch (aggType) {
                case 'average': finalData[displayKey] = group.sum / group.count; break;
                case 'count':   finalData[displayKey] = group.count; break;
                case 'max':     finalData[displayKey] = group.max; break;
                case 'min':     finalData[displayKey] = group.min; break;
                default:        finalData[displayKey] = group.sum; break;
            }
        }
        return { data: finalData, keyMap: keyMap };
    };

    const handleChartClick = (event, widgetState) => {
        const chart = widgetState.chartInstance;
        const points = chart.getElementsAtEventForMode(event, 'nearest', { intersect: true }, true);
        if (points.length) {
            const label = chart.data.labels[points[0].index];
            const originalValue = widgetState.keyMap[label]; // Búsqueda O(1)
            
            if (originalValue === undefined) return;

            if (crossFilter && crossFilter.widgetId === widgetState.id && crossFilter.value == originalValue) {
                clearCrossFilter();
                showToast(LANG.toastCrossFilterRemoved);
            } else {
                crossFilter = { widgetId: widgetState.id, column: widgetState.xColumn, value: originalValue, displayValue: label, dateGrouping: widgetState.xDateGrouping };
                showToast(LANG.toastCrossFilterApplied(label));
                rerenderAllWidgets();
            }
        } else {
            if (crossFilter && crossFilter.widgetId === widgetState.id) {
                clearCrossFilter();
                showToast(LANG.toastCrossFilterRemoved);
            }
        }
    };
    
    const clearCrossFilter = () => { crossFilter = null; rerenderAllWidgets(); };
    const showAggregationMenu = (event, widgetId) => { event.stopPropagation(); const rect = event.target.getBoundingClientRect(); DOM.aggregationMenu.style.display = 'block'; DOM.aggregationMenu.style.top = `${rect.bottom + window.scrollY}px`; DOM.aggregationMenu.style.left = `${rect.left + window.scrollX}px`; DOM.aggregationMenu.dataset.widgetId = widgetId; };
    const handleAggregationSelect = (event) => { const aggType = event.target.dataset.agg; const widgetId = DOM.aggregationMenu.dataset.widgetId; if (aggType && widgetId) { const widget = dashboardWidgets.find(w => w.id === widgetId); if (widget) { widget.yAggregation = aggType; updateConfigPanel(widget); renderWidget(widget.id); showToast(LANG.toastAggChanged(event.target.textContent)); } } DOM.aggregationMenu.style.display = 'none'; };
    const handleDateGroupingChange = (event) => { if (!activeWidgetId) return; const widget = dashboardWidgets.find(w => w.id === activeWidgetId); if (widget) { widget.xDateGrouping = event.target.value; renderWidget(widget.id); showToast(LANG.toastDateGroupChanged(event.target.options[event.target.selectedIndex].text)); } };
    
    // Funciones Auxiliares y de UI
    const handleFileSelect = (event) => { const file = event.target.files[0]; if (!file) return; currentFileName = file.name; const reader = new FileReader(); if (file.name.endsWith('.xlsx')) { reader.readAsArrayBuffer(file); reader.onload = (e) => { try { const d = new Uint8Array(e.target.result), w = XLSX.read(d, { type: 'array' }), s = w.SheetNames[0], j = XLSX.utils.sheet_to_json(w.Sheets[s]); processData(j); } catch (er) { showToast(LANG.errorProcessingExcel, "error"); console.error(er); } }; } else if (file.name.endsWith('.csv')) { Papa.parse(file, { header: true, dynamicTyping: true, skipEmptyLines: true, complete: (r) => processData(r.data), error: (err) => {showToast(LANG.errorReadingCSV, "error"); console.error(err);} }); } else { showToast(LANG.errorUnsupportedFormat, "error"); } event.target.value = ''; };
    const populateColumnList = () => { DOM.columnListContainer.innerHTML = ''; Object.keys(columnMapping).forEach(h => { const i = document.createElement('div'); i.className = 'column-item'; i.innerHTML = `<span class="column-name" draggable="true">${columnMapping[h]}</span><button class="edit-col-btn" title="Renombrar">✏️</button>`; i.querySelector('.column-name').addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', h)); i.querySelector('.edit-col-btn').addEventListener('click', () => showRenameModal(h)); DOM.columnListContainer.appendChild(i); }); };
    const populateFilters = (filtersToApply = {}) => { DOM.filterContainer.innerHTML = ''; Object.keys(columnMapping).forEach(header => { if (columnTypes[header] === 'date') return; const uniqueValues = [...new Set(originalData.map(row => row[header]))].filter(v => v != null); if (uniqueValues.length > 1 && uniqueValues.length < 150) { const filterGroup = document.createElement('div'); filterGroup.className = 'filter-group'; const select = document.createElement('select'); select.dataset.column = header; select.innerHTML = `<option value="all">-- Todos (${uniqueValues.length}) --</option>${uniqueValues.map(v => `<option value="${v}">${v}</option>`).join('')}`; if (filtersToApply[header]) { select.value = filtersToApply[header]; } filterGroup.innerHTML = `<label>${columnMapping[header]}</label>`; filterGroup.appendChild(select); select.addEventListener('change', () => { activeFilters = {}; DOM.filterContainer.querySelectorAll('select').forEach(s => { if (s.value !== 'all') activeFilters[s.dataset.column] = s.value; }); rerenderAllWidgets(); }); DOM.filterContainer.appendChild(filterGroup); } }); };
    const createChartConfig = (widgetState, data, xLabel, yLabel) => {
        const { chartType, colorPalette, customTitle, showTitle, showLegend, legendPosition, yAggregation, xDateGrouping } = widgetState;
        const aggLabel = LANG[yAggregation];
        let title = LANG.widgetTitleTemplate(aggLabel, yLabel, xLabel);
        if (xDateGrouping !== 'none') { title = LANG.widgetTitleDateTemplate(title, LANG.dateGroupings[xDateGrouping]); }
        const displayTitle = customTitle || title;
        return {
            type: chartType,
            data: { labels: Object.keys(data), datasets: [{ label: `${aggLabel} ${yLabel}`, data: Object.values(data), backgroundColor: COLOR_PALETTES[colorPalette] || COLOR_PALETTES.default }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { ticks: { callback: value => new Intl.NumberFormat().format(value) } } }, plugins: { title: { display: showTitle, text: displayTitle, font: { size: 16 } }, legend: { display: showLegend, position: legendPosition || 'top' }, tooltip: { callbacks: { label: context => `${context.dataset.label}: ${new Intl.NumberFormat().format(context.raw)}` } } } }
        };
    };

    const getGroupedDateValue = (date, dateGrouping) => {
        if (isNaN(date.getTime())) return null;
        const year = date.getFullYear(), month = date.getMonth(), day = date.getDay();
        switch (dateGrouping) {
            case 'year': return year;
            case 'quarter': return `${year}-T${Math.floor(month / 3) + 1}`;
            case 'month': return `${year}-${String(month + 1).padStart(2, '0')}`;
            case 'dayOfWeek': return day;
            default: return date.toISOString().split('T')[0];
        }
    };
    const getDisplayDateValue = (date, dateGrouping, originalKey) => {
        if (isNaN(date.getTime())) return originalKey;
        const year = date.getFullYear();
        switch (dateGrouping) {
            case 'year': return year.toString();
            case 'quarter': return originalKey;
            case 'month': const monthName = new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(date); return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`;
            case 'dayOfWeek': const dayName = new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(date); return dayName.charAt(0).toUpperCase() + dayName.slice(1);
            default: return originalKey;
        }
    };

    const clearDropZones = () => { DOM.xAxisDropzone.classList.remove('filled'); DOM.xAxisDropzone.querySelector('p').innerHTML = `Arrastra aquí para Eje X`; DOM.xAxisDropzone.querySelector('#x-axis-options').style.display = 'none'; DOM.yAxisDropzone.classList.remove('filled'); DOM.yAxisDropzone.querySelector('p').innerHTML = `Arrastra aquí para Eje Y`; DOM.yAxisDropzone.querySelector('.agg-menu-icon').style.display = 'none'; };
    const createSummaryTableHTML = (data, xLabel, yLabel, aggLabel) => { let tableHTML = `<div class="summary-table-wrapper"><table><thead><tr><th>${xLabel}</th><th>${aggLabel} ${yLabel}</th></tr></thead><tbody>`; if (Object.keys(data).length === 0) { tableHTML += `<tr><td colspan="2">No hay datos.</td></tr>`; } else { for (const [key, value] of Object.entries(data)) { tableHTML += `<tr><td>${key}</td><td>${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td></tr>`; } } return tableHTML + '</tbody></table></div>'; };
    
    // Importación y Exportación
    const saveConfiguration = () => { const reportState = { fileName: currentFileName, columnMapping, activeFilters, dashboardWidgets: dashboardWidgets.map(({ id, chartType, xColumn, yColumn, yAggregation, xDateGrouping, title, colorPalette, customTitle, showTitle, showLegend, legendPosition }) => ({ id, chartType, xColumn, yColumn, yAggregation, xDateGrouping, title, colorPalette, customTitle, showTitle, showLegend, legendPosition })) }; const blob = new Blob([JSON.stringify(reportState, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `config_dashboard_metrika.json`; a.click(); URL.revokeObjectURL(a.href); showToast(LANG.toastConfigSaved); };
    const loadConfiguration = (event) => { if (originalData.length === 0) { showToast(LANG.errorAddChartWithNoData, "error"); event.target.value = ''; return; } const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (e) => { try { const loadedState = JSON.parse(e.target.result); if (loadedState.dashboardWidgets) { applyState(loadedState); } else { showToast(LANG.errorInvalidConfigFile, 'error'); } } catch (error) { showToast(LANG.errorReadingFile, 'error'); } }; reader.readAsText(file); event.target.value = ''; };
    const applyState = (state) => { clearDashboard(); columnMapping = state.columnMapping; activeFilters = state.activeFilters || {}; crossFilter = null; detectColumnTypes(); initializeGrid();
        populateColumnList(); 
        populateFilters(state.activeFilters); 
        state.dashboardWidgets.forEach(widgetState => { 
            widgetCounter++; const widgetId = `widget-${widgetCounter}`; 
            const newWidget = { ...{ colorPalette: 'default', customTitle: '', showTitle: true, showLegend: true, legendPosition: 'top', yAggregation: 'sum', xDateGrouping: 'none' }, ...widgetState, id: widgetId, chartInstance: null }; 
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
    
    const exportDashboard = () => {
        // --- [MEJORA] Desactivar animaciones temporalmente para una exportación limpia y fiable ---
        const originalAnimationSetting = Chart.defaults.animation;
        Chart.defaults.animation = false;

        const promises = dashboardWidgets.map(widget => {
            const widgetEl = document.querySelector(`.grid-stack-item[gs-id="${widget.id}"] .widget-content`);
            if (!widgetEl) return Promise.resolve(null);
            
            return new Promise(resolve => {
                if (widget.chartInstance) {
                    const imgData = widget.chartInstance.toBase64Image();
                    resolve(`<div class="widget"><h2>${widget.customTitle || widget.title}</h2><img src="${imgData}" style="width:100%; height:auto;"></div>`);
                } else if (widget.chartType === 'table') {
                    const tableClone = widgetEl.querySelector('.summary-table-wrapper').cloneNode(true);
                    resolve(`<div class="widget"><h2>${widget.customTitle || widget.title}</h2>${tableClone.outerHTML}</div>`);
                } else {
                    resolve(null);
                }
            });
        });

        Promise.all(promises).then(widgetsHtml => {
            // --- [MEJORA] Restaurar la configuración de animación original ---
            Chart.defaults.animation = originalAnimationSetting;
            
            const exportHTML = `
                <!DOCTYPE html><html lang="es">
                <head><meta charset="UTF-8"><title>Reporte Metrika</title>
                <link rel="icon" href="data:image/x-icon;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAACFSURBVDhPzY1BCoAwCEM3/o/uFrx4S2N9k5b4kBCFCh1LNB2Ys0y4VrPgcQkSEkQKWGUKs4Q2s4i4gC2yY+wFjGCuYwk2mPfsDkY8TsoI6rI85STd9y5iL9gP4yAylnS2S0YVKa1Uo/am1R9x95Nnd/Z8A9mECcGgOdsPAAAAAElFTkSuQmCC">
                <style>
                    body{font-family:sans-serif;background-color:#f4f4f9;margin:0;padding:20px}
                    h1{color:#003da5;text-align:center;border-bottom:2px solid #f2a900;padding-bottom:10px;}
                    #dashboard{display:grid;grid-template-columns:repeat(auto-fit,minmax(450px,1fr));gap:20px;margin-top:20px}
                    .widget{background-color:white;border-radius:8px;box-shadow:0 2px 5px rgba(0,0,0,0.1);padding:15px;overflow:hidden;}
                    .widget h2{font-size:1.2em;margin:0 0 10px 0;color:#333}
                    .widget img{max-width:100%;border-radius:4px;}
                    .summary-table-wrapper { width: 100%; max-height: 400px; overflow: auto; }
                    .summary-table-wrapper table { width: 100%; border-collapse: collapse; }
                    .summary-table-wrapper th { background-color: #f2f2f2; font-weight: bold; position: sticky; top: 0; }
                    .summary-table-wrapper th, .summary-table-wrapper td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
                </style>
                </head>
                <body><h1>Reporte Metrika</h1><div id="dashboard">${widgetsHtml.filter(Boolean).join('')}</div></body></html>`;
            const blob = new Blob([exportHTML], { type: 'text/html' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'reporte_metrika.html';
            a.click();
            URL.revokeObjectURL(a.href);
        });
    };
    
    const exportDetailedData = () => {
        const dataToExport = getFilteredData();
        let table = '<table><thead><tr>';
        Object.keys(columnMapping).forEach(key => { table += `<th>${columnMapping[key]}</th>`; });
        table += '</tr></thead><tbody>';
        dataToExport.forEach(row => {
            table += '<tr>';
            Object.keys(columnMapping).forEach(key => { table += `<td>${row[key] || ''}</td>`; });
            table += '</tr>';
        });
        table += '</tbody></table>';
        const finalHtml = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Datos Exportados - Metrika</title><style>body{font-family:sans-serif;margin:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background-color:#f2f2f2}</style></head><body><h1>Datos Filtrados</h1>${table}</body></html>`;
        const blob = new Blob([finalHtml], { type: 'text/html' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'datos_filtrados_metrika.html';
        a.click();
        URL.revokeObjectURL(a.href);
    };
    
    // --- ARRANQUE INICIAL ---
    const init = () => {
        DOM.fileInput.addEventListener('change', handleFileSelect);
        DOM.newReportBtn.addEventListener('click', () => resetApplication(true));
        DOM.closeAppBtn.addEventListener('click', () => showConfirmationModal(LANG.confirmCloseApp, () => window.close()));
        DOM.addVizBtn.addEventListener('click', addVisualizationWidget);
        [DOM.xAxisDropzone, DOM.yAxisDropzone].forEach(z => { z.addEventListener('dragover', handleDragOver); z.addEventListener('drop', handleDrop); });
        DOM.chartTypeSelect.addEventListener('change', updateActiveWidgetConfig);
        DOM.saveConfigBtn.addEventListener('click', saveConfiguration);
        DOM.loadConfigInput.addEventListener('change', loadConfiguration);
        DOM.renameCancelBtn.addEventListener('click', hideRenameModal);
        DOM.renameOkBtn.addEventListener('click', processRename);
        DOM.renameModalOverlay.addEventListener('click', (e) => { if (e.target === DOM.renameModalOverlay) hideRenameModal(); });
        DOM.confirmCancelBtn.addEventListener('click', hideConfirmModal);
        DOM.confirmOkBtn.addEventListener('click', processConfirm);
        DOM.confirmModalOverlay.addEventListener('click', (e) => { if (e.target === DOM.confirmModalOverlay) hideConfirmModal(); });
        DOM.exportReportBtn.addEventListener('click', exportDashboard);
        DOM.exportDataBtn.addEventListener('click', exportDetailedData);
        DOM.colorPaletteSelect.addEventListener('change', applyCustomization);
        DOM.customTitleInput.addEventListener('input', applyCustomization);
        DOM.showTitleToggle.addEventListener('change', applyCustomization);
        DOM.showLegendToggle.addEventListener('change', applyCustomization);
        DOM.legendPositionSelect.addEventListener('change', applyCustomization);
        DOM.closeCustomizationBtn.addEventListener('click', hideCustomizationPanel);
        DOM.aggregationMenu.addEventListener('click', handleAggregationSelect);
        document.addEventListener('click', () => { if(DOM.aggregationMenu) DOM.aggregationMenu.style.display = 'none'});
    };

    init();
});