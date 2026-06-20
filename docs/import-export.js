// import-export.js
// Страница для ручного импорта/экспорта расписаний в/из localStorage

const STORAGE_KEY = 'time-tracker-schedules';
let currentSchedulesRoot = null;

// Элементы DOM
const statusBox = document.getElementById('status-box');
const jsonEditor = document.getElementById('json-editor');
const datesContainer = document.getElementById('dates-list');
const loadSingleBtn = document.getElementById('load-single');
const loadMultipleBtn = document.getElementById('load-multiple');
const applySingleBtn = document.getElementById('apply-single');
const applyMultipleBtn = document.getElementById('apply-multiple');
const clearEditorBtn = document.getElementById('clear-editor');
const refreshListBtn = document.getElementById('refresh-list');
const selectAllBtn = document.getElementById('select-all');
const deselectAllBtn = document.getElementById('deselect-all');
const deleteSelectedBtn = document.getElementById('delete-selected');
const deleteScheduleBtn = document.getElementById('delete-schedule');
const copyScheduleBtn = document.getElementById('copy-schedule');
const confirmModal = document.getElementById('confirm-modal');
const confirmMessage = document.getElementById('confirm-message');
const confirmYes = document.getElementById('confirm-yes');
const confirmNo = document.getElementById('confirm-no');

let pendingConfirmCallback = null;

// --- Вспомогательные функции ---

function showStatus(msg, isError = false) {
    statusBox.textContent = msg;
    statusBox.className = `status ${isError ? 'error' : 'success'}`;
    statusBox.style.display = 'block';
}

function formatJSON(data) {
    return JSON.stringify(data, null, '\t');
}

function getActivityName(activityTypeId) {
    // Пытаемся получить имя активности из categoriesData
    // Если categoriesData недоступен, возвращаем ID
    if (typeof categoriesData !== 'undefined' && categoriesData && categoriesData.activity_types) {
        const act = categoriesData.activity_types.find(a => a.id === activityTypeId);
        if (act) return act.name;
    }
    return `ID:${activityTypeId}`;
}

// ---- ВАЛИДАЦИЯ SchedulesRoot (с учётом current_datetime) ----
// Изменение: теперь проверяем наличие поля current_datetime в каждом ScheduleEntry,
// потому что по спецификации оно обязательно.
function isValidSchedulesRoot(data) {
    if (!data || typeof data !== 'object') return false;
    if (typeof data.current_datetime !== 'string') return false;
    if (!Array.isArray(data.schedules)) return false;

    for (const entry of data.schedules) {
        // Обязательные поля для ScheduleEntry: date, current_datetime, schedule.activities
        if (!entry.date || typeof entry.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) return false;
        if (typeof entry.current_datetime !== 'string') return false;
        if (!entry.schedule || typeof entry.schedule !== 'object') return false;
        if (!Array.isArray(entry.schedule.activities)) return false;

        for (const act of entry.schedule.activities) {
            if (typeof act.id !== 'number' || typeof act.activityTypeId !== 'number') return false;
            if (typeof act.start !== 'number' || typeof act.end !== 'number') return false;
            if (act.end <= act.start) return false;
        }
    }
    return true;
}

// ---- ЗАГРУЗКА ДАННЫХ ИЗ LOCALSTORAGE ----
function loadFromLocalStorage() {
    const stored = localStorage.getItem(STORAGE_KEY);

    // отладочный вывод (можно оставить, но не обязательно)
    console.log('Raw stored:', stored);
    console.log('Type:', typeof stored);
    console.log('Length:', stored ? stored.length : 'null');
    if (stored && stored.charCodeAt(0) === 0xFEFF) {
        console.warn('BOM detected at start!');
    }

    if (!stored) {
        // создать пустой объект
        currentSchedulesRoot = {
            current_datetime: getCurrentDateTimeString(),
            schedules: []
        };
        saveToLocalStorage();
        showStatus('В localStorage не было расписаний – создан пустой объект');
        renderDatesList();
        return;
    }

    try {
        const parsed = JSON.parse(stored);
        if (isValidSchedulesRoot(parsed)) {
            currentSchedulesRoot = parsed;
            sortSchedulesByDate();
            saveToLocalStorage();
            showStatus('Данные в localStorage корректны');
            renderDatesList();
        } else {
            // невалидные данные: показать в редакторе, но список не отображаем
            currentSchedulesRoot = null;
            jsonEditor.value = formatJSON(JSON.parse(stored));
            showStatus('Ошибка: структура расписаний не соответствует формату. Содержимое загружено в редактор для исправления.', true);
            datesContainer.innerHTML = '<p style="color:red;">Некорректные данные – список дат недоступен</p>';
        }
    } catch (e) {
        console.error('Parse error details:', e);
        console.error('Problematic string:', stored);
        // невалидный JSON
        currentSchedulesRoot = null;
        jsonEditor.value = stored || '';
        showStatus('Ошибка: невалидный JSON в localStorage. Содержимое загружено в редактор.', true);
        datesContainer.innerHTML = '<p style="color:red;">Некорректные данные – список дат недоступен</p>';
    }
}

