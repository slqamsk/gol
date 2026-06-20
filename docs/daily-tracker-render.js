// daily-tracker-render.js
// Отрисовка интерфейса

function renderLegend() {
    const legendContainer = document.getElementById('legend');
    let html = '';
    for (const rank of ranksHierarchy) {
        html += `<div class="legend-rank">
                    <div class="legend-rank-title">
                        <div class="dot" style="background: ${rank.color}"></div>
                        <span>${rank.name} (×${rank.coefficient})</span>
                    </div>
                    <div class="legend-subcats">`;
        for (const cat of rank.categories) {
            html += `<div class="legend-sub">
                        <div class="dot" style="background: ${cat.color}"></div>
                        <span>${cat.name}</span>
                     </div>`;
        }
        html += `</div></div>`;
    }
    legendContainer.innerHTML = html;
}

function calculateColumns(activities) {
    const sorted = [...activities].sort((a, b) => a.start - b.start);
    const ends = [];
    sorted.forEach(act => {
        const s = act.start;
        const e = act.end;
        let col = 0;
        while (ends[col] && ends[col] > s) col++;
        ends[col] = e;
        act._col = col;
    });
    return sorted;
}

function renderActivities() {
    // Отменяем любое висячее ожидание перетаскивания при перерисовке
    if (window.cancelPendingDrag) window.cancelPendingDrag();

    const blocksContainer = document.getElementById('blocks-container');
    blocksContainer.innerHTML = '';
    if (!currentActivities || currentActivities.length === 0) return;

    const acts = currentActivities.map(act => ({
        ...act,
        start: act.start,
        end: act.end,
        delta: act.delta,
        status: act.status,
        comment: act.comment,
        activityTypeId: act.activityTypeId
    }));
    const sortedActs = calculateColumns(acts);
    const blockWidth = 500;
    const gap = 12;
    const maxCol = Math.max(0, ...sortedActs.map(a => a._col || 0));
    blocksContainer.style.width = `${(maxCol + 1) * (blockWidth + gap)}px`;

    for (const act of sortedActs) {
        const top = act.start;
        const height = Math.max(4, act.delta);
        const bgColor = getColorForActivityType(act.activityTypeId);
        const textColor = getContrastColor(bgColor);
        const name = getActivityName(act.activityTypeId);
        const { rankName, catName } = getRankAndCategoryLabels(act.activityTypeId);
        const tagContent = catName ? `${rankName} — ${catName}` : rankName;
        const startTime = formatMinutesToTime(act.start);
        const endTime = formatMinutesToTime(act.end);
        const commentHtml = act.comment ? `<div class="block-comment">💬 ${act.comment}</div>` : '';
        const statusClass = `status-${act.status}`;

        const block = document.createElement('div');
        block.className = `activity-block ${statusClass}`;
        block.style.cssText = `left: ${(act._col || 0) * (blockWidth + gap)}px; top: ${top}px; height: ${height}px; width: ${blockWidth}px; background-color: ${bgColor}; color: ${textColor};`;
        block.innerHTML = `<div class="block-content">
            <span class="block-time">${startTime} — ${endTime}</span>
            <span class="block-delta">${formatDuration(act.delta)}</span>
            <span class="block-rank-tag">${tagContent}</span>
            <span class="block-name">${name}</span>
        </div>${commentHtml}`;
        block.dataset.id = act.id;

        // ===== Обработка двойного клика и перетаскивания =====
        let isDragging = false;
        let clickCount = 0;
        let clickTimer = null;

        // Обработчик двойного клика (открывает редактор)
        block.ondblclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Отменяем ожидание перетаскивания
            if (window.cancelPendingDrag) window.cancelPendingDrag();
            // Если перетаскивание уже активно, не открываем редактор
            if (dragState.active) return;
            if (window.openEditModal) openEditModal(act);
        };

        // Перетаскивание доступно только для статуса не 'done'
        if (act.status !== 'done') {
            block.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();

                // Если перетаскивание уже активно – игнорируем
                if (dragState.active) return;

                const startY = e.clientY;
                let moved = false;

                // Функция для запуска перетаскивания
                const startDragNow = () => {
                    if (window.startDrag && !dragState.active && !pendingDrag.cancel) {
                        window.startDrag(act, block, startY);
                    }
                    // Очищаем pending
                    if (window.cancelPendingDrag) window.cancelPendingDrag();
                };

                // Отменяем предыдущее ожидание
                if (window.cancelPendingDrag) window.cancelPendingDrag();

                // Устанавливаем таймаут 200 мс – если за это время не было движения и не было двойного клика, то начинаем перетаскивание
                pendingDrag.timer = setTimeout(() => {
                    // Если не было движения и не было отмены – начинаем перетаскивание
                    if (!moved && !pendingDrag.cancel) {
                        startDragNow();
                    }
                    pendingDrag.timer = null;
                }, 200);

                // Обработчик движения мыши – если произошло движение, начинаем перетаскивание немедленно
                const moveHandler = (ev) => {
                    // Если уже активно перетаскивание – ничего не делаем
                    if (dragState.active) return;
                    // Если расстояние больше 5 пикселей, считаем это началом перетаскивания
                    const dist = Math.abs(ev.clientY - startY);
                    if (dist > 5) {
                        moved = true;
                        // Отменяем таймаут
                        if (pendingDrag.timer) {
                            clearTimeout(pendingDrag.timer);
                            pendingDrag.timer = null;
                        }
                        // Запускаем перетаскивание сразу
                        if (window.startDrag && !dragState.active && !pendingDrag.cancel) {
                            window.startDrag(act, block, startY);
                        }
                        // Убираем обработчик
                        window.removeEventListener('mousemove', moveHandler);
                        pendingDrag.moveHandler = null;
                    }
                };
                window.addEventListener('mousemove', moveHandler);
                pendingDrag.moveHandler = moveHandler;

                // Обработчик mouseup – отменяем ожидание, если не было движения
                const upHandler = () => {
                    window.removeEventListener('mousemove', moveHandler);
                    if (pendingDrag.timer) {
                        clearTimeout(pendingDrag.timer);
                        pendingDrag.timer = null;
                    }
                    pendingDrag.moveHandler = null;
                    window.removeEventListener('mouseup', upHandler);
                };
                window.addEventListener('mouseup', upHandler);
            });
        }

        blocksContainer.appendChild(block);
    }
    updateBalanceDisplay();
}

