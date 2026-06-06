const CATEGORIES_KEY = 'time-tracker-categories';
const SCHEDULES_KEY = 'time-tracker-schedules';

let categoriesData = null;       // объект TimeTrackerData (ranks, categories, activity_types)
let schedulesRoot = null;        // SchedulesRoot
let currentDate = null;          // текущая выбранная дата YYYY-MM-DD
let currentSchedule = null;      // ScheduleEntry или null

// DOM элементы
const statusBox = document.getElementById('status-box');
const currentDateDisplay = document.getElementById('current-date-display');
const activitiesContainer = document.getElementById('activities-container');
const legendContainer = document.getElementById('legend-content');
const selectDayBtn = document.getElementById('select-day-btn');
const todayBtn = document.getElementById('today-btn');
const dateModal = document.getElementById('date-modal');
const dateListDiv = document.getElementById('date-list');
const modalSelectBtn = document.getElementById('modal-select-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');

// Вспомогательные функции
function showStatus(msg, isError = false) {
    statusBox.textContent = msg;
    statusBox.className = `status ${isError ? 'error' : 'success'}`;
    statusBox.style.display = 'block';
}

function clearStatus() {
    statusBox.style.display = 'none';
}

// Загрузка справочника
function loadCategories() {
    const stored = localStorage.getItem(CATEGORIES_KEY);
    if (!stored) {
        showStatus('Ошибка: справочник активностей (time-tracker-categories) не найден в localStorage', true);
        return false;
    }
    try {
        const parsed = JSON.parse(stored);
        if (parsed && Array.isArray(parsed.ranks) && Array.isArray(parsed.categories) && Array.isArray(parsed.activity_types)) {
            categoriesData = parsed;
            return true;
        } else {
            showStatus('Ошибка: структура справочника не соответствует формату', true);
            return false;
        }
    } catch(e) {
        showStatus(`Ошибка парсинга справочника: ${e.message}`, true);
        return false;
    }
}

// Загрузка расписаний
function loadSchedules() {
    const stored = localStorage.getItem(SCHEDULES_KEY);
    if (!stored) {
        schedulesRoot = { current_datetime: new Date().toISOString(), schedules: [] };
        localStorage.setItem(SCHEDULES_KEY, JSON.stringify(schedulesRoot));
        showStatus('Создан новый пустой объект расписаний');
        return true;
    }
    try {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed.current_datetime === 'string' && Array.isArray(parsed.schedules)) {
            schedulesRoot = parsed;
            // сортируем по датам
            schedulesRoot.schedules.sort((a,b) => a.date.localeCompare(b.date));
            return true;
        } else {
            showStatus('Ошибка: структура расписаний не соответствует формату', true);
            return false;
        }
    } catch(e) {
        showStatus(`Ошибка парсинга расписаний: ${e.message}`, true);
        return false;
    }
}

// Получить цвет категории (наследование от ранга)
function getCategoryColor(categoryId) {
    const category = categoriesData.categories.find(c => c.id === categoryId);
    if (!category) return '#cccccc';
    if (category.color) return category.color;
    const rank = categoriesData.ranks.find(r => r.id === category.rank_id);
    return rank ? rank.color : '#cccccc';
}

// Получить название активности по activityTypeId
function getActivityName(activityTypeId) {
    const act = categoriesData.activity_types.find(a => a.id === activityTypeId);
    return act ? act.name : `ID:${activityTypeId}`;
}

// Рендер легенды (ранги + категории)
function renderLegend() {
    if (!categoriesData) return;
    let html = '';
    for (const rank of categoriesData.ranks) {
        const rankColor = rank.color;
        const categoriesForRank = categoriesData.categories.filter(c => c.rank_id === rank.id);
        html += `<div class="rank-item">
                    <div class="rank-name" style="background-color: ${rankColor}; color: #fff; padding: 4px 8px;">
                        ${rank.id}. ${rank.name} <span class="coeff">(коэфф: ${rank.coefficient})</span>
                    </div>`;
        for (const cat of categoriesForRank) {
            const catColor = cat.color || rankColor;
            html += `<div class="category-item" style="background-color: ${catColor}; color: #000;">
                        ${cat.id}. ${cat.name}
                    </div>`;
        }
        html += `</div>`;
    }
    legendContainer.innerHTML = html;
}

