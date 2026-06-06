// Константы и глобальное состояние
const CATEGORIES_KEY = 'time-tracker-categories';
const SCHEDULES_KEY = 'time-tracker-schedules';

let categoriesData = null;
let schedulesRoot = null;
let currentDate = null;
let currentActivities = null; // массив активностей для текущего дня

// Иерархическая структура для легенды
let ranksHierarchy = [];

// DOM элементы
const statusBox = document.getElementById('status-box');
const currentDateDisplay = document.getElementById('current-date-display');
const blocksContainer = document.getElementById('blocks-container');
const legendContainer = document.getElementById('legend');
const ticksContainer = document.getElementById('ticks-container');
const labelsContainer = document.getElementById('labels-container');
const currentTimeLine = document.getElementById('current-time-line');
const currentTimeBadge = document.getElementById('current-time-badge');
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

function formatMinutesToTime(minutes) {
    minutes = Math.max(0, Math.min(minutes, 1440));
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function timeStrToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + (m || 0);
}

function formatDuration(minutes) {
    const total = Math.max(0, Math.round(minutes));
    return `${Math.floor(total / 60).toString().padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
}

function getContrastColor(hexOrName) {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = hexOrName;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#0f172a' : '#ffffff';
}

// Загрузка справочника и построение иерархии
function loadCategories() {
    const stored = localStorage.getItem(CATEGORIES_KEY);
    if (!stored) {
        showStatus('Ошибка: справочник активностей не найден в localStorage', true);
        return false;
    }
    try {
        const parsed = JSON.parse(stored);
        if (!parsed.ranks || !parsed.categories || !parsed.activity_types) {
            throw new Error('Неверная структура справочника');
        }
        categoriesData = parsed;
        // Построение иерархии
        const ranksMap = new Map();
        for (const rank of categoriesData.ranks) {
            ranksMap.set(rank.id, {
                id: rank.id,
                name: rank.name,
                coefficient: rank.coefficient,
                color: rank.color,
                categories: []
            });
        }
        for (const cat of categoriesData.categories) {
            const rank = ranksMap.get(cat.rank_id);
            if (rank) {
                rank.categories.push({
                    id: cat.id,
                    name: cat.name,
                    color: cat.color || rank.color,
                    activities: []
                });
            }
        }
        for (const act of categoriesData.activity_types) {
            for (const rank of ranksMap.values()) {
                const category = rank.categories.find(c => c.id === act.category_id);
                if (category) {
                    category.activities.push(act.name);
                    break;
                }
            }
        }
        ranksHierarchy = Array.from(ranksMap.values());
        return true;
    } catch (e) {
        showStatus(`Ошибка загрузки справочника: ${e.message}`, true);
        return false;
    }
}

// Загрузка расписаний из localStorage
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
            schedulesRoot.schedules.sort((a, b) => a.date.localeCompare(b.date));
            return true;
        } else {
            showStatus('Ошибка: структура расписаний не соответствует формату', true);
            return false;
        }
    } catch (e) {
        showStatus(`Ошибка парсинга расписаний: ${e.message}`, true);
        return false;
    }
}

// Получить цвет для activityTypeId
function getColorForActivityType(activityTypeId) {
    const act = categoriesData.activity_types.find(a => a.id === activityTypeId);
    if (!act) return '#cccccc';
    const cat = categoriesData.categories.find(c => c.id === act.category_id);
    if (!cat) return '#cccccc';
    const rank = categoriesData.ranks.find(r => r.id === cat.rank_id);
    const color = cat.color || (rank ? rank.color : '#cccccc');
    return color;
}

function getActivityName(activityTypeId) {
    const act = categoriesData.activity_types.find(a => a.id === activityTypeId);
    return act ? act.name : `ID:${activityTypeId}`;
}

function getRankAndCategoryLabels(activityTypeId) {
    const act = categoriesData.activity_types.find(a => a.id === activityTypeId);
    if (!act) return { rankName: '', catName: '' };
    const cat = categoriesData.categories.find(c => c.id === act.category_id);
    if (!cat) return { rankName: '', catName: '' };
    const rank = categoriesData.ranks.find(r => r.id === cat.rank_id);
    return {
        rankName: rank ? rank.name : '',
        catName: cat.name
    };
}

// Рендер легенды
function renderLegend() {
    let html = '';
    for (const rank of ranksHierarchy) {
        html += `<div class="legend-rank">
                    <div class="legend-rank-title">
                        <div class="dot" style="background: ${rank.color}"></div>
                        <span>${rank.name} (×${rank.coefficient})</span>
                    </div>
                    <div class="legend-subcats">`;
        for (const cat of rank.categories) {
            html += `<div class="legend-sub">
                        <div class="dot" style="background: ${cat.color}"></div>
                        <span>${cat.name}</span>
                     </div>`;
        }
        html += `</div></div>`;
    }
    legendContainer.innerHTML = html;
}

// Алгоритм расчёта колонок для непересекающегося расположения
function calculateColumns(activities) {
    const sorted = [...activities].sort((a, b) => a.start - b.start);
    const ends = [];
    sorted.forEach(act => {
        const s = act.start;
        const e = act.end;
        let col = 0;
        while (ends[col] && ends[col] > s) col++;
        ends[col] = e;
        act._col = col;
    });
    return sorted;
}

// Рендер блоков
function renderActivities() {
    blocksContainer.innerHTML = '';
    if (!currentActivities || currentActivities.length === 0) return;

    const acts = currentActivities.map(act => ({
        ...act,
        start: act.start,
        end: act.end,
        delta: act.delta,
        status: act.status,
        comment: act.comment,
        activityTypeId: act.activityTypeId
    }));
    const sortedActs = calculateColumns(acts);
    const blockWidth = 500;
    const gap = 12;
    const maxCol = Math.max(0, ...sortedActs.map(a => a._col || 0));
    blocksContainer.style.width = `${(maxCol + 1) * (blockWidth + gap)}px`;

    for (const act of sortedActs) {
        const top = act.start;
        const height = Math.max(4, act.delta);
        const bgColor = getColorForActivityType(act.activityTypeId);
        const textColor = getContrastColor(bgColor);
        const name = getActivityName(act.activityTypeId);
        const { rankName, catName } = getRankAndCategoryLabels(act.activityTypeId);
        const tagContent = catName ? `${rankName} — ${catName}` : rankName;
        const startTime = formatMinutesToTime(act.start);
        const endTime = formatMinutesToTime(act.end);
        const commentHtml = act.comment ? `<div class="block-comment">💬 ${act.comment}</div>` : '';
        const statusClass = `status-${act.status}`;

        const block = document.createElement('div');
        block.className = `activity-block ${statusClass}`;
        block.style.cssText = `left: ${(act._col || 0) * (blockWidth + gap)}px; top: ${top}px; height: ${height}px; width: ${blockWidth}px; background-color: ${bgColor}; color: ${textColor};`;
        block.innerHTML = `<div class="block-content">
            <span class="block-time">${startTime} — ${endTime}</span>
            <span class="block-delta">${formatDuration(act.delta)}</span>
            <span class="block-rank-tag">${tagContent}</span>
            <span class="block-name">${name}</span>
        </div>${commentHtml}`;
        blocksContainer.appendChild(block);
    }
}

// Отрисовка шкалы времени
function renderTimelineTicks() {
    ticksContainer.innerHTML = '';
    labelsContainer.innerHTML = '';
    for (let m = 0; m <= 1440; m += 5) {
        const top = m; // 1 минута = 1px
        const isHour = m % 60 === 0;
        const tick = document.createElement('div');
        tick.className = isHour ? 'tick major' : 'tick minor';
        tick.style.top = `${top}px`;
        ticksContainer.appendChild(tick);
        if (isHour) {
            const label = document.createElement('div');
            label.className = 'time-label';
            label.textContent = formatMinutesToTime(m);
            label.style.top = `${top}px`;
            labelsContainer.appendChild(label);
        }
    }
}

// Обновление линии текущего времени (только для сегодня)
function updateCurrentTimeLine() {
    const today = new Date().toISOString().slice(0, 10);
    if (currentDate !== today) {
        currentTimeLine.style.display = 'none';
        return;
    }
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const top = minutes;
    if (top >= 0 && top <= 1440) {
        currentTimeLine.style.display = 'block';
        currentTimeLine.style.top = `${top}px`;
        currentTimeBadge.textContent = formatMinutesToTime(minutes);
    } else {
        currentTimeLine.style.display = 'none';
    }
}

// Загрузка расписания для выбранной даты
function loadScheduleForDate(date) {
    currentDate = date;
    currentDateDisplay.textContent = date;
    const entry = schedulesRoot.schedules.find(s => s.date === date);
    if (entry && entry.schedule && Array.isArray(entry.schedule.activities)) {
        currentActivities = entry.schedule.activities;
        renderActivities();
        showStatus(`Загружено расписание на ${date} (активностей: ${currentActivities.length})`);
    } else {
        currentActivities = [];
        blocksContainer.innerHTML = '';
        showStatus(`Расписания на ${date} ещё нет`, false);
    }
    updateCurrentTimeLine();
}

// --- Модальное окно выбора даты ---
function updateDateListModal() {
    if (!schedulesRoot || !schedulesRoot.schedules) {
        dateListDiv.innerHTML = '<p>Нет сохранённых расписаний</p>';
        return;
    }
    const dates = schedulesRoot.schedules.map(s => s.date).sort();
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

function openDateModal() {
    updateDateListModal();
    dateModal.classList.add('active');
}

function closeDateModal() {
    dateModal.classList.remove('active');
}

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

function setToday() {
    const today = new Date().toISOString().slice(0, 10);
    loadScheduleForDate(today);
}

// --- Инициализация ---
function init() {
    if (!loadCategories()) return;
    if (!loadSchedules()) return;
    renderLegend();
    renderTimelineTicks();

    const today = new Date().toISOString().slice(0, 10);
    loadScheduleForDate(today);

    // Обновление линии времени каждую минуту
    setInterval(() => {
        if (currentDate === new Date().toISOString().slice(0, 10)) {
            updateCurrentTimeLine();
        }
    }, 60000);

    // Обработчики событий
    selectDayBtn.onclick = openDateModal;
    todayBtn.onclick = setToday;
    modalSelectBtn.onclick = selectDateFromModal;
    modalCancelBtn.onclick = closeDateModal;
    dateModal.onclick = (e) => { if (e.target === dateModal) closeDateModal(); };
}

init();