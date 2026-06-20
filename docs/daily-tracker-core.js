// daily-tracker-core.js
// Константы, глобальное состояние и вспомогательные утилиты

// Константы
const CATEGORIES_KEY = 'time-tracker-categories';
const SCHEDULES_KEY = 'time-tracker-schedules';

// Глобальное состояние
let categoriesData = null;
let schedulesRoot = null;
let currentDate = null;
let currentActivities = null;
let ranksHierarchy = [];

// Состояние для редактора активностей
let currentEditingId = null;

// Вспомогательные функции
function showStatus(msg, isError = false) {
    const statusBox = document.getElementById('status-box');
    statusBox.textContent = msg;
    statusBox.className = `status ${isError ? 'error' : 'success'}`;
    statusBox.style.display = 'block';
}

function clearStatus() {
    const statusBox = document.getElementById('status-box');
    statusBox.style.display = 'none';
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

// ==================== Drag and Drop State ====================
let dragState = {
    active: false,
    originalStart: 0,
    originalEnd: 0,
    originalDelta: 0,
    originalActivity: null,
    startClientY: 0,
    element: null,
    activityId: null,
    cancelFlag: false
};

// ==================== Отложенное перетаскивание (для предотвращения конфликта с двойным кликом) ====================
let pendingDrag = {
    timer: null,
    moveHandler: null,
    cancel: false
};

function cancelPendingDrag() {
    if (pendingDrag.timer) {
        clearTimeout(pendingDrag.timer);
        pendingDrag.timer = null;
    }
    if (pendingDrag.moveHandler) {
        window.removeEventListener('mousemove', pendingDrag.moveHandler);
        pendingDrag.moveHandler = null;
    }
    pendingDrag.cancel = true;
    // Сбросим флаг через короткое время, чтобы не мешать следующим кликам
    setTimeout(() => { pendingDrag.cancel = false; }, 50);
}

function startDrag(activity, element, clientY) {
    if (dragState.active) return;
    dragState.active = true;
    dragState.originalStart = activity.start;
    dragState.originalEnd = activity.end;
    dragState.originalDelta = activity.delta;
    dragState.originalActivity = { ...activity };
    dragState.startClientY = clientY;
    dragState.element = element;
    dragState.activityId = activity.id;
    dragState.cancelFlag = false;

    element.style.transition = 'none';
    element.style.willChange = 'transform';

    element.style.cursor = 'grabbing';
    element.style.zIndex = '1000';
    document.body.style.cursor = 'grabbing';

    document.body.style.userSelect = 'none';

    window.addEventListener('mousemove', onGlobalMouseMove);
    window.addEventListener('mouseup', onGlobalMouseUp);
    window.addEventListener('keydown', onGlobalKeyDown);
}

function onGlobalMouseMove(e) {
    if (!dragState.active) return;
    e.preventDefault();

    const deltaY = e.clientY - dragState.startClientY;
    let newStart = dragState.originalStart + deltaY;
    let newEnd = dragState.originalEnd + deltaY;

    if (newStart < 0) {
        newStart = 0;
        newEnd = dragState.originalDelta;
    }
    if (newEnd > 1440) {
        newEnd = 1440;
        newStart = 1440 - dragState.originalDelta;
    }
    if (newStart < 0) newStart = 0;
    if (newEnd > 1440) newEnd = 1440;

    const actualDeltaMinutes = newStart - dragState.originalStart;
    if (dragState.element) {
        dragState.element.style.transform = `translateY(${actualDeltaMinutes}px)`;
    }
    dragState.tempStart = newStart;
    dragState.tempEnd = newEnd;
}

function onGlobalMouseUp(e) {
    if (!dragState.active) return;
    const isInsideTracker = e.target.closest ? e.target.closest('#timeline-wrapper') : false;
    if (!isInsideTracker) {
        dragState.cancelFlag = true;
    }
    endDrag();
}

function onGlobalKeyDown(e) {
    if (!dragState.active) return;
    if (e.key === 'Escape') {
        dragState.cancelFlag = true;
        endDrag();
    }
}

async function endDrag() {
    if (!dragState.active) return;

    window.removeEventListener('mousemove', onGlobalMouseMove);
    window.removeEventListener('mouseup', onGlobalMouseUp);
    window.removeEventListener('keydown', onGlobalKeyDown);
    document.body.style.userSelect = '';

    const element = dragState.element;
    const cancel = dragState.cancelFlag;
    const originalAct = dragState.originalActivity;
    const newStart = dragState.tempStart;
    const newEnd = dragState.tempEnd;

    if (element) {
        element.style.transform = '';
        element.style.transition = '';
        element.style.willChange = '';
    }

    if (element) {
        element.style.cursor = '';
        element.style.zIndex = '';
    }
    document.body.style.cursor = '';


    if (cancel || newStart === undefined || newStart === null) {
        dragState.active = false;
        dragState = { active: false, originalStart: 0, originalEnd: 0, originalDelta: 0, originalActivity: null, startClientY: 0, element: null, activityId: null, cancelFlag: false };
        return;
    }

    if (newStart === originalAct.start) {
        dragState.active = false;
        dragState = { active: false, originalStart: 0, originalEnd: 0, originalDelta: 0, originalActivity: null, startClientY: 0, element: null, activityId: null, cancelFlag: false };
        return;
    }

    const newActivity = {
        ...originalAct,
        start: newStart,
        end: newEnd
    };

    const fixedActivity = await validateAndFix(originalAct, newActivity);
    if (fixedActivity === null) {
        openEditModal(originalAct);
        dragState.active = false;
        dragState = { active: false, originalStart: 0, originalEnd: 0, originalDelta: 0, originalActivity: null, startClientY: 0, element: null, activityId: null, cancelFlag: false };
        return;
    }

    const dayEntry = ensureScheduleExists(currentDate);
    const activities = dayEntry.schedule.activities;
    const index = activities.findIndex(a => a.id === fixedActivity.id);
    if (index !== -1) {
        activities[index] = fixedActivity;
    } else {
        fixedActivity.id = getNextIdForDay();
        activities.push(fixedActivity);
    }
    activities.sort((a,b) => a.start - b.start);
    currentActivities = activities;
    updateScheduleCurrentDateTime(currentDate);
    saveToLocalStorage();
    renderActivities();

    dragState.active = false;
    dragState = { active: false, originalStart: 0, originalEnd: 0, originalDelta: 0, originalActivity: null, startClientY: 0, element: null, activityId: null, cancelFlag: false };
}

// Получить rate для активности по её activityTypeId
function getRateForActivityType(activityTypeId) {
    const act = categoriesData.activity_types.find(a => a.id === activityTypeId);
    if (!act) return 0;
    const cat = categoriesData.categories.find(c => c.id === act.category_id);
    if (!cat) return 0;
    const rank = categoriesData.ranks.find(r => r.id === cat.rank_id);
    return rank ? rank.rate : 0;
}

// Вычислить плановый и фактический баланс для массива активностей
function computeBalances(activities) {
    let planned = 0, fact = 0;
    for (const act of activities) {
        const rate = getRateForActivityType(act.activityTypeId);
        const hours = act.active / 60;
        const value = Math.trunc(hours * rate);
        planned += value;
        if (act.status === 'done') fact += value;
    }
    return { planned, fact };
}

// Обновить отображение баланса на основе currentActivities
function updateBalanceDisplay() {
    const plannedSpan = document.getElementById('planned-balance');
    const factSpan = document.getElementById('fact-balance');
    if (!plannedSpan || !factSpan) return;
    if (!currentActivities || currentActivities.length === 0) {
        plannedSpan.textContent = 'План: 0 руб';
        factSpan.textContent = 'Факт: 0 руб';
        return;
    }
    const { planned, fact } = computeBalances(currentActivities);
    plannedSpan.textContent = `План: ${planned} руб`;
    factSpan.textContent = `Факт: ${fact} руб`;
}

function getWorkDate() {
    const urlParams = new URLSearchParams(window.location.search);
    const dateParam = urlParams.get('work-date');
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        return dateParam;
    }
    return getCurrentDateTimeString().slice(0, 10);
}

// Обновляет URL с параметром work-date без перезагрузки страницы
function updateUrlWithDate(date) {
    const url = new URL(window.location);
    url.searchParams.set('work-date', date);
    window.history.replaceState({}, '', url.toString());
}


// делаем функции глобально доступными
window.startDrag = startDrag;
window.cancelPendingDrag = cancelPendingDrag;