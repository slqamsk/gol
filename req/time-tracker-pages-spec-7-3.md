## Раздел 7.3. Правила валидации значений перед сохранением активности

### Пример использования

```javascript
// В обработчике сохранения активности (например, saveActivity в daily-tracker-editor.js)
async function saveActivity() {
    // Собираем данные формы в объект newAct
    const newAct = {
        id: currentEditingId || null,
        activityTypeId: parseInt(actAction.value),
        start: timeStrToMinutes(actStart.value),
        end: timeStrToMinutes(actEnd.value),
        delta: parseInt(actDelta.value),
        active: parseInt(actActive.value),
        interruptBreaks: parseInt(actIntBreaks.value),
        distractionBreaks: parseInt(actDistBreaks.value),
        comment: actComment.value,
        status: document.querySelector('.status-btn.active').dataset.status
    };
    
    // Старая активность (null для новой)
    const oldAct = currentEditingId ? currentActivities.find(a => a.id === currentEditingId) : null;
    
    // Валидация
    const result = await validateAndFix(oldAct, newAct);
    if (result === null) {
        // Пользователь отменил сохранение (нажал «Вернуться к редактированию»)
        return;
    }
    // result — это скорректированный newAct (возможно, с изменёнными полями)
    // Сохраняем result в localStorage и перерисовываем интерфейс
    // ...
}
```

### Оболочка функции

```javascript
/**
 * Валидация активности перед сохранением.
 * @param {Object|null} oldAct — старая активность (null для новой)
 * @param {Object} newAct — новые значения (поля start, end, delta, active, interruptBreaks, distractionBreaks)
 * @returns {Promise<Object|null>} — возвращает скорректированный newAct или null при отмене
 */
async function validateAndFix(oldAct, newAct) {
    // Временно: валидация только для существующих активностей (редактирование)
    if (oldAct === null) {
        return newAct;
    }
    
    // 1. Проверка двух обязательных условий
    const timeRuleOk = (newAct.delta === newAct.end - newAct.start);
    const compositionRuleOk = (newAct.delta === newAct.active + newAct.interruptBreaks + newAct.distractionBreaks);
    
    // 2. Если оба правила соблюдены — возвращаем newAct без изменений
    if (timeRuleOk && compositionRuleOk) {
        return newAct;
    }
    
    // 3. Определяем, какие поля были изменены (oldAct существует)
    const startChanged = oldAct.start !== newAct.start;
    const endChanged   = oldAct.end !== newAct.end;
    const deltaChanged = oldAct.delta !== newAct.delta;
    const activeChanged = oldAct.active !== newAct.active;
    const intChanged   = oldAct.interruptBreaks !== newAct.interruptBreaks;
    const distChanged  = oldAct.distractionBreaks !== newAct.distractionBreaks;
    
    // 4. Разветвление по случаям (будет добавлена полная логика из таблиц решений)
    //    Случай 1, Случай 2, Случай 3
    
    // Если ни один случай не применился (защита от ошибок), возвращаем newAct
    return newAct;
}
```


### Случай 1: перерывы и active не менялись
    // Условие: !intChanged && !distChanged && !activeChanged 

#### Шаг-1: обработка start, end и delta

##### Изменен только start

```java
        // ------ 1. Изменён только start ------
        if (startChanged && !endChanged && !deltaChanged) {
            newAct.end = newAct.start + newAct.delta;
            if (newAct.end > 1440) {
                newAct.end = 1440;
                newAct.start = 1440 - newAct.delta;
            }
        }
```

##### Изменён только `end`

```javascript
if (!startChanged && endChanged && !deltaChanged) {
    if (newAct.end > newAct.start) {
        newAct.delta = newAct.end - newAct.start;
    } else {
        // Диалог: "Время окончания должно быть больше времени начала. Исправьте значения."
        // Кнопка: "Вернуться к редактированию" (единственная).
        // После закрытия диалога сохранение отменяется (возврат null).
        return null;
    }
}
```

##### Изменён только `delta`
```java
if (!startChanged && !endChanged && deltaChanged) {
    if (newAct.delta > 0) {
        newAct.end = newAct.start + newAct.delta;
        if (newAct.end > 1440) {
            newAct.end = 1440;
            newAct.start = 1440 - newAct.delta;
        }
    } else {
        // Диалог: "Дельта должна быть положительной. Исправьте значение."
        // Кнопка: "Вернуться к редактированию" (единственная).
        return null;
    }
}
```