function sortSchedulesByDate() {
    if (currentSchedulesRoot && currentSchedulesRoot.schedules) {
        currentSchedulesRoot.schedules.sort((a, b) => a.date.localeCompare(b.date));
    }
}

function saveToLocalStorage() {
    if (currentSchedulesRoot) {
        currentSchedulesRoot.current_datetime = getCurrentDateTimeString();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(currentSchedulesRoot));
    }
}

// ---- ОТРИСОВКА СПИСКА ДАТ С ЧЕКБОКСАМИ ----
function renderDatesList() {
    if (!currentSchedulesRoot || !currentSchedulesRoot.schedules) {
        datesContainer.innerHTML = '<p>Нет данных</p>';
        return;
    }
    const dates = currentSchedulesRoot.schedules.map(s => s.date);
    if (dates.length === 0) {
        datesContainer.innerHTML = '<p>Нет сохранённых дат</p>';
        return;
    }
    let html = '';
    dates.forEach(date => {
        html += `<div class="date-item">
                    <input type="checkbox" value="${date}" id="chk_${date}">
                    <label for="chk_${date}">${date}</label>
                 </div>`;
    });
    datesContainer.innerHTML = html;
}

function getSelectedDates() {
    const checkboxes = document.querySelectorAll('#dates-list input[type="checkbox"]');
    const selected = [];
    checkboxes.forEach(cb => {
        if (cb.checked) selected.push(cb.value);
    });
    return selected;
}

// ---- ЗАГРУЗКА В РЕДАКТОР (ЭКСПОРТ) ----
// Изменение: перед загрузкой расписания в редактор обновляем current_datetime
// для выбранных дат в самом хранилище (потому что экспорт – это взаимодействие).
async function loadSingleDate() {
    const selected = getSelectedDates();
    if (selected.length !== 1) {
        showStatus('Ошибка: выберите ровно одну дату', true);
        return;
    }
    const date = selected[0];
    const entry = currentSchedulesRoot.schedules.find(s => s.date === date);
    if (!entry) {
        showStatus(`Ошибка: дата ${date} не найдена в хранилище`, true);
        return;
    }

    // ---- ОБНОВЛЕНИЕ current_datetime ПРИ ЭКСПОРТЕ ----
    entry.current_datetime = getCurrentDateTimeString();
    saveToLocalStorage();

    jsonEditor.value = formatJSON(entry);
    showStatus(`Загружено расписание для даты ${date}`);
}

async function loadMultipleDates() {
    const selected = getSelectedDates();
    if (selected.length < 2) {
        showStatus('Ошибка: выберите минимум две даты', true);
        return;
    }
    const entries = [];
    for (const date of selected) {
        const entry = currentSchedulesRoot.schedules.find(s => s.date === date);
        if (entry) entries.push(entry);
    }
    if (entries.length !== selected.length) {
        showStatus('Ошибка: некоторые выбранные даты не найдены', true);
        return;
    }

    // ---- ОБНОВЛЕНИЕ current_datetime ДЛЯ КАЖДОЙ ВЫБРАННОЙ ДАТЫ ПРИ ЭКСПОРТЕ ----
    for (const entry of entries) {
        entry.current_datetime = getCurrentDateTimeString();
    }
    saveToLocalStorage();

    jsonEditor.value = formatJSON(entries);
    showStatus(`Загружено расписаний: ${entries.length}`);
}

// ---- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ ПРОВЕРКИ СТРУКТУРЫ ----
function isScheduleEntry(obj) {
    return obj && typeof obj === 'object' && typeof obj.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(obj.date)
        && obj.schedule && typeof obj.schedule === 'object' && Array.isArray(obj.schedule.activities);
}

function isScheduleEntryArray(arr) {
    if (!Array.isArray(arr)) return false;
    return arr.every(item => isScheduleEntry(item));
}

