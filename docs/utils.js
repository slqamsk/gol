// utils.js
// Универсальные вспомогательные функции для всех страниц

/**
 * Возвращает текущее московское время в минутах от полуночи.
 * Секунды отбрасываются (округление вниз до целой минуты).
 * @returns {number} количество минут от 0 до 1439
 */
function getCurrentMinutes() {
    const now = new Date();
    // Добавляем 3 часа (10800000 мс) для перехода из UTC в московское время
    const mskTime = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    return mskTime.getHours() * 60 + mskTime.getMinutes();
}

/**
 * Возвращает строку с текущим московским временем в формате ISO 8601 с часовым поясом +03:00
 * Пример: "2026-06-08T13:54:22+03:00"
 * @returns {string}
 */
function getCurrentDateTimeString() {
    const now = new Date();
    const mskTime = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    return mskTime.toISOString().replace('Z', '+03:00');
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