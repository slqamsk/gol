// daily-tracker-main.js
// Инициализация и жизненный цикл

function init() {
    if (!loadCategories()) return;
    if (!loadSchedules()) return;
    renderLegend();
    renderTimelineTicks();
    initEditor();

    const today = getCurrentDateTimeString().slice(0, 10);
    loadScheduleForDate(today);

    // Обновление линии времени каждую минуту
    setInterval(() => {
        if (currentDate === getCurrentDateTimeString().slice(0, 10)) {
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