// ---- ПРИМЕНЕНИЕ ОДНОЙ ДАТЫ (ИМПОРТ) ----
// Изменение: при импорте current_datetime всегда перезаписывается текущим временем
async function applySingleDate() {
    const text = jsonEditor.value.trim();
    if (!text) {
        showStatus('Ошибка: редактор пуст', true);
        return;
    }
    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch(e) {
        showStatus(`Ошибка парсинга JSON: ${e.message}`, true);
        return;
    }
    if (!isScheduleEntry(parsed)) {
        showStatus('Ошибка: содержимое редактора не соответствует формату ScheduleEntry', true);
        return;
    }

    const date = parsed.date;
    // ---- ИГНОРИРУЕМ current_datetime ИЗ ИМПОРТА, СТАВИМ ТЕКУЩЕЕ ВРЕМЯ ----
    parsed.current_datetime = getCurrentDateTimeString();

    const existingIndex = currentSchedulesRoot.schedules.findIndex(s => s.date === date);
    if (existingIndex !== -1) {
        const confirmed = await showConfirm(`Дата ${date} уже существует. Перезаписать?`);
        if (!confirmed) return;
        currentSchedulesRoot.schedules[existingIndex] = parsed;
        showStatus(`Расписание для даты ${date} перезаписано`);
    } else {
        currentSchedulesRoot.schedules.push(parsed);
        showStatus(`Расписание для даты ${date} добавлено`);
    }
    sortSchedulesByDate();
    saveToLocalStorage();
    renderDatesList();
    const chk = document.getElementById(`chk_${date}`);
    if (chk) chk.checked = false;
}

// ---- ПРИМЕНЕНИЕ НЕСКОЛЬКИХ ДАТ (ИМПОРТ) ----
async function applyMultipleDates() {
    const text = jsonEditor.value.trim();
    if (!text) {
        showStatus('Ошибка: редактор пуст', true);
        return;
    }
    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch(e) {
        showStatus(`Ошибка парсинга JSON: ${e.message}`, true);
        return;
    }
    if (!isScheduleEntryArray(parsed)) {
        showStatus('Ошибка: содержимое редактора не соответствует массиву ScheduleEntry[]', true);
        return;
    }

    const existingDates = [];
    const newDates = [];
    for (const entry of parsed) {
        const found = currentSchedulesRoot.schedules.some(s => s.date === entry.date);
        if (found) existingDates.push(entry.date);
        else newDates.push(entry.date);
    }
    if (existingDates.length > 0) {
        const msg = `Следующие даты уже существуют:\n${existingDates.join(', ')}\n\nПерезаписать их?`;
        const confirmed = await showConfirm(msg);
        if (!confirmed) return;
    }
    for (const entry of parsed) {
        // ---- ИГНОРИРУЕМ current_datetime ИЗ ИМПОРТА ----
        entry.current_datetime = getCurrentDateTimeString();
        const idx = currentSchedulesRoot.schedules.findIndex(s => s.date === entry.date);
        if (idx !== -1) currentSchedulesRoot.schedules[idx] = entry;
        else currentSchedulesRoot.schedules.push(entry);
    }
    sortSchedulesByDate();
    saveToLocalStorage();
    renderDatesList();
    const allCheckboxes = document.querySelectorAll('#dates-list input[type="checkbox"]');
    allCheckboxes.forEach(cb => cb.checked = false);
    showStatus(`Добавлено дат: ${newDates.length} (${newDates.join(', ') || 'нет'}). Перезаписано дат: ${existingDates.length} (${existingDates.join(', ') || 'нет'})`);
}

// ---- УДАЛЕНИЕ ВЫБРАННЫХ РАСПИСАНИЙ ----
async function deleteSelectedDates() {
    const selected = getSelectedDates();
    if (selected.length === 0) {
        showStatus('Ошибка: не выбрано ни одной даты', true);
        return;
    }
    const msg = `Вы действительно хотите удалить расписания для следующих дат?\n${selected.join(', ')}`;
    const confirmed = await showConfirm(msg);
    if (!confirmed) return;

    const newSchedules = currentSchedulesRoot.schedules.filter(s => !selected.includes(s.date));
    const deletedCount = currentSchedulesRoot.schedules.length - newSchedules.length;
    currentSchedulesRoot.schedules = newSchedules;
    sortSchedulesByDate();
    saveToLocalStorage();
    renderDatesList();
    showStatus(`Удалено расписаний: ${deletedCount} (${selected.join(', ')})`);
    jsonEditor.value = '';
}

