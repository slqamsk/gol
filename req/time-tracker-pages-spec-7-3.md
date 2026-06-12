## Раздел 7.3. Правила валидации значений перед сохранением активности

### Бизнес-правила
- После валидации активное время active в минутах должно быть строго больше нуля. Активность, в которой пользователь не выполнял полезных действий (только перерывы), не имеет смысла и не должна сохраняться. Это правило применяется как при ручном вводе, так и после всех корректирующих диалогов.



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

    if (newAct.delta > 1200) {
        /// Сообщение: значение delta некорректное, должно быть меньше 1200. Исправьте.
        /// Кнопка "Вернуться к редактированию" -> return null;
    }

    if (newAct.delta < 0 || newAct.start < 0 || newAct.end < 0 || newAct.active < 0 || newAct.interruptBreaks < 0 || newAct.distractionBreaks < 0) {
        /// Отрицательные значения не допускаются. Исправьте.
        /// Кнопка "Вернуться к редактированию" -> return null;
    }
    
    // 1. Проверка двух обязательных условий
    const timeRuleOk = (newAct.delta === newAct.end - newAct.start);
    const compositionRuleOk = (newAct.delta === newAct.active + newAct.interruptBreaks + newAct.distractionBreaks && newAct.delta > 0 && newAct.active > 0);
    
    // 2. Если оба правила соблюдены — возвращаем newAct без изменений
    if (timeRuleOk && compositionRuleOk) {
        return newAct;
    }
    
    // 3. Определяем, какие поля были изменены (для новых активностей считаем, что всё изменено)
    // Для новой активности (oldAct === null) все флаги изменений устанавливаются в true, чтобы применить полную валидацию ко всем полям.
    let startChanged = true;
    let endChanged = true;
    let deltaChanged = true;
    let activeChanged = true;
    let intChanged = true;
    let distChanged = true;    
    if (!(oldAct === null)) {
        startChanged = oldAct.start !== newAct.start;
        endChanged   = oldAct.end !== newAct.end;
        deltaChanged = oldAct.delta !== newAct.delta;
        activeChanged = oldAct.active !== newAct.active;
        intChanged   = oldAct.interruptBreaks !== newAct.interruptBreaks;
        distChanged  = oldAct.distractionBreaks !== newAct.distractionBreaks;
    }

    
    // 4. Разветвление по случаям (будет добавлена полная логика из таблиц решений)
    //    Случай 1, Случай 2, Случай 3
    
    // Если ни один случай не применился (защита от ошибок), возвращаем newAct
    return newAct;
}
```


### Случай 1: перерывы и active не менялись
    // Условие: !intChanged && !distChanged && !activeChanged 

#### Шаг-1: обработка start, end и delta
Все подслучаи Случая 1 не должны содержать return newAct до выполнения Шага 2. 
После коррекции времени управление передаётся Шагу 2.


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
    if (newAct.end <= newAct.start) {
        newAct.start = newAct.end - newAct.delta
    } else {
        /// Показать диалог с 2-мя вариантами:
        /// Сохранить дельту = newAct.delta и время окончания = newAct.end, изменить время начала с newAct.start на (newAct.end - newAct.delta)
        /// Сохранить время начала = newAct.start и время окончания = newAct.end, изменить дельту с newAct.delta на (newAct.end - newAct.start)
        /// При выборе любого варианта применить соответствующую коррекцию полей и продолжить выполнение (перейти к проверке границ и шагу 2).        
        /// И кнопкой "Вернуться к редактированию" -> return null;
    }
    if (newAct.start < 0) {
        newAct.start = 0;
        newAct.end = newAct.delta;
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
            /// 1. Этот вариант показываем только если (newAct.start + newAct.delta) <=1440
            ///       Сохранить время начала  newAct.start и дельту newAct.delta, изменить время окончания с newAct.end на (newAct.start + newAct.delta)
            /// 2. Этот вариант показываем только если (newAct.end - newAct.delta) >= 0  
            ///       Сохранить время окончания  newAct.end и дельту newAct.delta, изменить время начала с newAct.start на (newAct.end - newAct.delta)
            /// 3. Этот вариант показываем только если (newAct.end - newAct.start) > 0  
            ///       Сохранить время начала  newAct.start и время окончания  newAct.end, изменить дельту с newAct.delta на (newAct.end - newAct.start)
            /// При выборе любого варианта применить соответствующую коррекцию полей и продолжить выполнение (перейти к проверке границ и шагу 2).            
            /// Если ни один из вариантов не показан, то вывести сообщение: "Введённая комбинация данных (время начала = newAct.start, время окончания = newAct.end, дельта = newAct.delta) неконсистентна. "
            /// И кнопкой "Вернуться к редактированию" -> return null;
}
```

