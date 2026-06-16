// daily-tracker-main.js
// Инициализация и жизненный цикл

function init() {
    if (!loadCategories()) return;
    if (!loadSchedules()) return;
    renderLegend();
    renderTimelineTicks();
    initEditor();

    loadScheduleForDate(getWorkDate());

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

    // Кнопки навигации по дням (влево / вправо)
    const prevDayBtn = document.getElementById('prev-day-btn');
    const nextDayBtn = document.getElementById('next-day-btn');
    if (prevDayBtn) prevDayBtn.onclick = () => navigateDay(-1);
    if (nextDayBtn) nextDayBtn.onclick = () => navigateDay(1);
}

init();