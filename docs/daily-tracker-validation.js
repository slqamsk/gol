// daily-tracker-validation.js
// Правила валидации и диалоги исправления (раздел 7.3)

// Модальное окно валидации
const validationModal = document.getElementById('validation-modal');
const validationTitle = document.getElementById('validation-title');
const validationMessage = document.getElementById('validation-message');
const validationOptions = document.getElementById('validation-options');
const validationCancel = document.getElementById('validation-cancel');

// Закрытие модального окна по клику на фон (назначается один раз)
validationModal.onclick = (e) => {
    if (e.target === validationModal) validationModal.classList.remove('active');
};

// Основная функция валидации
// Принимает объект draft (с полями start, end, delta, active, interruptBreaks, distractionBreaks)
// Возвращает Promise<boolean> – true, если данные корректны (или успешно исправлены), false – если пользователь отменил.
// При необходимости модифицирует переданный draft.
async function validateAndFix(draft) {
    // Проверка правила времени
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
    // Проверка правила состава
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