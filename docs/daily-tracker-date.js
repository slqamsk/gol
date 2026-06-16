// daily-tracker-date.js
// Выбор даты, загрузка расписания, навигация по дням

// DOM элементы для выбора даты
const currentDateDisplay = document.getElementById('current-date-display');
const selectDayBtn = document.getElementById('select-day-btn');
const todayBtn = document.getElementById('today-btn');
const dateModal = document.getElementById('date-modal');
const dateListDiv = document.getElementById('date-list');
const modalSelectBtn = document.getElementById('modal-select-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');

// DOM элементы для модального окна подтверждения создания расписания
const confirmCreateModal = document.getElementById('confirm-create-modal');
const confirmCreateMessage = document.getElementById('confirm-create-message');
const confirmCreateYes = document.getElementById('confirm-create-yes');
const confirmCreateNo = document.getElementById('confirm-create-no');

// ========== ОСНОВНАЯ ФУНКЦИЯ ЗАГРУЗКИ ==========
function loadScheduleForDate(date) {
    currentDate = date;
    currentDateDisplay.textContent = date;

    // Обновляем URL без перезагрузки
    updateUrlWithDate(date);

    // Убедиться, что расписание существует (создать пустое при необходимости)
    const entry = ensureScheduleExists(date);

    // Обновить current_datetime при загрузке (чтении)
    entry.current_datetime = getCurrentDateTimeString();
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

// ========== НАВИГАЦИЯ ПО ДНЯМ ==========

// Проверяет, существует ли расписание на дату
function hasScheduleForDate(date) {
    return schedulesRoot.schedules.some(s => s.date === date);
}

// Форматирование даты для отображения (ДД.ММ.ГГГГ)
function formatDateDisplay(dateStr) {
    const parts = dateStr.split('-');
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

// Показывает модалку с вопросом о создании расписания
function showConfirmCreateDialog(date) {
    const message = confirmCreateMessage;
    const yesBtn = confirmCreateYes;
    const noBtn = confirmCreateNo;

    message.textContent = `Расписания за ${formatDateDisplay(date)} ещё нет. Создать?`;
    confirmCreateModal.classList.add('active');

    // Обработчики (одноразовые, чтобы не накапливались)
    const onYes = () => {
        confirmCreateModal.classList.remove('active');
        // Создаём пустое расписание для этой даты
        ensureScheduleExists(date);
        // Загружаем его (оно пустое)
        loadScheduleForDate(date);
        // Удаляем обработчики
        yesBtn.removeEventListener('click', onYes);
        noBtn.removeEventListener('click', onNo);
    };
    const onNo = () => {
        confirmCreateModal.classList.remove('active');
        // Остаёмся на текущей дате
        // Удаляем обработчики
        yesBtn.removeEventListener('click', onYes);
        noBtn.removeEventListener('click', onNo);
    };
    yesBtn.addEventListener('click', onYes);
    noBtn.addEventListener('click', onNo);
}

// Переход на день со смещением (offset = ±1)
// Переход на день со смещением (offset = ±1)
function navigateDay(offset) {
    if (!currentDate) return;
    const newDate = addDaysToDateString(currentDate, offset);
    if (hasScheduleForDate(newDate)) {
        loadScheduleForDate(newDate);
    } else {
        showConfirmCreateDialog(newDate);
    }
}

// Добавляет указанное количество дней к строке даты YYYY-MM-DD
function addDaysToDateString(dateStr, days) {
    const parts = dateStr.split('-').map(Number);
    const year = parts[0];
    const month = parts[1] - 1;   // месяцы в JS: 0-11
    const day = parts[2];
    const dt = new Date(year, month, day);
    dt.setDate(dt.getDate() + days);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// ========== ДИАЛОГ ВЫБОРА ДАТЫ ==========

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
    const today = getCurrentDateTimeString().slice(0, 10);
    loadScheduleForDate(today);
}

// Обработчики событий (назначаются в main.js)