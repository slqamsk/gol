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
        blocksContainer.appendChild(block);
    }
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
    const today = new Date().toISOString().slice(0, 10);
    if (currentDate !== today) {
        currentTimeLine.style.display = 'none';
        return;
    }
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const top = minutes;
    if (top >= 0 && top <= 1440) {
        currentTimeLine.style.display = 'block';
        currentTimeLine.style.top = `${top}px`;
        currentTimeBadge.textContent = formatMinutesToTime(minutes);
    } else {
        currentTimeLine.style.display = 'none';
    }
}