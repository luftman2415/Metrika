/* Metrika - script.js (Versión 25.0 - Final Estable) */
document.addEventListener('DOMContentLoaded', () => {

    // --- ESTADO GLOBAL, CONSTANTES Y REFERENCIAS AL DOM ---
    let originalData = [], columnMapping = {}, activeFilters = {}, currentFileName = null;
    let columnTypes = {}, dashboardWidgets = [], widgetCounter = 0, activeWidgetId = null;
    let crossFilter = null, grid = null;
    let confirmAction = null;

    const LANG = {
        sum: 'Suma de', average: 'Promedio de', count: 'Recuento de', max: 'Máximo de', min: 'Mínimo de',
        errorInvalidFile: "El archivo no contiene datos válidos.", errorProcessingFile: "Error procesando el archivo.",
        errorUnsupportedFormat: "Formato de archivo no soportado. Por favor, usa CSV o XLSX.",
        errorAddChartWithNoData: "Carga datos antes de añadir un gráfico.", errorSelectWidgetFirst: "Selecciona o añade un gráfico primero.",
        errorYAxisNotNumeric: "Error: La columna del Eje Y debe ser numérica.",
        errorInvalidConfigFile: "Archivo de configuración no válido o dañado.",
        errorReadingFile: "Error al leer el archivo de configuración.",
        errorLoadConfigFirst: "Para cargar una configuración, primero debes cargar el archivo de datos (CSV/Excel) original con el que se creó.",
        confirmLoseChanges: "¿Seguro? Se perderán todos los cambios no guardados.", confirmDeleteWidget: "¿Seguro que quieres eliminar este gráfico?",
        confirmCloseApp: "¿Seguro que quieres cerrar Metrika?",
        toastFileLoaded: (name) => `Archivo "${name}" cargado con éxito.`, toastColumnRenamed: "Columna renombrada.", toastWidgetRemoved: "Gráfico eliminado.",
        toastCrossFilterApplied: (label) => `Filtrando por: ${label}`, toastCrossFilterRemoved: "Filtro cruzado eliminado.",
        toastConfigSaved: "Configuración guardada.", toastConfigLoaded: "Configuración cargada con éxito.",
        toastAggChanged: (label) => `Agregación cambiada a: ${label}`, toastDateGroupChanged: (label) => `Agrupando fecha por: ${label}`,
        widgetDefaultTitle: "Nuevo Gráfico", widgetDefaultContent: "Configura este gráfico."
    };

    const DOM = {};
    const populateDomReferences = () => {
        const ids = ['file-input', 'new-report-btn', 'close-app-btn', 'upload-screen', 'main-screen', 'column-list', 'x-axis-dropzone', 'y-axis-dropzone', 'chart-type', 'filter-container', 'save-config-btn', 'load-config-input', 'load-config-label', 'export-report-btn', 'export-data-btn', 'rename-modal-overlay', 'rename-input', 'rename-ok-btn', 'rename-cancel-btn', 'rename-modal-title', 'dashboard-area', 'add-viz-btn', 'confirm-modal-overlay', 'confirm-modal-text', 'confirm-ok-btn', 'confirm-cancel-btn', 'toast-container', 'widget-config-section', 'customization-panel', 'customization-title', 'color-palette-select', 'close-customization-btn', 'config-title', 'custom-title-input', 'show-title-toggle', 'show-legend-toggle', 'legend-position-select', 'aggregation-menu'];
        ids.forEach(id => {
            const camelCaseId = id.replace(/-./g, x => x[1].toUpperCase());
            DOM[camelCaseId] = document.getElementById(id);
        });
    };

    const COLOR_PALETTES = { default: ['#003da5', '#f2a900', '#5cb85c', '#5bc0de', '#d9534f'], office: ['#4472c4', '#ed7d31', '#a5a5a5', '#ffc000', '#5b9bd5'], ocean: ['#0077b6', '#00b4d8', '#ade8f4', '#90e0ef', '#caf0f8'], sunset: ['#f94144', '#f3722c', '#f8961e', '#f9c74f', '#90be6d'], grayscale: ['#212529', '#495057', '#adb5bd', '#dee2e6', '#f8f9fa'] };

    // --- FUNCIONES DE LA APLICACIÓN ---

    const showToast = (message, type = 'success') => {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`; toast.textContent = message;
        DOM.toastContainer.appendChild(toast);
        setTimeout(() => toast.remove(), 3500);
    };

    const handleDragOver = (e) => e.preventDefault();

    const showConfirmationModal = (text, action) => {
        DOM.confirmModalText.textContent = text; confirmAction = action;
        DOM.confirmModalOverlay.classList.add('visible');
    };

    const hideModal = (modalOverlay) => { modalOverlay.classList.remove('visible'); };
    const processConfirm = () => { if (typeof confirmAction === 'function') confirmAction(); hideModal(DOM.confirmModalOverlay); };
    
    const showRenameModal = (h) => {
        currentEditingColumn = h;
        DOM.renameModalTitle.textContent = `Renombrar "${columnMapping[h]}"`;
        DOM.renameInput.value = columnMapping[h];
        DOM.renameModalOverlay.classList.add('visible');
        DOM.renameInput.focus();
        DOM.renameInput.select();
    };
    
    const processRename = () => {
        const newName = DOM.renameInput.value.trim();
        if (newName && currentEditingColumn) {
            columnMapping[currentEditingColumn] = newName;
            populateColumnList();
            populateFilters(activeFilters);
            rerenderAllWidgets();
            showToast(LANG.toastColumnRenamed);
        }
        hideModal(DOM.renameModalOverlay);
    };

    const processData = (data, fileName) => {
        if (!data || data.length === 0 || typeof data[0] !== 'object') {
            showToast(LANG.errorInvalidFile, "error"); return;
        }
        currentFileName = fileName;
        resetApplication(false, true);
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
        [DOM.saveConfigBtn, DOM.exportReportBtn, DOM.exportDataBtn].forEach(el => el.disabled = false);
        DOM.loadConfigLabel.classList.remove('disabled');
        showToast(LANG.toastFileLoaded(currentFileName));
    };

    const resetApplication = (withConfirm = true, keepFileName = false) => {
        const doReset = () => {
            clearDashboard();
            originalData = []; columnMapping = {}; activeFilters = {}; crossFilter = null;
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
        if (grid) { grid.destroy(true); grid = null; }
        dashboardWidgets.forEach(w => { if (w.chartInstance) { w.chartInstance.destroy(); }});
        dashboardWidgets = []; widgetCounter = 0;
        DOM.dashboardArea.innerHTML = '';
        clearDropZones();
        activeWidgetId = null;
    };

    const initializeGrid = () => {
        grid = GridStack.init({ cellHeight: '70px', margin: 10, handle: '.widget-header', resizable: { handles: 'se' } });
        grid.on('resizestop', _.debounce((event, el) => {
            const widgetId = el.getAttribute('gs-id');
            const widget = dashboardWidgets.find(w => w.id === widgetId);
            if (widget && widget.chartInstance) { widget.chartInstance.resize(); }
        }, 150));
    };

    const addVisualizationWidget = () => {
        if (originalData.length === 0) { showToast(LANG.errorAddChartWithNoData, "error"); return; }
        if (!grid) initializeGrid();
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
        if (crossFilter && crossFilter.widgetId === widgetId) clearCrossFilter();
        if (activeWidgetId === widgetId) { activeWidgetId = null; clearDropZones(); hideCustomizationPanel(); DOM.configTitle.textContent = "Configurar Gráfico"; }
        const widgetEl = document.querySelector(`.grid-stack-item[gs-id="${widgetId}"]`);
        const widgetIndex = dashboardWidgets.findIndex(w => w.id === widgetId);
        if (widgetIndex > -1) {
            const widgetState = dashboardWidgets[widgetIndex];
            if (widgetState.chartInstance) widgetState.chartInstance.destroy();
            dashboardWidgets.splice(widgetIndex, 1);
        }
        if (widgetEl && grid) grid.removeWidget(widgetEl);
        showToast(LANG.toastWidgetRemoved);
    };

    const renderWidget = (widgetId) => {
        const widgetState = dashboardWidgets.find(w => w.id === widgetId);
        if (!widgetState) return;
        const widgetItem = document.querySelector(`.grid-stack-item[gs-id="${widgetId}"]`);
        if (!widgetItem) return;
        const widgetElement = widgetItem.querySelector('.grid-stack-item-content');
        const contentArea = widgetElement.querySelector('.widget-content');
        
        contentArea.innerHTML = '';
        if (widgetState.chartInstance) { widgetState.chartInstance.destroy(); widgetState.chartInstance = null; }

        if (!widgetState.xColumn || !widgetState.yColumn) {
            contentArea.innerHTML = `<p>${LANG.widgetDefaultContent}</p>`;
            return;
        }

        if (columnTypes[widgetState.yColumn] !== 'number') {
            contentArea.innerHTML = `<div class="widget-error"><p>⚠️</p><p>${LANG.errorYAxisNotNumeric}</p></div>`;
            widgetElement.querySelector('.widget-title').textContent = "Error de Configuración";
            return;
        }

        const { xColumn, yColumn, chartType, yAggregation, xDateGrouping } = widgetState;
        const aggregatedDataResult = getAggregatedData(xColumn, yColumn, yAggregation, xDateGrouping);
        widgetState.keyMap = aggregatedDataResult.keyMap;

        const xDisplayName = columnMapping[xColumn], yDisplayName = columnMapping[yColumn], aggLabel = LANG[yAggregation] || `${yAggregation} de`;
        widgetState.title = `${aggLabel} ${yDisplayName} por ${xDisplayName}`;
        if (xDateGrouping !== 'none') {
            widgetState.title += ` (por ${LANG.dateGroupings[xDateGrouping]})`;
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
            widgetState.chartInstance = new Chart(canvas, chartConfig);
        }
    };

    const rerenderAllWidgets = () => {
        dashboardWidgets.forEach(w => renderWidget(w.id));
        document.querySelectorAll('.grid-stack-item-content').forEach(el => {
            const item = el.closest('.grid-stack-item');
            if (item) el.classList.toggle('filtering-widget', crossFilter && item.getAttribute('gs-id') === crossFilter.widgetId);
        });
    };

    const setActiveWidget = (widgetId) => {
        if (activeWidgetId === widgetId && DOM.customizationPanel.style.display === 'none') return;
        activeWidgetId = widgetId;
        document.querySelectorAll('.grid-stack-item-content').forEach(w => w.classList.remove('active-widget'));
        const widgetItem = document.querySelector(`.grid-stack-item[gs-id="${widgetId}"]`);
        if (widgetItem) widgetItem.querySelector('.grid-stack-item-content').classList.add('active-widget');
        const widget = dashboardWidgets.find(w => w.id === widgetId);
        if (widget) { DOM.configTitle.textContent = `Configurar: ${widget.title || 'Gráfico'}`; updateConfigPanel(widget); hideCustomizationPanel(); }
    };

    const updateConfigPanel = (widget) => {
        DOM.chartTypeSelect.value = widget.chartType;
        const xDropzone = DOM.xAxisDropzone;
        const xOptionsContainer = xDropzone.querySelector('#x-axis-options');
        if (widget.xColumn) {
            xDropzone.classList.add('filled');
            xDropzone.querySelector('p').textContent = columnMapping[widget.xColumn];
            if (columnTypes[widget.xColumn] === 'date') {
                xOptionsContainer.style.display = 'block';
                xOptionsContainer.innerHTML = `<label for="date-grouping-${widget.id}">Agrupar por:</label><select id="date-grouping-${widget.id}"><option value="none">Fecha Exacta</option><option value="dayOfWeek">Día de la Semana</option><option value="month">Mes</option><option value="quarter">Trimestre</option><option value="year">Año</option></select>`;
                const select = xOptionsContainer.querySelector(`#date-grouping-${widget.id}`);
                select.value = widget.xDateGrouping;
                select.addEventListener('change', (e) => handleDateGroupingChange(e, widget.id));
            } else {
                xOptionsContainer.style.display = 'none';
            }
        } else {
            xDropzone.classList.remove('filled');
            xDropzone.querySelector('p').textContent = 'Arrastra aquí para Eje X';
            xOptionsContainer.style.display = 'none';
        }
        const yDropzone = DOM.yAxisDropzone;
        if (widget.yColumn) {
            yDropzone.classList.add('filled');
            const aggText = (LANG[widget.yAggregation] || 'Suma de').replace(' de', '');
            yDropzone.querySelector('p').textContent = `(${aggText}) ${columnMapping[widget.yColumn]}`;
            const icon = yDropzone.querySelector('.agg-menu-icon');
            icon.style.display = 'block';
            icon.onclick = (e) => showAggregationMenu(e, widget.id);
        } else {
            yDropzone.classList.remove('filled');
            yDropzone.querySelector('p').textContent = 'Arrastra aquí para Eje Y';
            yDropzone.querySelector('.agg-menu-icon').style.display = 'none';
        }
    };
    
    const updateActiveWidgetConfig = () => {
        if (!activeWidgetId) return;
        const widget = dashboardWidgets.find(w => w.id === activeWidgetId);
        if (!widget) return;
        widget.chartType = DOM.chartTypeSelect.value;
        if (widget.xColumn && widget.yColumn) renderWidget(widget.id);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        if (!activeWidgetId) { showToast(LANG.errorSelectWidgetFirst, "error"); return; }
        const columnName = e.dataTransfer.getData('text/plain');
        const dropzone = e.currentTarget;
        const activeWidget = dashboardWidgets.find(w => w.id === activeWidgetId);
        if (!activeWidget) return;
        if (dropzone.id === 'x-axis-dropzone') {
            activeWidget.xColumn = columnName;
            activeWidget.xDateGrouping = (columnTypes[columnName] === 'date') ? 'month' : 'none';
        } else if (dropzone.id === 'y-axis-dropzone') {
            if (columnTypes[columnName] !== 'number') {
                showToast(LANG.errorYAxisNotNumeric, "error");
                activeWidget.yColumn = columnName;
            } else {
                activeWidget.yColumn = columnName;
            }
        }
        updateConfigPanel(activeWidget);
        renderWidget(activeWidget.id);
    };

    const applyCustomization = () => {
        if (!activeWidgetId) return;
        const widget = dashboardWidgets.find(w => w.id === activeWidgetId);
        if (!widget) return;
        widget.customTitle = DOM.customTitleInput.value;
        widget.showTitle = DOM.showTitleToggle.checked;
        widget.showLegend = DOM.showLegendToggle.checked;
        widget.legendPosition = DOM.legendPositionSelect.value;
        widget.colorPalette = DOM.colorPaletteSelect.value;
        DOM.legendPositionSelect.disabled = !widget.showLegend;
        renderWidget(activeWidgetId);
    };

    const hideCustomizationPanel = () => {
        DOM.customizationPanel.style.display = 'none';
        DOM.widgetConfigSection.style.display = 'block';
    };

    const showCustomizationPanel = (widgetId) => {
        const widget = dashboardWidgets.find(w => w.id === widgetId);
        if (!widget) return;
        setActiveWidget(widgetId);
        DOM.widgetConfigSection.style.display = 'none';
        DOM.customizationPanel.style.display = 'block';
        DOM.customizationTitle.textContent = `Personalizar: ${widget.title || 'Gráfico'}`;
        DOM.customTitleInput.value = widget.customTitle || '';
        DOM.showTitleToggle.checked = widget.showTitle;
        DOM.showLegendToggle.checked = widget.showLegend;
        DOM.legendPositionSelect.value = widget.legendPosition;
        DOM.legendPositionSelect.disabled = !widget.showLegend;
        DOM.colorPaletteSelect.value = widget.colorPalette;
    };

    const detectColumnTypes = () => {
        columnTypes = {}; if (originalData.length === 0) return;
        const headers = Object.keys(columnMapping);
        const sampleSize = Math.min(originalData.length, 100);
        for (const header of headers) {
            let numCount = 0, dateCount = 0;
            for (let i = 0; i < sampleSize; i++) {
                const value = originalData[i][header];
                if (value === null || value === '') continue;
                if (!isNaN(parseFloat(value)) && isFinite(value)) numCount++;
                if (typeof value === 'string' && (/\d{4}-\d{2}-\d{2}/.test(value) || /\d{1,2}\/\d{1,2}\/\d{4}/.test(value)) && !isNaN(new Date(value).getTime())) dateCount++;
            }
            if (dateCount / sampleSize > 0.7) columnTypes[header] = 'date';
            else if (numCount / sampleSize > 0.9) columnTypes[header] = 'number';
            else columnTypes[header] = 'string';
        }
    };

    const getFilteredData = () => {
        let data = [...originalData];
        if (Object.keys(activeFilters).length > 0) {
            data = data.filter(r => Object.entries(activeFilters).every(([c, v]) => String(r[c]) === String(v)));
        }
        if (crossFilter) {
            data = data.filter(row => {
                const rowValue = row[crossFilter.column];
                if (rowValue === null || rowValue === undefined) return false;
                if (columnTypes[crossFilter.column] === 'date') {
                    const date = new Date(rowValue);
                    if (isNaN(date.getTime())) return false;
                    return getGroupedDateValue(date, crossFilter.dateGrouping) == crossFilter.value;
                }
                return String(rowValue) === String(crossFilter.value);
            });
        }
        return data;
    };

    const getAggregatedData = (xCol, yCol, aggType, dateGrouping) => {
        const filteredData = getFilteredData();
        const intermediate = {};
        const keyMap = {};
        filteredData.forEach(row => {
            let originalKey = row[xCol];
            const value = parseFloat(row[yCol]);
            if (originalKey == null || isNaN(value)) return;
            let displayKey = originalKey;
            if (columnTypes[xCol] === 'date' && dateGrouping !== 'none') {
                const date = new Date(originalKey);
                if (isNaN(date.getTime())) return;
                originalKey = getGroupedDateValue(date, dateGrouping);
                displayKey = getDisplayDateValue(date, dateGrouping, originalKey);
            }
            keyMap[displayKey] = originalKey;
            if (!intermediate[originalKey]) intermediate[originalKey] = { sum: 0, count: 0, min: Infinity, max: -Infinity, displayKey: displayKey };
            intermediate[originalKey].sum += value;
            intermediate[originalKey].count++;
            intermediate[originalKey].min = Math.min(intermediate[originalKey].min, value);
            intermediate[originalKey].max = Math.max(intermediate[originalKey].max, value);
        });
        const sortedKeys = Object.keys(intermediate).sort((a, b) => {
            if (dateGrouping === 'dayOfWeek') return a - b;
            return String(a).localeCompare(String(b), undefined, { numeric: true });
        });
        const finalData = {};
        sortedKeys.forEach(key => {
            const group = intermediate[key];
            const displayKey = group.displayKey;
            switch (aggType) {
                case 'average': finalData[displayKey] = group.sum / group.count; break;
                case 'count': finalData[displayKey] = group.count; break;
                case 'max': finalData[displayKey] = group.max; break;
                case 'min': finalData[displayKey] = group.min; break;
                default: finalData[displayKey] = group.sum; break;
            }
        });
        return { data: finalData, keyMap };
    };

    const handleChartClick = (event, widgetState) => {
        const chart = widgetState.chartInstance;
        if (!chart) return;
        const points = chart.getElementsAtEventForMode(event, 'nearest', { intersect: true }, true);
        if (points.length) {
            const label = chart.data.labels[points[0].index];
            const originalValue = widgetState.keyMap[label];
            if (originalValue === undefined) return;
            if (crossFilter && crossFilter.widgetId === widgetState.id && crossFilter.value == originalValue) {
                clearCrossFilter();
                showToast(LANG.toastCrossFilterRemoved);
            } else {
                crossFilter = { widgetId: widgetState.id, column: widgetState.xColumn, value: originalValue, displayValue: label, dateGrouping: widgetState.xDateGrouping };
                showToast(LANG.toastCrossFilterApplied(label));
                rerenderAllWidgets();
            }
        }
    };
    
    const clearCrossFilter = () => { crossFilter = null; rerenderAllWidgets(); };
    const showAggregationMenu = (event, widgetId) => { event.stopPropagation(); const rect = event.target.getBoundingClientRect(); DOM.aggregationMenu.style.display = 'block'; DOM.aggregationMenu.style.top = `${rect.bottom + window.scrollY}px`; DOM.aggregationMenu.style.left = `${rect.left + window.scrollX}px`; DOM.aggregationMenu.dataset.widgetId = widgetId; };
    const handleAggregationSelect = (event) => {
        const aggType = event.target.dataset.agg; const widgetId = DOM.aggregationMenu.dataset.widgetId;
        if (aggType && widgetId) {
            const widget = dashboardWidgets.find(w => w.id === widgetId);
            if (widget) { widget.yAggregation = aggType; updateConfigPanel(widget); renderWidget(widget.id); showToast(LANG.toastAggChanged(event.target.textContent)); }
        }
        DOM.aggregationMenu.style.display = 'none';
    };

    const handleDateGroupingChange = (event, widgetId) => {
        const widget = dashboardWidgets.find(w => w.id === widgetId);
        if (widget) { widget.xDateGrouping = event.target.value; renderWidget(widget.id); showToast(LANG.toastDateGroupChanged(event.target.options[event.target.selectedIndex].text)); }
    };
    
    const handleFileSelect = (e, type) => {
        const file = e.target.files[0]; if (!file) return;
        if (type === 'data') {
            const reader = new FileReader();
            if (file.name.endsWith('.xlsx')) {
                reader.onload = (re) => { try { const d = new Uint8Array(re.target.result); const w = XLSX.read(d); const s = w.SheetNames[0]; const j = XLSX.utils.sheet_to_json(w.Sheets[s]); processData(j, file.name); } catch { showToast(LANG.errorProcessingFile, "error"); } };
                reader.readAsArrayBuffer(file);
            } else if (file.name.endsWith('.csv')) {
                Papa.parse(file, { header: true, dynamicTyping: true, skipEmptyLines: true, complete: (r) => processData(r.data, file.name), error: () => showToast(LANG.errorProcessingFile, "error") });
            } else { showToast(LANG.errorUnsupportedFormat, "error"); }
        } else if (type === 'config') {
            if (originalData.length === 0) { showToast(LANG.errorLoadConfigFirst, 'error'); e.target.value = ''; return; }
            const reader = new FileReader();
            reader.onload = (re) => { try { const s = JSON.parse(re.target.result); applyState(s); } catch { showToast(LANG.errorInvalidConfigFile, 'error'); }};
            reader.readAsText(file);
        }
        e.target.value = '';
    };

    const populateColumnList = () => { DOM.columnListContainer.innerHTML = ''; Object.keys(columnMapping).forEach(h => { const i = document.createElement('div'); i.className = 'column-item'; i.innerHTML = `<span class="column-name" draggable="true">${columnMapping[h]}</span><button class="edit-col-btn" title="Renombrar">✏️</button>`; i.querySelector('.column-name').addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', h)); i.querySelector('.edit-col-btn').addEventListener('click', () => showRenameModal(h)); DOM.columnListContainer.appendChild(i); }); };
    
    const populateFilters = (filtersToApply = {}) => { DOM.filterContainer.innerHTML = ''; Object.keys(columnMapping).forEach(header => { if (columnTypes[header] === 'date') return; const uniqueValues = [...new Set(originalData.map(row => row[header]))].filter(v => v != null).sort(); if (uniqueValues.length > 1 && uniqueValues.length < 150) { const filterGroup = document.createElement('div'); filterGroup.className = 'filter-group'; const select = document.createElement('select'); select.dataset.column = header; select.innerHTML = `<option value="all">-- Todos (${columnMapping[header]}) --</option>${uniqueValues.map(v => `<option value="${v}">${v}</option>`).join('')}`; if (filtersToApply[header]) select.value = filtersToApply[header]; filterGroup.innerHTML = `<label>${columnMapping[header]}</label>`; filterGroup.appendChild(select); select.addEventListener('change', () => { activeFilters = {}; DOM.filterContainer.querySelectorAll('select').forEach(s => { if (s.value !== 'all') activeFilters[s.dataset.column] = s.value; }); clearCrossFilter(); rerenderAllWidgets(); }); DOM.filterContainer.appendChild(filterGroup); } }); };
    
    const createChartConfig = (widgetState, data, xLabel, yLabel) => {
        const { chartType, colorPalette, customTitle, showTitle, showLegend, legendPosition, yAggregation, xDateGrouping } = widgetState;
        const aggLabel = LANG[yAggregation] || `${yAggregation} de`;
        let title = `${aggLabel} ${yLabel} por ${xLabel}`;
        if (xDateGrouping !== 'none') title += ` (por ${LANG.dateGroupings[xDateGrouping]})`;
        const displayTitle = customTitle || title;
        return {
            type: chartType, data: { labels: Object.keys(data), datasets: [{ label: `${aggLabel} ${yLabel}`, data: Object.values(data), backgroundColor: COLOR_PALETTES[colorPalette] || COLOR_PALETTES.default }] },
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

    const clearDropZones = () => {
        DOM.xAxisDropzone.classList.remove('filled');
        DOM.xAxisDropzone.querySelector('p').textContent = 'Arrastra aquí para Eje X';
        DOM.xAxisDropzone.querySelector('#x-axis-options').style.display = 'none';
        DOM.yAxisDropzone.classList.remove('filled');
        DOM.yAxisDropzone.querySelector('p').textContent = 'Arrastra aquí para Eje Y';
        DOM.yAxisDropzone.querySelector('.agg-menu-icon').style.display = 'none';
    };
    
    const createSummaryTableHTML = (data, xLabel, yLabel, aggLabel) => { let html = `<div class="summary-table-wrapper"><table><thead><tr><th>${xLabel}</th><th>${aggLabel} ${yLabel}</th></tr></thead><tbody>`; for (const [key, value] of Object.entries(data)) { html += `<tr><td>${key}</td><td>${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td></tr>`; } return html + '</tbody></table></div>'; };
    
    const saveConfiguration = () => {
        const reportState = { appName: 'Metrika', version: '1.0', fileName: currentFileName, columnMapping, activeFilters, dashboardWidgets: dashboardWidgets.map(({ chartInstance, keyMap, ...w }) => w) };
        const blob = new Blob([JSON.stringify(reportState, null, 2)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = `config_metrika_${currentFileName}.json`; a.click();
        URL.revokeObjectURL(a.href); showToast(LANG.toastConfigSaved);
    };
    
    const applyState = (state) => {
        if (state.fileName !== currentFileName) { showToast(LANG.errorLoadConfigFirst, 'error'); return; }
        clearDashboard(); columnMapping = state.columnMapping; activeFilters = state.activeFilters || {};
        crossFilter = null; detectColumnTypes(); initializeGrid();
        populateColumnList(); populateFilters(state.activeFilters);
        state.dashboardWidgets.forEach(widgetState => {
            widgetCounter++; const widgetId = `widget-${widgetCounter}`;
            const newWidget = { id: widgetId, ...widgetState, chartInstance: null, keyMap: {} };
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
        const originalAnimation = Chart.defaults.animation;
        Chart.defaults.animation = false;
        setTimeout(() => {
            const promises = dashboardWidgets.map(widget => {
                const widgetEl = document.querySelector(`.grid-stack-item[gs-id="${widget.id}"] .widget-content`);
                if (!widgetEl) return Promise.resolve(null);
                if (widget.chartInstance) {
                    const imgData = widget.chartInstance.toBase64Image();
                    return Promise.resolve(`<div class="widget"><h2>${widget.customTitle || widget.title}</h2><img src="${imgData}" style="width:100%; height:auto;"></div>`);
                } else if (widget.chartType === 'table') {
                    return Promise.resolve(`<div class="widget"><h2>${widget.customTitle || widget.title}</h2>${widgetEl.innerHTML}</div>`);
                }
                return Promise.resolve(null);
            });
            Promise.all(promises).then(widgetsHtml => {
                Chart.defaults.animation = originalAnimation;
                const exportHTML = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Reporte Metrika</title><style>body{font-family:sans-serif;margin:20px}h1{color:#003da5}#dashboard{display:grid;grid-template-columns:repeat(auto-fit,minmax(450px,1fr));gap:20px}.widget{background-color:white;padding:15px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1)}h2{font-size:1.2em}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px}</style></head><body><h1>Reporte Metrika</h1><div id="dashboard">${widgetsHtml.filter(Boolean).join('')}</div></body></html>`;
                const blob = new Blob([exportHTML], { type: 'text/html' });
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
                a.download = 'reporte_metrika.html'; a.click();
                URL.revokeObjectURL(a.href);
            });
        }, 500);
    };

    const exportDetailedData = () => {
        const data = getFilteredData();
        const headers = Object.keys(columnMapping);
        let table = '<table><thead><tr>';
        headers.forEach(h => { table += `<th>${columnMapping[h]}</th>`; });
        table += '</tr></thead><tbody>';
        data.forEach(row => {
            table += '<tr>';
            headers.forEach(h => { table += `<td>${row[h] !== null ? row[h] : ''}</td>`; });
            table += '</tr>';
        });
        table += '</tbody></table>';
        const finalHtml = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Datos Exportados</title><style>body{font-family:sans-serif}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px}</style></head><body>${table}</body></html>`;
        const blob = new Blob([finalHtml], { type: 'text/html' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = 'datos_filtrados_metrika.html'; a.click();
        URL.revokeObjectURL(a.href);
    };
    
    // --- PUNTO DE ENTRADA DE LA APLICACIÓN ---
    const init = () => {
        populateDomReferences();
        DOM.fileInput.addEventListener('change', (e) => handleFileSelect(e, 'data'));
        DOM.loadConfigInput.addEventListener('change', (e) => handleFileSelect(e, 'config'));
        DOM.newReportBtn.addEventListener('click', () => resetApplication(true));
        DOM.closeAppBtn.addEventListener('click', () => showConfirmationModal(LANG.confirmCloseApp, () => window.close()));
        DOM.addVizBtn.addEventListener('click', addVisualizationWidget);
        [DOM.xAxisDropzone, DOM.yAxisDropzone].forEach(z => {
            z.addEventListener('dragover', handleDragOver);
            z.addEventListener('drop', handleDrop);
        });
        DOM.chartTypeSelect.addEventListener('change', updateActiveWidgetConfig);
        DOM.aggregationMenu.addEventListener('click', handleAggregationSelect);
        document.addEventListener('click', () => { if (DOM.aggregationMenu.style.display === 'block') { DOM.aggregationMenu.style.display = 'none'; }});
        DOM.saveConfigBtn.addEventListener('click', saveConfiguration);
        DOM.exportReportBtn.addEventListener('click', exportDashboard);
        DOM.exportDataBtn.addEventListener('click', exportDetailedData);
        DOM.renameCancelBtn.addEventListener('click', () => hideModal(DOM.renameModalOverlay));
        DOM.renameOkBtn.addEventListener('click', processRename);
        DOM.renameModalOverlay.addEventListener('click', (e) => { if (e.target === DOM.renameModalOverlay) hideModal(DOM.renameModalOverlay); });
        DOM.confirmCancelBtn.addEventListener('click', () => hideModal(DOM.confirmModalOverlay));
        DOM.confirmOkBtn.addEventListener('click', processConfirm);
        DOM.confirmModalOverlay.addEventListener('click', (e) => { if (e.target === DOM.confirmModalOverlay) hideModal(DOM.confirmModalOverlay); });
        ['input', 'change'].forEach(evt => {
            [DOM.customTitleInput, DOM.showTitleToggle, DOM.showLegendToggle, DOM.legendPositionSelect, DOM.colorPaletteSelect].forEach(el => {
                el.addEventListener(evt, applyCustomization);
            });
        });
        DOM.closeCustomizationBtn.addEventListener('click', hideCustomizationPanel);
    };

    init();
});