#### Шаг-2: Выполняется после всех вариантов случая-1 (обработка active, interruptBreaks, distractionBreaks)

```javascript
    newAct.active = newAct.delta - (newAct.interruptBreaks + newAct.distractionBreaks);
    if (newAct.active <= 0) {
        // Диалог без вариантов только с сообщением: delta меньше суммы interruptBreaks и distractionBreaks
        // Исправьте данные. 
        // Кнопка "Вернуться к редактированию"
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
            /// 1. Этот вариант показываем только если (newAct.start + newAct.delta) <=1440
            ///       Сохранить время начала  newAct.start и дельту newAct.delta, изменить время окончания с newAct.end на (newAct.start + newAct.delta)
            /// 2. Этот вариант показываем только если (newAct.end - newAct.delta) >= 0  
            ///       Сохранить время окончания  newAct.end и дельту newAct.delta, изменить время начала с newAct.start на (newAct.end - newAct.delta)
            /// 3. Этот вариант показываем только если (newAct.end - newAct.start) > 0  
            ///       Сохранить время начала  newAct.start и время окончания  newAct.end, изменить дельту с newAct.delta на (newAct.end - newAct.start)
            /// При выборе любого варианта применить соответствующую коррекцию полей и продолжить выполнение (перейти к проверке границ и шагу 2).            
            /// Если ни один из вариантов не показан, то вывести сообщение: "Введённая комбинация данных (время начала = newAct.start, время окончания = newAct.end, дельта = newAct.delta) неконсистентна. "
            /// И кнопкой "Вернуться к редактированию" -> return null;
        }
        // --- Шаг 2 ---
        if (newAct.delta !== newAct.active + newAct.interruptBreaks + newAct.distractionBreaks) {
            // Варианта изменить interruptBreaks нет, т.к. это поле не должно редактироваться вручную. Мы обязательно сохраняем interruptBreaks неизменным.

            /// Показать диалог с вариантами:
            /// 1. Этот вариант показываем только если newAct.delta - (newAct.interruptBreaks + newAct.distractionBreaks) > 0 
            ///       Сохранить interruptBreaks = newAct.interruptBreaks и distractionBreaks = newAct.distractionBreaks, изменить active = newAct.delta - (newAct.interruptBreaks + newAct.distractionBreaks)
            /// 2. Этот вариант показываем только если newAct.delta - (newAct.interruptBreaks + newAct.active) >=0 и newAct.active > 0
            ///       Сохранить interruptBreaks = newAct.interruptBreaks и active = newAct.active, изменить  distractionBreaks = newAct.delta - (newAct.interruptBreaks + newAct.active)
            /// При выборе любого варианта применить соответствующую коррекцию полей и продолжить выполнение.          
            /// Если не показываем ни один вариант, то пишем "В параметрах active, interruptBreaks и distractionBreaks находятся неконсистентные данные - исправьте перед сохранением." При этом единственная кнопка на диалоге будет "Вернуться к редактированию"
            /// И кнопкой "Вернуться к редактированию" -> return null;
        }
        return newAct;
    }

```