##### Изменены `start` и `end` (delta не менялась)

```javascript
// ------ Изменены start и end ------
if (startChanged && endChanged && !deltaChanged) {
    newAct.delta = newAct.end - newAct.start;
    if (newAct.delta <= 0) {
        // Диалог: "Время окончания должно быть больше времени начала."
        // Кнопка: "Вернуться к редактированию"
        return null;
    }
}
```

#### Изменены `start` и `delta` (end не менялся)

```javascript
// ------ Изменены start и delta ------
if (startChanged && !endChanged && deltaChanged) {
    newAct.end = newAct.start + newAct.delta;
    if (newAct.end > 1440) {
        newAct.end = 1440;
        newAct.start = 1440 - newAct.delta;
    }
}
```

#### Изменены `delta` и `end` (start не менялся)

```javascript
// ------ Изменены delta и end ------
if (!startChanged && endChanged && deltaChanged) {
    newAct.start = newAct.end - newAct.delta;
    if (newAct.start < 0) {
        newAct.start = 0;
        newAct.end = newAct.delta;
    }
}
```

---

##### Изменены все три поля (`start`, `end`, `delta`)

```javascript
// ------ Изменены все три поля (или любая комбинация, не покрытая выше) ------
if (startChanged && endChanged && deltaChanged) {
    /// Показать диалог с 3-мя вариантами:
    /// Сохранить время начала  newAct.start и дельту newAct.delta, изменить время окончания с newAct.end на (newAct.start + newAct.delta)
    /// Сохранить время окончания  newAct.end и дельту newAct.delta, изменить время начала с newAct.start на (newAct.end - newAct.delta)
    /// Сохранить время начала  newAct.start и время окончания  newAct.end, изменить дельту с newAct.delta на (newAct.end - newAct.start)
    /// И кнопкой Отмена -> return null;
    /// применить выбранный вариант и скорректировать границы
}
```

#### Шаг-2: обработка active, interruptBreaks, distractionBreaks

```javascript
    newAct.active = newAct.delta - (newAct.interruptBreaks + newAct.distractionBreaks);
    if (newAct.active <= 0) {
        // Диалог: delta меньше суммы interruptBreaks и distractionBreaks
        // Исправьте данные
        return null;
    }
    return newAct;
```


### Случай 2: пользователь изменил хотя бы одно из полей active, interruptBreaks, distractionBreaks
    // Условие: (activeChanged || intChanged || distChanged)

```javascript
    if (activeChanged || intChanged || distChanged) {
        // --- Шаг 1 ---
        if (newAct.delta !== newAct.end - newAct.start) {
            /// Показать диалог с 3-мя вариантами:
            /// Сохранить время начала = newAct.start и дельту = newAct.delta, изменить время окончания с newAct.end на (newAct.start + newAct.delta)
            /// Сохранить время окончания = newAct.end и дельту = newAct.delta, изменить время начала с newAct.start на (newAct.end - newAct.delta)
            /// Сохранить время начала = newAct.start и время окончания = newAct.end, изменить дельту с newAct.delta на (newAct.end - newAct.start)
            /// И кнопкой Отмена -> return null;
        }
        // --- Шаг 2 ---
        if (newAct.delta !== newAct.active + newAct.interruptBreaks + newAct.distractionBreaks) {
            /// Показать диалог с вариантами:
            /// 1. Если newAct.delta - (newAct.interruptBreaks + newAct.distractionBreaks) > 0 
            ///       Сохранить interruptBreaks = newAct.interruptBreaks и distractionBreaks = newAct.distractionBreaks, изменить active = newAct.delta - (newAct.interruptBreaks + newAct.distractionBreaks)
            /// 2. Если newAct.delta - (newAct.interruptBreaks + newAct.active) >=0
            ///       Сохранить interruptBreaks = newAct.interruptBreaks и active = newAct.active, изменить  distractionBreaks = newAct.delta - (newAct.interruptBreaks + newAct.active)
            /// Если не показываем ни один вариант, то пишем "В параметрах active, interruptBreaks и distractionBreaks находятся неконсистентные данные - исправьте перед сохранением." При этом единственная кнопка на диалоге будет Отмена
            /// И кнопкой Отмена -> return null;
        }
        return newAct;
    }

```