// ---- УДАЛЕНИЕ ОДНОЙ ДАТЫ (С ДВУМЯ ПРЕДУПРЕЖДЕНИЯМИ) ----
async function deleteSelectedDate() {
    const selected = getSelectedDates();
    if (selected.length !== 1) {
        showStatus('Ошибка: выберите ровно одну дату', true);
        return;
    }
    const date = selected[0];
    const entry = currentSchedulesRoot.schedules.find(s => s.date === date);
    if (!entry) {
        showStatus(`Ошибка: дата ${date} не найдена в хранилище`, true);
        return;
    }
    
    const activities = entry.schedule.activities || [];

    if (activities.length === 0) {
        // ---- УДАЛЯЕМ ПУСТОЕ РАСПИСАНИЕ С СООБЩЕНИЕМ ----
        currentSchedulesRoot.schedules = currentSchedulesRoot.schedules.filter(s => s.date !== date);
        sortSchedulesByDate();
        saveToLocalStorage();
        renderDatesList();
        jsonEditor.value = '';
        const chk = document.getElementById(`chk_${date}`);
        if (chk) chk.checked = false;
        showStatus(`Расписание за ${date} пустое и было удалено`, false);
        return;
    }


    // ---- ПЕРВОЕ ПРЕДУПРЕЖДЕНИЕ: список активностей ----
    let activitiesList = activities.map((act, index) => {
        const name = getActivityName(act.activityTypeId);
        const time = `${formatMinutesToTime(act.start)} — ${formatMinutesToTime(act.end)}`;
        return `  ${index + 1}. ${name} (${time})`;
    }).join('\n');
    
    const firstConfirm = await showConfirmWithList(
        `В расписании за ${date} есть следующие активности:`,
        activitiesList,
        `Точно хотите удалить день с ${activities.length} активностями?`
    );


    if (!firstConfirm) {
        const chk = document.getElementById(`chk_${date}`);
        if (chk) chk.checked = false;
        return;
    }
    
    // ---- ВТОРОЕ ПРЕДУПРЕЖДЕНИЕ: подтверждение удаления ----
    const secondConfirm = await showConfirm(
        `Вы решили удалить день ${date} с ${activities.length} активностями. Подтвердите удаление.`
    );
    if (!secondConfirm) {
        const chk = document.getElementById(`chk_${date}`);
        if (chk) chk.checked = false;
        return;
    }
    
    // ---- УДАЛЕНИЕ ----
    currentSchedulesRoot.schedules = currentSchedulesRoot.schedules.filter(s => s.date !== date);
    sortSchedulesByDate();
    saveToLocalStorage();
    renderDatesList();
    jsonEditor.value = '';
    showStatus(`Расписание за ${date} удалено (активностей: ${activities.length})`);
}

// ---- КОПИРОВАНИЕ РАСПИСАНИЯ ----
async function copySchedule() {
    // 1. Проверяем, что в редакторе есть данные
    const text = jsonEditor.value.trim();
    if (!text) {
        showStatus('Ошибка: редактор пуст. Сначала загрузите расписание.', true);
        return;
    }
    
    // 2. Парсим JSON
    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch(e) {
        showStatus(`Ошибка парсинга JSON: ${e.message}`, true);
        return;
    }
    
    // 3. Проверяем, что это ScheduleEntry (одна дата)
    if (!isScheduleEntry(parsed)) {
        showStatus('Ошибка: содержимое редактора не соответствует формату ScheduleEntry (одна дата).', true);
        return;
    }
    
    // 4. Проверяем, что в расписании есть активности
    const activities = parsed.schedule.activities || [];
    if (activities.length === 0) {
        showStatus('Ошибка: расписание пустое (нет активностей). Копировать нечего.', true);
        return;
    }
    
    // 5. Спрашиваем дату для копирования
    const targetDate = await showDatePicker('Введите дату для копирования расписания:');
    if (!targetDate) {
        showStatus('Копирование отменено');
        return;
    }
    
    // 6. Проверяем, что на эту дату нет расписания в localStorage
    const existing = currentSchedulesRoot.schedules.find(s => s.date === targetDate);
    if (existing) {
        showStatus(`Невозможно скопировать, перед копированием удалите расписание за ${targetDate}`, true);
        return;
    }
    
    // 7. Создаём копию расписания
    const copyEntry = {
        date: targetDate,
        current_datetime: getCurrentDateTimeString(),
        schedule: {
            activities: activities.map(act => ({
                ...act,
                id: act.id,
                status: 'planned'
            }))
        }
    };
    
    // 8. Добавляем в хранилище
    currentSchedulesRoot.schedules.push(copyEntry);
    sortSchedulesByDate();
    saveToLocalStorage();
    renderDatesList();
    
    // 9. Очищаем чекбоксы
    const allCheckboxes = document.querySelectorAll('#dates-list input[type="checkbox"]');
    allCheckboxes.forEach(cb => cb.checked = false);
    
    // 10. Выводим сообщение
    showStatus(`Расписание скопировано с ${parsed.date} на ${targetDate} (активностей: ${activities.length})`);
}

