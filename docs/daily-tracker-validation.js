// daily-tracker-validation.js
// Правила валидации и диалоги исправления (раздел 7.3)

const validationModal = document.getElementById('validation-modal');
const validationTitle = document.getElementById('validation-title');
const validationMessage = document.getElementById('validation-message');
const validationOptions = document.getElementById('validation-options');
const validationCancel = document.getElementById('validation-cancel');

// Закрытие модального окна по клику на фон
validationModal.onclick = (e) => {
    if (e.target === validationModal) validationModal.classList.remove('active');
};

// Утилита показа диалога с вариантами
function showValidationDialog(title, message, options) {
    return new Promise((resolve) => {
        validationTitle.textContent = title;
        validationMessage.textContent = message;
        validationOptions.innerHTML = '';
        options.forEach(opt => {
            const btn = document.createElement('div');
            btn.className = `validation-option${opt.primary ? ' primary' : ''}`;
            btn.textContent = opt.label;
            btn.onclick = () => {
                validationModal.classList.remove('active');
                resolve(opt.value);
            };
            validationOptions.appendChild(btn);
        });
        validationCancel.onclick = () => {
            validationModal.classList.remove('active');
            resolve(null);
        };
        validationModal.classList.add('active');
    });
}

// Основная функция валидации
async function validateAndFix(oldAct, newAct) {
    // 1. Проверка границ
    if (newAct.start < 0 || newAct.start > 1440 ||
        newAct.end < 0 || newAct.end > 1440 ||
        newAct.delta < 0 || newAct.delta > 1440 ||
        newAct.active < 0 || newAct.active > 1440 ||
        newAct.interruptBreaks < 0 || newAct.interruptBreaks > 1440 ||
        newAct.distractionBreaks < 0 || newAct.distractionBreaks > 1440) {
        await showValidationDialog(
            'Некорректные значения',
            'Время начала, конца, дельта или перерывы выходят за допустимые пределы (0–1440 минут).',
            [{ label: 'Вернуться к редактированию', value: null, primary: false }]
        );
        return null;
    }

    // 2. Определяем изменённые поля
    const startChanged = oldAct === null ? true : oldAct.start !== newAct.start;
    const endChanged   = oldAct === null ? true : oldAct.end !== newAct.end;
    const deltaChanged = oldAct === null ? true : oldAct.delta !== newAct.delta;
    const activeChanged = oldAct === null ? true : oldAct.active !== newAct.active;
    const intChanged   = oldAct === null ? true : oldAct.interruptBreaks !== newAct.interruptBreaks;
    const distChanged  = oldAct === null ? true : oldAct.distractionBreaks !== newAct.distractionBreaks;

    // 3. Проверка правил времени и состава
    const timeRuleOk = (newAct.delta === newAct.end - newAct.start);
    const compositionRuleOk = (newAct.delta === newAct.active + newAct.interruptBreaks + newAct.distractionBreaks);

    if (timeRuleOk && compositionRuleOk && newAct.active > 0) {
        return newAct; // всё корректно
    }

    // ------------------- Случай 1: перерывы и active не менялись -------------------
    if (!intChanged && !distChanged && !activeChanged) {
        // Шаг 1: коррекция start/end/delta
        // 1.1 Изменён только start
        if (startChanged && !endChanged && !deltaChanged) {
            newAct.end = newAct.start + newAct.delta;
            if (newAct.end > 1440) {
                newAct.end = 1440;
                newAct.start = 1440 - newAct.delta;
            }
        }
        // 1.2 Изменён только end
        else if (!startChanged && endChanged && !deltaChanged) {
            if (newAct.end > newAct.start) {
                // диалог с двумя вариантами
                const choice = await showValidationDialog(
                    'Изменено только время окончания',
                    `Время начала: ${formatMinutesToTime(newAct.start)}, время окончания: ${formatMinutesToTime(newAct.end)}), дельта: ${newAct.delta} мин. Выберите действие:`,
                    [
                        {label: `Сохранить начало ${formatMinutesToTime(newAct.start)}, изменить дельту с ${newAct.delta} на ${newAct.end - newAct.start} мин`, value: 'fixDelta', primary : true},
                        {label: `Сохранить дельту ${newAct.delta} мин, изменить начало с ${formatMinutesToTime(newAct.start)} на ${formatMinutesToTime(newAct.end - newAct.delta)}`, value: 'shiftStart'}
                    ]
                );
                if (choice === null) return null;
                if (choice === 'shiftStart') {
                    newAct.start = newAct.end - newAct.delta;
                } else if (choice === 'fixDelta') {
                    newAct.delta = newAct.end - newAct.start;
                }
            } else { // end <= start
                newAct.start = newAct.end - newAct.delta;
            }

            // проверка выхода за границы
            if (newAct.start < 0) {
                newAct.start = 0;
                newAct.end = newAct.delta;
            }
        }

        // 1.3 Изменена только дельта
        else if (!startChanged && !endChanged && deltaChanged) {
            if (newAct.delta > 0) {
                newAct.end = newAct.start + newAct.delta;
                if (newAct.end > 1440) {
                    newAct.end = 1440;
                    newAct.start = 1440 - newAct.delta;
                }
            } else {
                await showValidationDialog(
                    'Ошибка',
                    'Дельта должна быть положительной. Исправьте значение.',
                    [{ label: 'Вернуться к редактированию', value: null }]
                );
                return null;
            }
        }
        // 1.4 Изменены start и end (delta не менялась)
        else if (startChanged && endChanged && !deltaChanged) {
            newAct.delta = newAct.end - newAct.start;
            if (newAct.delta <= 0) {
                await showValidationDialog(
                    'Ошибка',
                    'Время окончания должно быть больше времени начала.',
                    [{ label: 'Вернуться к редактированию', value: null }]
                );
                return null;
            }
        }
        // 1.5 Изменены start и delta (end не менялся)
        else if (startChanged && !endChanged && deltaChanged) {
            newAct.end = newAct.start + newAct.delta;
            if (newAct.end > 1440) {
                newAct.end = 1440;
                newAct.start = 1440 - newAct.delta;
            }
        }
        // 1.6 Изменены delta и end (start не менялся)
        else if (!startChanged && endChanged && deltaChanged) {
            newAct.start = newAct.end - newAct.delta;
            if (newAct.start < 0) {
                newAct.start = 0;
                newAct.end = newAct.delta;
            }
        }
        // 1.7 Изменены все три поля
        else if (startChanged && endChanged && deltaChanged) {
            const options = [];
            if (newAct.start + newAct.delta <= 1440) {
                options.push({ label: `Сохранить начало ${formatMinutesToTime(newAct.start)} и дельту ${newAct.delta} мин, изменить конец на ${formatMinutesToTime(newAct.start + newAct.delta)}`, value: 'fixEnd' });
            }
            if (newAct.end - newAct.delta >= 0) {
                options.push({ label: `Сохранить конец ${formatMinutesToTime(newAct.end)} и дельту ${newAct.delta} мин, изменить начало на ${formatMinutesToTime(newAct.end - newAct.delta)}`, value: 'fixStart' });
            }
            if (newAct.end - newAct.start > 0) {
                options.push({ label: `Сохранить начало ${formatMinutesToTime(newAct.start)} и конец ${formatMinutesToTime(newAct.end)}, изменить дельту на ${newAct.end - newAct.start} мин`, value: 'fixDelta' });
            }
            if (options.length === 0) {
                await showValidationDialog(
                    'Неконсистентные данные',
                    `Введённая комбинация (начало=${formatMinutesToTime(newAct.start)}, конец=${formatMinutesToTime(newAct.end)}, дельта=${newAct.delta}) не позволяет согласовать время.`,
                    [{ label: 'Вернуться к редактированию', value: null }]
                );
                return null;
            }
            const choice = await showValidationDialog('Выберите способ коррекции', 'Время начала, конца и дельты противоречат друг другу.', options);
            if (choice === null) return null;
            if (choice === 'fixEnd') {
                newAct.end = newAct.start + newAct.delta;
            } else if (choice === 'fixStart') {
                newAct.start = newAct.end - newAct.delta;
            } else if (choice === 'fixDelta') {
                newAct.delta = newAct.end - newAct.start;
            }
        }

        // Шаг 2: пересчёт активного времени
        newAct.active = newAct.delta - (newAct.interruptBreaks + newAct.distractionBreaks);
        if (newAct.active <= 0) {
            await showValidationDialog(
                'Некорректное активное время',
                `Дельта (${newAct.delta}) меньше суммы перерывов (${newAct.interruptBreaks + newAct.distractionBreaks}). Активное время не может быть ≤ 0. Исправьте данные.`,
                [{ label: 'Вернуться к редактированию', value: null }]
            );
            return null;
        }
        return newAct;
    }

    // ------------------- Случай 2: изменено хотя бы одно из active, interruptBreaks, distractionBreaks -------------------
    else {
        // Шаг 1: если delta не совпадает с end-start
        if (newAct.delta !== newAct.end - newAct.start) {
            const options = [];
            if (newAct.start + newAct.delta <= 1440) {
                options.push({ label: `Сохранить начало ${formatMinutesToTime(newAct.start)} и дельту ${newAct.delta} мин, изменить конец на ${formatMinutesToTime(newAct.start + newAct.delta)}`, value: 'fixEnd' });
            }
            if (newAct.end - newAct.delta >= 0) {
                options.push({ label: `Сохранить конец ${formatMinutesToTime(newAct.end)} и дельту ${newAct.delta} мин, изменить начало на ${formatMinutesToTime(newAct.end - newAct.delta)}`, value: 'fixStart' });
            }
            if (newAct.end - newAct.start > 0) {
                options.push({ label: `Сохранить начало ${formatMinutesToTime(newAct.start)} и конец ${formatMinutesToTime(newAct.end)}, изменить дельту на ${newAct.end - newAct.start} мин`, value: 'fixDelta' });
            }
            if (options.length === 0) {
                await showValidationDialog(
                    'Неконсистентные данные',
                    `Введённая комбинация (начало=${formatMinutesToTime(newAct.start)}, конец=${formatMinutesToTime(newAct.end)}, дельта=${newAct.delta}) не позволяет согласовать время.`,
                    [{ label: 'Вернуться к редактированию', value: null }]
                );
                return null;
            }
            const choice = await showValidationDialog('Выберите способ коррекции времени', 'Время начала, конца и дельты противоречат друг другу.', options);
            if (choice === null) return null;
            if (choice === 'fixEnd') {
                newAct.end = newAct.start + newAct.delta;
            } else if (choice === 'fixStart') {
                newAct.start = newAct.end - newAct.delta;
            } else if (choice === 'fixDelta') {
                newAct.delta = newAct.end - newAct.start;
            }
        }

        // Шаг 2: если delta не совпадает с суммой active + перерывы
        if (newAct.delta !== newAct.active + newAct.interruptBreaks + newAct.distractionBreaks) {
            const options = [];
            // Вариант 1: изменить active
            const newActive = newAct.delta - (newAct.interruptBreaks + newAct.distractionBreaks);
            if (newActive > 0) {
                options.push({ label: `Сохранить перерывы, изменить активное время на ${newActive} мин`, value: 'fixActive' });
            }
            // Вариант 2: изменить distractionBreaks
            const newDist = newAct.delta - (newAct.interruptBreaks + newAct.active);
            if (newDist >= 0 && newAct.active > 0) {
                options.push({ label: `Сохранить прерывания и активное время, изменить отвлечения на ${newDist} мин`, value: 'fixDist' });
            }
            if (options.length === 0) {
                await showValidationDialog(
                    'Неконсистентные перерывы',
                    'Сумма активного времени и перерывов не равна дельте, и нет возможности автоматически исправить (active ≤ 0 или отрицательные перерывы). Исправьте вручную.',
                    [{ label: 'Вернуться к редактированию', value: null }]
                );
                return null;
            }
            const choice = await showValidationDialog('Выберите способ коррекции', 'Дельта не равна сумме активного времени и перерывов.', options);
            if (choice === null) return null;
            if (choice === 'fixActive') {
                newAct.active = newAct.delta - (newAct.interruptBreaks + newAct.distractionBreaks);
            } else if (choice === 'fixDist') {
                newAct.distractionBreaks = newAct.delta - (newAct.interruptBreaks + newAct.active);
            }
        }

        // Финальная проверка active > 0
        if (newAct.active <= 0) {
            await showValidationDialog(
                'Ошибка',
                'Активное время должно быть больше нуля. Исправьте данные.',
                [{ label: 'Вернуться к редактированию', value: null }]
            );
            return null;
        }
        return newAct;
    }
}
window.validateAndFix = validateAndFix;