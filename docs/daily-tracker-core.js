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

// Возвращает строку с текущим московским временем в формате ISO 8601 с часовым поясом +03:00
// Пример: "2026-06-08T13:54:22+03:00"
function getCurrentDateTimeString() {
    const now = new Date();
    // Добавляем 3 часа (10800000 мс) для перехода из UTC в московское время
    const mskTime = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    // toISOString возвращает UTC, но мы уже сдвинули время, и заменяем Z на +03:00
    return mskTime.toISOString().replace('Z', '+03:00');
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

// делаем функции глобально доступными
window.startDrag = startDrag;
window.validateAndFix = validateAndFix; // если её ещё нет в глобальной области