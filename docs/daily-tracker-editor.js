// daily-tracker-editor.js
// Модальное окно добавления/редактирования активности, валидация

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
const activityModalTitle = document.getElementById('activity-modal-title');
const statusBtns = document.querySelectorAll('.status-btn');
const addActivityBtn = document.getElementById('add-activity-btn');

// Модальное окно валидации
const validationModal = document.getElementById('validation-modal');
const validationTitle = document.getElementById('validation-title');
const validationMessage = document.getElementById('validation-message');
const validationOptions = document.getElementById('validation-options');
const validationCancel = document.getElementById('validation-cancel');

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

function loadActivityIntoForm(activity) {
    actRank.value = activity.rankId || 1;
    onRankChange();
    actCategory.value = activity.categoryId || categoriesData.categories[0].id;
    onCategoryChange();
    actAction.value = activity.activityTypeId || categoriesData.activity_types[0].id;
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

// Валидация (упрощённая реализация правил 7.3 для демонстрации)
async function validateAndFix(draft) {
    // Правило времени
    let deltaCalc = draft.end - draft.start;
    if (deltaCalc !== draft.delta) {
        return new Promise((resolve) => {
            validationTitle.textContent = 'Несоответствие времени';
            validationMessage.textContent = `Дельта (${draft.delta}) не равна разнице end - start (${deltaCalc}). Выберите действие:`;
            validationOptions.innerHTML = `
                <div class="validation-option primary" data-choice="time1">Исправить дельту: установить delta = ${deltaCalc}</div>
                <div class="validation-option" data-choice="time2">Исправить end: установить end = ${formatMinutesToTime(draft.start + draft.delta)}</div>
                <div class="validation-option" data-choice="time3">Исправить start: установить start = ${formatMinutesToTime(draft.end - draft.delta)}</div>
            `;
            validationModal.classList.add('active');
            const handler = (e) => {
                const choice = e.target.dataset.choice;
                if (choice === 'time1') {
                    draft.delta = deltaCalc;
                } else if (choice === 'time2') {
                    draft.end = draft.start + draft.delta;
                } else if (choice === 'time3') {
                    draft.start = draft.end - draft.delta;
                }
                validationModal.classList.remove('active');
                validationOptions.innerHTML = '';
                resolve(true);
            };
            validationOptions.querySelectorAll('.validation-option').forEach(opt => opt.addEventListener('click', handler, { once: true }));
            validationCancel.onclick = () => {
                validationModal.classList.remove('active');
                resolve(false);
            };
        });
    }
    // Правило состава
    let sumBreaks = draft.active + draft.interruptBreaks + draft.distractionBreaks;
    if (sumBreaks !== draft.delta) {
        return new Promise((resolve) => {
            validationTitle.textContent = 'Несоответствие состава';
            validationMessage.textContent = `Сумма активного времени и перерывов (${sumBreaks}) не равна дельте (${draft.delta}). Выберите действие:`;
            validationOptions.innerHTML = `
                <div class="validation-option primary" data-choice="sum1">Исправить дельту: установить delta = ${sumBreaks}</div>
                <div class="validation-option" data-choice="sum2">Исправить активное время: установить active = ${draft.delta - draft.interruptBreaks - draft.distractionBreaks}</div>
                <div class="validation-option" data-choice="sum3">Исправить перерывы из-за прерываний: установить interruptBreaks = ${draft.delta - draft.active - draft.distractionBreaks}</div>
                <div class="validation-option" data-choice="sum4">Исправить перерывы из-за отвлечений: установить distractionBreaks = ${draft.delta - draft.active - draft.interruptBreaks}</div>
            `;
            validationModal.classList.add('active');
            const handler = (e) => {
                const choice = e.target.dataset.choice;
                if (choice === 'sum1') {
                    draft.delta = sumBreaks;
                } else if (choice === 'sum2') {
                    draft.active = draft.delta - draft.interruptBreaks - draft.distractionBreaks;
                } else if (choice === 'sum3') {
                    draft.interruptBreaks = draft.delta - draft.active - draft.distractionBreaks;
                } else if (choice === 'sum4') {
                    draft.distractionBreaks = draft.delta - draft.active - draft.interruptBreaks;
                }
                validationModal.classList.remove('active');
                validationOptions.innerHTML = '';
                resolve(true);
            };
            validationOptions.querySelectorAll('.validation-option').forEach(opt => opt.addEventListener('click', handler, { once: true }));
            validationCancel.onclick = () => {
                validationModal.classList.remove('active');
                resolve(false);
            };
        });
    }
    return true;
}

// Сохранение активности
async function saveActivity() {
    const draft = readFormToDraft();
    if (!draft.action) {
        showStatus('Выберите активность', true);
        return;
    }
    const ok = await validateAndFix(draft);
    if (!ok) return;

    // Найти или создать день
    let dayEntry = schedulesRoot.schedules.find(s => s.date === currentDate);
    if (!dayEntry) {
        dayEntry = { date: currentDate, schedule: { activities: [], overlaps: [] } };
        schedulesRoot.schedules.push(dayEntry);
    }
    const activities = dayEntry.schedule.activities;
    if (currentEditingId) {
        const index = activities.findIndex(a => a.id === currentEditingId);
        if (index !== -1) {
            draft.id = currentEditingId;
            activities[index] = draft;
        }
    } else {
        draft.id = getNextIdForDay();
        activities.push(draft);
    }
    activities.sort((a,b) => a.start - b.start);
    currentActivities = activities;
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

function openAddModal() {
    currentEditingId = null;
    activityModalTitle.textContent = 'Новое дело';
    actDelete.style.display = 'none';
    const now = new Date();
    const startMin = now.getHours() * 60 + Math.round(now.getMinutes() / 1) * 1;
    const endMin = startMin + 60;
    actStart.value = formatMinutesToTime(startMin);
    actEnd.value = formatMinutesToTime(endMin);
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
    loadActivityIntoForm(activity);
    activityModal.classList.add('active');
}

function closeActivityModal() {
    activityModal.classList.remove('active');
}

// Привязка обработчиков
function initEditor() {
    addActivityBtn.onclick = openAddModal;
    actCancel.onclick = closeActivityModal;
    actSave.onclick = saveActivity;
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
    validationModal.onclick = (e) => { if (e.target === validationModal) validationModal.classList.remove('active'); };
}