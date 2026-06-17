// daily-tracker-editor.js
// Модальное окно добавления/редактирования активности (без валидации)

// DOM элементы модального окна редактирования
const activityModal = document.getElementById('activity-modal');
const actRank = document.getElementById('act-rank');
const actCategory = document.getElementById('act-category');
const actAction = document.getElementById('act-action');
const actComment = document.getElementById('act-comment');
const actDelta = document.getElementById('act-delta');
const actActive = document.getElementById('act-active');
const actIntBreaks = document.getElementById('act-int-breaks');
const actDistBreaks = document.getElementById('act-dist-breaks');
const actStart = document.getElementById('act-start');
const actEnd = document.getElementById('act-end');
const actStartNow = document.getElementById('act-start-now');
const actEndNow = document.getElementById('act-end-now');
const actDelete = document.getElementById('act-delete');
const actCancel = document.getElementById('act-cancel');
const actSave = document.getElementById('act-save');
const actSaveAndAdd = document.getElementById('act-save-and-add');
const activityModalTitle = document.getElementById('activity-modal-title');
const statusBtns = document.querySelectorAll('.status-btn');
const addActivityBtn = document.getElementById('add-activity-btn');


// Вспомогательные функции для формы
function buildRanksSelect() {
    actRank.innerHTML = '';
    for (const rank of categoriesData.ranks) {
        const option = document.createElement('option');
        option.value = rank.id;
        option.textContent = `${rank.name} (×${rank.coefficient})`;
        actRank.appendChild(option);
    }
    onRankChange();
}

function onRankChange() {
    const rankId = parseInt(actRank.value);
    const categories = categoriesData.categories.filter(c => c.rank_id === rankId);
    actCategory.innerHTML = '';
    for (const cat of categories) {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.name;
        actCategory.appendChild(option);
    }
    onCategoryChange();
}

function onCategoryChange() {
    const categoryId = parseInt(actCategory.value);
    const activities = categoriesData.activity_types.filter(a => a.category_id === categoryId);
    actAction.innerHTML = '';
    for (const act of activities) {
        const option = document.createElement('option');
        option.value = act.id;
        option.textContent = act.name;
        actAction.appendChild(option);
    }
}

// Получить rankId и categoryId по activityTypeId
function getRankAndCategoryIdByActivityTypeId(activityTypeId) {
    const act = categoriesData.activity_types.find(a => a.id === activityTypeId);
    if (!act) return { rankId: null, categoryId: null };
    const cat = categoriesData.categories.find(c => c.id === act.category_id);
    if (!cat) return { rankId: null, categoryId: null };
    const rank = categoriesData.ranks.find(r => r.id === cat.rank_id);
    return { rankId: rank ? rank.id : null, categoryId: cat.id };
}

