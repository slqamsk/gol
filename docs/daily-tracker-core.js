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

// Возвращает строку с текущим московским временем в формате "ДД.ММ.ГГГГ, ЧЧ:ММ:СС"
function getCurrentDateTimeString() {
    return new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
}