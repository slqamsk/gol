// utils.js
// Универсальные вспомогательные функции для всех страниц

// Локальная временная зона: +3 часа (Москва)
// При необходимости изменить на другую зону, достаточно поменять это значение
const LOCAL_TIMEZONE_OFFSET_HOURS = 3;

/**
 * Возвращает объект Date с текущим временем в локальной временной зоне.
 * @returns {Date}
 */
function getLocalTime() {
    const now = new Date();
    return new Date(now.getTime() + LOCAL_TIMEZONE_OFFSET_HOURS * 60 * 60 * 1000);
}

/**
 * Возвращает строку с текущим временем в формате ISO 8601 с указанием локальной временной зоны.
 * Пример: "2026-06-08T13:54:22+03:00"
 * @returns {string}
 */
function getCurrentDateTimeString() {
    const localTime = getLocalTime();
    const offsetStr = (LOCAL_TIMEZONE_OFFSET_HOURS >= 0 ? '+' : '-') + 
                      String(Math.abs(LOCAL_TIMEZONE_OFFSET_HOURS)).padStart(2, '0') + ':00';
    return localTime.toISOString().replace('Z', offsetStr);
}

/**
 * Возвращает текущее время в минутах от полуночи (в локальной временной зоне).
 * Секунды отбрасываются (округление вниз до целой минуты).
 * @returns {number} количество минут от 0 до 1439
 */
function getCurrentMinutes() {
    const localTime = getLocalTime();
    return localTime.getUTCHours() * 60 + localTime.getUTCMinutes();
}

/**
 * Форматирует минуты в строку HH:MM
 * @param {number} minutes - минуты от 0 до 1440
 * @returns {string}
 */
function formatMinutesToTime(minutes) {
    minutes = Math.max(0, Math.min(minutes, 1440));
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}


/**
 * Преобразует строку времени HH:MM в минуты
 * @param {string} timeStr - время в формате HH:MM
 * @returns {number}
 */
function timeStrToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + (m || 0);
}

/**
 * Форматирует длительность в формате ЧЧ:ММ
 * @param {number} minutes - минуты
 * @returns {string}
 */
function formatDuration(minutes) {
    const total = Math.max(0, Math.round(minutes));
    return `${Math.floor(total / 60).toString().padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
}