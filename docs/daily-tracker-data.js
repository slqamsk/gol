// daily-tracker-data.js
// Загрузка и обработка данных из localStorage

function loadCategories() {
    const stored = localStorage.getItem(CATEGORIES_KEY);
    if (!stored) {
        showStatus('Ошибка: справочник активностей не найден в localStorage', true);
        return false;
    }
    try {
        const parsed = JSON.parse(stored);
        if (!parsed.ranks || !parsed.categories || !parsed.activity_types) {
            throw new Error('Неверная структура справочника');
        }
        categoriesData = parsed;
        // Построение иерархии
        const ranksMap = new Map();
        for (const rank of categoriesData.ranks) {
            ranksMap.set(rank.id, {
                id: rank.id,
                name: rank.name,
                coefficient: rank.coefficient,
                color: rank.color,
                categories: []
            });
        }
        for (const cat of categoriesData.categories) {
            const rank = ranksMap.get(cat.rank_id);
            if (rank) {
                rank.categories.push({
                    id: cat.id,
                    name: cat.name,
                    color: cat.color || rank.color,
                    activities: []
                });
            }
        }
        for (const act of categoriesData.activity_types) {
            for (const rank of ranksMap.values()) {
                const category = rank.categories.find(c => c.id === act.category_id);
                if (category) {
                    category.activities.push(act.name);
                    break;
                }
            }
        }
        ranksHierarchy = Array.from(ranksMap.values());
        return true;
    } catch (e) {
        showStatus(`Ошибка загрузки справочника: ${e.message}`, true);
        return false;
    }
}

function loadSchedules() {
    const stored = localStorage.getItem(SCHEDULES_KEY);
    if (!stored) {
        schedulesRoot = { current_datetime: getCurrentDateTimeString(), schedules: [] };
        localStorage.setItem(SCHEDULES_KEY, JSON.stringify(schedulesRoot));
        showStatus('Создан новый пустой объект расписаний');
        return true;
    }
    try {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed.current_datetime === 'string' && Array.isArray(parsed.schedules)) {
            schedulesRoot = parsed;
            schedulesRoot.schedules.sort((a, b) => a.date.localeCompare(b.date));
            return true;
        } else {
            showStatus('Ошибка: структура расписаний не соответствует формату', true);
            return false;
        }
    } catch (e) {
        showStatus(`Ошибка парсинга расписаний: ${e.message}`, true);
        return false;
    }
}

function getColorForActivityType(activityTypeId) {
    const act = categoriesData.activity_types.find(a => a.id === activityTypeId);
    if (!act) return '#cccccc';
    const cat = categoriesData.categories.find(c => c.id === act.category_id);
    if (!cat) return '#cccccc';
    const rank = categoriesData.ranks.find(r => r.id === cat.rank_id);
    const color = cat.color || (rank ? rank.color : '#cccccc');
    return color;
}

function getActivityName(activityTypeId) {
    const act = categoriesData.activity_types.find(a => a.id === activityTypeId);
    return act ? act.name : `ID:${activityTypeId}`;
}

function getRankAndCategoryLabels(activityTypeId) {
    const act = categoriesData.activity_types.find(a => a.id === activityTypeId);
    if (!act) return { rankName: '', catName: '' };
    const cat = categoriesData.categories.find(c => c.id === act.category_id);
    if (!cat) return { rankName: '', catName: '' };
    const rank = categoriesData.ranks.find(r => r.id === cat.rank_id);
    return {
        rankName: rank ? rank.name : '',
        catName: cat.name
    };
}

function getNextIdForDay() {
    const activities = currentActivities || [];
    return activities.length ? Math.max(...activities.map(a => a.id)) + 1 : 1;
}

function saveToLocalStorage() {
    if (schedulesRoot) {
        schedulesRoot.current_datetime = getCurrentDateTimeString();
        localStorage.setItem(SCHEDULES_KEY, JSON.stringify(schedulesRoot));
    }
}

// Обновить поле current_datetime для указанной даты
function updateScheduleCurrentDateTime(date) {
    const entry = schedulesRoot.schedules.find(s => s.date === date);
    if (entry) {
        entry.current_datetime = getCurrentDateTimeString();
        saveToLocalStorage();
        return true;
    }
    return false;
}

// Создать новое расписание для даты (если отсутствует) с current_datetime
function ensureScheduleExists(date) {
    let entry = schedulesRoot.schedules.find(s => s.date === date);
    if (!entry) {
        entry = {
            date: date,
            current_datetime: getCurrentDateTimeString(),
            schedule: { activities: [] }
        };
        schedulesRoot.schedules.push(entry);
        saveToLocalStorage();
    }
    return entry;
}