// Отрисовка активностей на шкале
function renderActivities() {
    activitiesContainer.innerHTML = '';
    if (!currentSchedule || !currentSchedule.schedule || !currentSchedule.schedule.activities.length) {
        return;
    }
    const activities = currentSchedule.schedule.activities;
    // Сортировка по start для корректного z-index (опционально)
    activities.sort((a,b) => a.start - b.start);
    for (const act of activities) {
        const top = act.start;          // пиксели от верха
        const height = act.delta;
        const bgColor = getCategoryColorForActivity(act.activityTypeId);
        const activityName = getActivityName(act.activityTypeId);
        const startTime = formatMinutesToTime(act.start);
        const endTime = formatMinutesToTime(act.end);
        const deltaHours = (act.delta / 60).toFixed(1);
        let commentHtml = act.comment ? `<br><small>${act.comment}</small>` : '';
        let statusClass = '';
        if (act.status === 'done') statusClass = 'done';
        if (act.status === 'in_progress') statusClass = 'in-progress';
        
        const block = document.createElement('div');
        block.className = `activity-block ${statusClass}`;
        block.style.top = `${top}px`;
        block.style.height = `${height}px`;
        block.style.backgroundColor = bgColor;
        // контрастный текст (упрощённо)
        block.style.color = getContrastColor(bgColor);
        block.innerHTML = `<strong>${startTime}–${endTime} (${deltaHours}ч)</strong><br>${activityName}${commentHtml}`;
        block.dataset.id = act.id;
        // позже добавим обработчики двойного клика и перетаскивания (раздел 7)
        activitiesContainer.appendChild(block);
    }
}

// Вспомогательная: получить цвет категории для activityTypeId
function getCategoryColorForActivity(activityTypeId) {
    const act = categoriesData.activity_types.find(a => a.id === activityTypeId);
    if (!act) return '#cccccc';
    const cat = categoriesData.categories.find(c => c.id === act.category_id);
    if (!cat) return '#cccccc';
    return getCategoryColor(cat.id);
}

function formatMinutesToTime(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
}

// Простейший контраст (чёрный/белый)
function getContrastColor(hexColor) {
    if (!hexColor) return '#000';
    // если цвет передан в виде имени, преобразуем во что-то (упрощённо – вернём чёрный для светлых)
    // для реальной реализации лучше использовать библиотеку, но для демо так
    return '#000';
}

// Загрузить расписание для выбранной даты
function loadScheduleForDate(date) {
    currentDate = date;
    currentDateDisplay.textContent = date;
    const entry = schedulesRoot.schedules.find(s => s.date === date);
    if (entry) {
        currentSchedule = entry;
        renderActivities();
        showStatus(`Загружено расписание на ${date}`);
    } else {
        currentSchedule = null;
        activitiesContainer.innerHTML = '';
        showStatus(`Расписания на ${date} ещё нет`, false);
    }
}

// Обновить список дат в модальном окне
function updateDateListModal() {
    if (!schedulesRoot) return;
    const dates = schedulesRoot.schedules.map(s => s.date);
    if (dates.length === 0) {
        dateListDiv.innerHTML = '<p>Нет сохранённых расписаний</p>';
        return;
    }
    let html = '';
    dates.forEach(date => {
        html += `<div class="date-option">
                    <input type="radio" name="selectedDate" value="${date}" id="date_${date}">
                    <label for="date_${date}">${date}</label>
                 </div>`;
    });
    dateListDiv.innerHTML = html;
}

// Открыть модальное окно выбора даты
function openDateModal() {
    updateDateListModal();
    dateModal.classList.add('active');
}

function closeDateModal() {
    dateModal.classList.remove('active');
}

// Выбрать дату из модального окна
function selectDateFromModal() {
    const selectedRadio = document.querySelector('input[name="selectedDate"]:checked');
    if (!selectedRadio) {
        showStatus('Пожалуйста, выберите дату', true);
        return;
    }
    const date = selectedRadio.value;
    closeDateModal();
    loadScheduleForDate(date);
}

// Установить сегодняшнюю дату
function setToday() {
    const today = new Date().toISOString().slice(0,10);
    currentDate = today;
    currentDateDisplay.textContent = today;
    const entry = schedulesRoot.schedules.find(s => s.date === today);
    if (entry) {
        currentSchedule = entry;
        renderActivities();
        showStatus(`Загружено расписание на сегодня (${today})`);
    } else {
        currentSchedule = null;
        activitiesContainer.innerHTML = '';
        showStatus(`Расписания за сегодня (${today}) ещё нет`, false);
    }
}

// Инициализация
function init() {
    if (!loadCategories()) return;
    if (!loadSchedules()) return;
    renderLegend();
    // По умолчанию – сегодня
    setToday();
    // Обработчики
    selectDayBtn.onclick = openDateModal;
    todayBtn.onclick = setToday;
    modalSelectBtn.onclick = selectDateFromModal;
    modalCancelBtn.onclick = closeDateModal;
    // Закрытие модалки по клику на фон
    dateModal.onclick = (e) => {
        if (e.target === dateModal) closeDateModal();
    };
}

init();