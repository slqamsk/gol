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
            saveToLocalStorage(); // пересохраним отсортированными
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

// ---- МОДАЛЬНОЕ ОКНО ПОДТВЕРЖДЕНИЯ ----
function showConfirm(message) {
    return new Promise((resolve) => {
        confirmMessage.textContent = message;
        confirmModal.classList.add('active');
        pendingConfirmCallback = resolve;
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
}

init();