function loadActivityIntoForm(activity) {
    // Получаем rankId и categoryId из activityTypeId
    const { rankId, categoryId } = getRankAndCategoryIdByActivityTypeId(activity.activityTypeId);
    
    // Устанавливаем ранг
    if (rankId !== null) {
        // Убедимся, что опция существует
        const optionExists = Array.from(actRank.options).some(opt => parseInt(opt.value) === rankId);
        if (optionExists) {
            actRank.value = rankId;
        } else {
            actRank.value = actRank.options[0].value;
        }
    } else {
        actRank.value = actRank.options[0].value;
    }
    onRankChange(); // обновить категории
    
    // Устанавливаем категорию
    if (categoryId !== null) {
        const categoryExists = Array.from(actCategory.options).some(opt => parseInt(opt.value) === categoryId);
        if (categoryExists) {
            actCategory.value = categoryId;
        } else {
            actCategory.value = actCategory.options[0].value;
        }
    } else {
        actCategory.value = actCategory.options[0].value;
    }
    onCategoryChange(); // обновить активности
    
    // Устанавливаем активность
    const activityExists = Array.from(actAction.options).some(opt => parseInt(opt.value) === activity.activityTypeId);
    if (activityExists) {
        actAction.value = activity.activityTypeId;
    } else {
        actAction.value = actAction.options[0].value;
    }
    
    actComment.value = activity.comment || '';
    actDelta.value = activity.delta || 0;
    actActive.value = activity.active || 0;
    actIntBreaks.value = activity.interruptBreaks || 0;
    actDistBreaks.value = activity.distractionBreaks || 0;
    actStart.value = formatMinutesToTime(activity.start);
    actEnd.value = formatMinutesToTime(activity.end);
    const status = activity.status || 'planned';
    statusBtns.forEach(btn => {
        if (btn.dataset.status === status) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

function readFormToDraft() {
    return {
        id: currentEditingId,
        activityTypeId: parseInt(actAction.value),
        comment: actComment.value,
        delta: parseInt(actDelta.value),
        active: parseInt(actActive.value),
        interruptBreaks: parseInt(actIntBreaks.value),
        distractionBreaks: parseInt(actDistBreaks.value),
        start: timeStrToMinutes(actStart.value),
        end: timeStrToMinutes(actEnd.value),
        status: document.querySelector('.status-btn.active').dataset.status,
        rankId: parseInt(actRank.value),
        categoryId: parseInt(actCategory.value),
        action: actAction.options[actAction.selectedIndex].textContent
    };
}

// Сохранение активности (вызывает validateAndFix из validation.js)
async function saveActivity() {
    const draft = readFormToDraft();
    if (!draft.action) {
        showStatus('Выберите активность', true);
        return;
    }
    const oldAct = currentEditingId ? currentActivities.find(a => a.id === currentEditingId) : null;
    const fixed = await validateAndFix(oldAct, draft);
    if (fixed === null) return; // пользователь отменил или ошибка

    // Найти или создать день
    let dayEntry = ensureScheduleExists(currentDate);
    const activities = dayEntry.schedule.activities;
    if (currentEditingId) {
        const index = activities.findIndex(a => a.id === currentEditingId);
        if (index !== -1) {
            fixed.id = currentEditingId;
            activities[index] = fixed;
        }
    } else {
        fixed.id = getNextIdForDay();
        activities.push(fixed);
    }
    activities.sort((a,b) => a.start - b.start);
    currentActivities = activities;
    dayEntry.current_datetime = getCurrentDateTimeString();
    saveToLocalStorage();
    renderActivities();
    closeActivityModal();
    showStatus('Активность сохранена');
}

function deleteActivity() {
    if (!currentEditingId) return;
    if (!confirm('Удалить активность?')) return;
    const dayEntry = schedulesRoot.schedules.find(s => s.date === currentDate);
    if (dayEntry) {
        dayEntry.schedule.activities = dayEntry.schedule.activities.filter(a => a.id !== currentEditingId);
        currentActivities = dayEntry.schedule.activities;
        
        // Обновить current_datetime для этой даты
        dayEntry.current_datetime = getCurrentDateTimeString();
        
        saveToLocalStorage();
        renderActivities();
        closeActivityModal();
        showStatus('Активность удалена');
    }
}

function setStartNow() {
    const now = new Date();
    const minutes = now.getHours() * 60 + Math.round(now.getMinutes() / 1) * 1;
    actStart.value = formatMinutesToTime(minutes);
    const delta = parseInt(actDelta.value);
    if (!isNaN(delta)) {
        actEnd.value = formatMinutesToTime(minutes + delta);
    }
    // Установить статус "Выполняется"
    statusBtns.forEach(btn => btn.classList.remove('active'));
    document.querySelector('.status-btn[data-status="in_progress"]').classList.add('active');
}

function setEndNow() {
    const now = new Date();
    const minutes = now.getHours() * 60 + Math.round(now.getMinutes() / 1) * 1;
    actEnd.value = formatMinutesToTime(minutes);
    const startMin = timeStrToMinutes(actStart.value);
    const delta = minutes - startMin;
    if (delta >= 0) {
        actDelta.value = delta;
        actActive.value = delta;
        actIntBreaks.value = 0;
        actDistBreaks.value = 0;
    }
    // Установить статус "Сделано"
    statusBtns.forEach(btn => btn.classList.remove('active'));
    document.querySelector('.status-btn[data-status="done"]').classList.add('active');
}

function openAddModal(startMinutes) {
    currentEditingId = null;
    activityModalTitle.textContent = 'Новое дело';
    actDelete.style.display = 'none';
    // Если startMinutes не передан, использовать текущее время
    let start = (startMinutes !== undefined) ? startMinutes : (new Date().getHours() * 60 + Math.round(new Date().getMinutes() / 1) * 1);
    let end = start + 60;
    actStart.value = formatMinutesToTime(start);
    actEnd.value = formatMinutesToTime(end);
    actDelta.value = 60;
    actActive.value = 60;
    actIntBreaks.value = 0;
    actDistBreaks.value = 0;
    actComment.value = '';
    buildRanksSelect();
    statusBtns.forEach(btn => btn.classList.remove('active'));
    document.querySelector('.status-btn[data-status="planned"]').classList.add('active');
    activityModal.classList.add('active');
}

function openEditModal(activity) {
    currentEditingId = activity.id;
    activityModalTitle.textContent = 'Редактирование активности';
    actDelete.style.display = 'block';
    // Сначала построить селекты (ранги, категории, активности)
    buildRanksSelect();
    // Затем загрузить значения активности
    loadActivityIntoForm(activity);
    activityModal.classList.add('active');
}

function closeActivityModal() {
    activityModal.classList.remove('active');
}

// Привязка обработчиков
function initEditor() {
    addActivityBtn.onclick = () => openAddModal();
    actCancel.onclick = closeActivityModal;
    actSave.onclick = saveActivity;
    actSaveAndAdd.onclick = saveAndAddActivity;
    actDelete.onclick = deleteActivity;
    actStartNow.onclick = setStartNow;
    actEndNow.onclick = setEndNow;
    actRank.onchange = onRankChange;
    actCategory.onchange = onCategoryChange;
    statusBtns.forEach(btn => {
        btn.onclick = () => {
            statusBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        };
    });
}




async function saveAndAddActivity() {
    const draft = readFormToDraft();
    if (!draft.action) {
        showStatus('Выберите активность', true);
        return;
    }
    const oldAct = currentEditingId ? currentActivities.find(a => a.id === currentEditingId) : null;
    const fixed = await validateAndFix(oldAct, draft);
    if (fixed === null) return; // пользователь отменил

    // Сохраняем активность (логика идентична saveActivity)
    let dayEntry = ensureScheduleExists(currentDate);
    const activities = dayEntry.schedule.activities;
    if (currentEditingId) {
        const index = activities.findIndex(a => a.id === currentEditingId);
        if (index !== -1) {
            fixed.id = currentEditingId;
            activities[index] = fixed;
        }
    } else {
        fixed.id = getNextIdForDay();
        activities.push(fixed);
    }
    activities.sort((a,b) => a.start - b.start);
    currentActivities = activities;
    dayEntry.current_datetime = getCurrentDateTimeString();
    saveToLocalStorage();
    renderActivities();

    // Закрыть текущее модальное окно
    closeActivityModal();

    // Открыть новую активность, начиная с времени окончания сохранённой
    openAddModal(fixed.end);

    showStatus('Активность сохранена, создаём новую');
}