function renderTimelineTicks() {
    const ticksContainer = document.getElementById('ticks-container');
    const labelsContainer = document.getElementById('labels-container');
    ticksContainer.innerHTML = '';
    labelsContainer.innerHTML = '';
    for (let m = 0; m <= 1440; m += 5) {
        const top = m;
        const isHour = m % 60 === 0;
        const tick = document.createElement('div');
        tick.className = isHour ? 'tick major' : 'tick minor';
        tick.style.top = `${top}px`;
        ticksContainer.appendChild(tick);
        if (isHour) {
            const label = document.createElement('div');
            label.className = 'time-label';
            label.textContent = formatMinutesToTime(m);
            label.style.top = `${top}px`;
            labelsContainer.appendChild(label);
        }
    }
}

function updateCurrentTimeLine() {
    const currentTimeLine = document.getElementById('current-time-line');
    const currentTimeBadge = document.getElementById('current-time-badge');
    const today = getCurrentDateTimeString().slice(0, 10);
    if (currentDate !== today) {
        currentTimeLine.style.display = 'none';
        return;
    }
    const minutes = getCurrentMinutes();
    const top = minutes;
    if (top >= 0 && top <= 1440) {
        currentTimeLine.style.display = 'block';
        currentTimeLine.style.top = `${top}px`;
        currentTimeBadge.textContent = formatMinutesToTime(minutes);
    } else {
        currentTimeLine.style.display = 'none';
    }
}