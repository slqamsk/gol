// daily-tracker-date.js
// Выбор даты и загрузка расписания

// DOM элементы для выбора даты
const currentDateDisplay = document.getElementById('current-date-display');
const selectDayBtn = document.getElementById('select-day-btn');
const todayBtn = document.getElementById('today-btn');
const dateModal = document.getElementById('date-modal');
const dateListDiv = document.getElementById('date-list');
const modalSelectBtn = document.getElementById('modal-select-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');

function loadScheduleForDate(date) {
    currentDate = date;
    currentDateDisplay.textContent = date;
    
    // Убедиться, что расписание существует (создать пустое при необходимости)
    const entry = ensureScheduleExists(date);
    
    // Обновить current_datetime при загрузке (чтении)
    entry.current_datetime = new Date().toISOString();
    saveToLocalStorage();
    
    if (entry.schedule && Array.isArray(entry.schedule.activities)) {
        currentActivities = entry.schedule.activities;
        renderActivities();
        showStatus(`Загружено расписание на ${date} (активностей: ${currentActivities.length})`);
    } else {
        currentActivities = [];
        document.getElementById('blocks-container').innerHTML = '';
        showStatus(`Расписания на ${date} ещё нет`, false);
    }
    updateCurrentTimeLine();
}

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

// Обработчики событий (назначаются в main.js)