// ---- МОДАЛЬНОЕ ОКНО ПОДТВЕРЖДЕНИЯ (ОБЫЧНОЕ) ----
function showConfirm(message) {
    return new Promise((resolve) => {
        confirmMessage.textContent = message;
        confirmModal.classList.add('active');
        pendingConfirmCallback = resolve;
    });
}

// ---- МОДАЛЬНОЕ ОКНО С ПОДТВЕРЖДЕНИЕМ И СПИСКОМ ----
function showConfirmWithList(title, list, question) {
    return new Promise((resolve) => {
        const listItems = list.split('\n').map(item => `<li>${item}</li>`).join('');
        confirmMessage.innerHTML = `
            <strong>${title}</strong>
            <ul style="margin: 10px 0 10px 20px; max-height: 200px; overflow-y: auto; font-size: 13px; font-family: monospace;">
                ${listItems}
            </ul>
            <p style="margin-top: 10px;"><strong>${question}</strong></p>
        `;
        confirmModal.classList.add('active');
        pendingConfirmCallback = resolve;
    });
}

// ---- МОДАЛЬНОЕ ОКНО С ВЫБОРОМ ДАТЫ ----
function showDatePicker(label) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.style.display = 'flex';
        
        const content = document.createElement('div');
        content.className = 'modal-content';
        content.style.maxWidth = '400px';
        
        content.innerHTML = `
            <h3>${label}</h3>
            <div style="margin: 15px 0;">
                <input type="date" id="date-picker-input" style="width: 100%; padding: 8px; font-size: 16px;">
            </div>
            <div class="modal-buttons">
                <button id="date-picker-ok" class="button">Копировать</button>
                <button id="date-picker-cancel" class="button secondary">Отмена</button>
            </div>
        `;
        
        overlay.appendChild(content);
        document.body.appendChild(overlay);
        
        const input = document.getElementById('date-picker-input');
        const today = getCurrentDateTimeString().slice(0, 10);
        input.value = today;
        input.focus();
        
        const okBtn = document.getElementById('date-picker-ok');
        const cancelBtn = document.getElementById('date-picker-cancel');
        
        const cleanup = () => {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        };
        
        okBtn.onclick = () => {
            const value = input.value;
            cleanup();
            resolve(value || null);
        };
        
        cancelBtn.onclick = () => {
            cleanup();
            resolve(null);
        };
        
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                cleanup();
                resolve(null);
            }
        };
        
        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                okBtn.click();
            }
        };
    });
}

function closeModal() {
    confirmModal.classList.remove('active');
    if (pendingConfirmCallback) {
        pendingConfirmCallback(false);
        pendingConfirmCallback = null;
    }
}

confirmYes.onclick = () => {
    confirmModal.classList.remove('active');
    if (pendingConfirmCallback) {
        pendingConfirmCallback(true);
        pendingConfirmCallback = null;
    }
};
confirmNo.onclick = closeModal;
confirmModal.onclick = (e) => {
    if (e.target === confirmModal) closeModal();
};

function clearEditor() {
    jsonEditor.value = '';
    showStatus('Редактор очищен');
}

function refreshList() {
    loadFromLocalStorage();
    showStatus('Список дат обновлён');
}

function selectAll() {
    const checkboxes = document.querySelectorAll('#dates-list input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = true);
}

function deselectAll() {
    const checkboxes = document.querySelectorAll('#dates-list input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
}

// ---- ИНИЦИАЛИЗАЦИЯ ----
function init() {
    loadFromLocalStorage();
    loadSingleBtn.onclick = loadSingleDate;
    loadMultipleBtn.onclick = loadMultipleDates;
    applySingleBtn.onclick = applySingleDate;
    applyMultipleBtn.onclick = applyMultipleDates;
    clearEditorBtn.onclick = clearEditor;
    refreshListBtn.onclick = refreshList;
    selectAllBtn.onclick = selectAll;
    deselectAllBtn.onclick = deselectAll;
    if (deleteSelectedBtn) deleteSelectedBtn.onclick = deleteSelectedDates;
    if (deleteScheduleBtn) deleteScheduleBtn.onclick = deleteSelectedDate;
    if (copyScheduleBtn) copyScheduleBtn.onclick = copySchedule;
}

init();