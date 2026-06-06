const STORAGE_KEY = 'time-tracker-categories';
let appData = null;
let activePath = null;

function init() {
  buildPalette();
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      appData = JSON.parse(stored);
      document.getElementById('json-input').value = JSON.stringify(appData, null, 2);
      renderTable();
      showStatus('Данные загружены из LocalStorage', 'success');
    } catch(e) { showStatus('Ошибка в сохранённых данных. Очищаю кэш.', 'error'); localStorage.removeItem(STORAGE_KEY); }
  }
}

function buildPalette() {
  const container = document.getElementById('palette-container');
  container.innerHTML = '';

  const resetBtn = document.createElement('button');
  resetBtn.id = 'reset-color-btn';
  resetBtn.className = 'reset-color-option';
  resetBtn.style.marginTop = '12px';
  resetBtn.style.display = 'none';
  resetBtn.textContent = 'Сбросить (убрать собственный цвет)';
  resetBtn.onclick = () => resetColor();
  container.appendChild(resetBtn);

  const table = document.createElement('table');
  table.className = 'palette-table';
  
  const thead = document.createElement('thead');
  thead.innerHTML = `<tr><th>Название</th><th>Name</th></tr>`;
  table.appendChild(thead);
  
  const tbody = document.createElement('tbody');
  COLOR_GROUPS.forEach(group => {
    const trHeader = document.createElement('tr');
    trHeader.innerHTML = `<td colspan="2" class="group-header">${group.title}</td>`;
    tbody.appendChild(trHeader);

    group.colors.forEach(c => {
      const tr = document.createElement('tr');
      tr.style.backgroundColor = c[0];
      tr.style.setProperty('--bg', c[0]);
      tr.onclick = () => applyColor(c[0]);
      tr.innerHTML = `<td>${c[1]}</td><td style="font-family:monospace">${c[0]}</td>`;
      tbody.appendChild(tr);
    });
  });
  table.appendChild(tbody);
  container.appendChild(table);

  const credit = document.createElement('div');
  credit.className = 'credit-line';
  credit.innerHTML = 'Цвета взяты со страницы: <a href="https://findh.org/5060-konverter-tsvetov.html" target="_blank">https://findh.org/5060-konverter-tsvetov.html</a>';
  container.appendChild(credit);
}

function openModal(path) {
  activePath = path;
  const parts = path.split('.');
  const resetBtn = document.getElementById('reset-color-btn');
  if (parts[0] === 'categories') {
    const categoryId = Number(parts[1]);
    const cat = appData.categories.find(c => c.id === categoryId);
    resetBtn.style.display = (cat && cat.color) ? 'inline-block' : 'none';
  } else {
    resetBtn.style.display = 'none';
  }
  document.getElementById('modal-overlay').classList.add('active');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
  activePath = null;
}

document.getElementById('close-modal').onclick = closeModal;
document.getElementById('modal-overlay').onclick = (e) => { if(e.target.id === 'modal-overlay') closeModal(); };

function getColorInfo(value) {
  if (!value) return { name: 'White', ru: 'Белый' };
  const searchVal = value.toLowerCase();
  for(const g of COLOR_GROUPS) {
    const found = g.colors.find(c => c[0].toLowerCase() === searchVal);
    if(found) return { name: found[0], ru: found[1] };
  }
  return { name: value, ru: value };
}

function applyColor(name) {
  if (!activePath || !appData) return;
  
  const parts = activePath.split('.');
  const isCategory = parts[0] === 'categories';
  
  if (isCategory) {
    const categoryId = Number(parts[1]);
    const actualIndex = appData.categories.findIndex(c => c.id === categoryId);
    
    appData.categories[actualIndex].color = name;
    document.getElementById('json-input').value = JSON.stringify(appData, null, 2);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
    
    const td = document.querySelector(`[data-path="${activePath}"]`);
    if(td) {
      const info = getColorInfo(name);
      td.style.backgroundColor = info.name;
      td.style.setProperty('--bg', info.name);
      const existingInfo = td.querySelector('.info-colors');
      if (existingInfo) {
        existingInfo.querySelector('.en').textContent = info.name;
        existingInfo.querySelector('.ru').textContent = info.ru;
      } else {
        td.innerHTML = `<div class="cell"><div class="info-title">${appData.categories[actualIndex].id}. ${appData.categories[actualIndex].name}</div><div class="info-colors">EN: <span class="en">${info.name}</span> | RU: <span class="ru">${info.ru}</span></div></div>`;
      }
    }
    showStatus(`Цвет успешно изменён для категории "${appData.categories[actualIndex].name}"`, 'success');
  } else {
    const rIdx = Number(parts[1]);
    appData.ranks[rIdx].color = name;
    document.getElementById('json-input').value = JSON.stringify(appData, null, 2);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
    
    const td = document.querySelector(`[data-path="${activePath}"]`);
    if(td) {
      const info = getColorInfo(name);
      td.style.backgroundColor = info.name;
      td.style.setProperty('--bg', info.name);
      td.querySelector('.en').textContent = info.name;
      td.querySelector('.ru').textContent = info.ru;
    }
    showStatus(`Цвет успешно изменён для ранга "${appData.ranks[rIdx].name}"`, 'success');
  }
  closeModal();
}

function resetColor() {
  if (!activePath || !appData) return;
  
  const parts = activePath.split('.');
  if (parts[0] !== 'categories') return;
  
  const categoryId = Number(parts[1]);
  const actualIndex = appData.categories.findIndex(c => c.id === categoryId);
  if (actualIndex === -1) return;
  
  const category = appData.categories[actualIndex];
  const rankId = category.rank_id;
  const rank = appData.ranks.find(r => r.id === rankId);
  
  delete appData.categories[actualIndex].color;
  document.getElementById('json-input').value = JSON.stringify(appData, null, 2);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
  
  const td = document.querySelector(`[data-path="${activePath}"]`);
  if(td) {
    const rankInfo = getColorInfo(rank.color);
    td.style.backgroundColor = rankInfo.name;
    td.style.setProperty('--bg', rankInfo.name);
    td.innerHTML = `<div class="cell"><div class="info-title">${category.id}. ${category.name}</div></div>`;
  }
  document.getElementById('reset-color-btn').style.display = 'none';
  showStatus(`Цвет сброшен для категории "${category.name}" (используется цвет ранга)`, 'success');
  closeModal();
}

function renderTable() {
  const tbody = document.getElementById('table-body');
  tbody.innerHTML = '';
  if(!appData?.ranks) return showStatus('Не найден массив "ranks"', 'error');

  appData.ranks.forEach((rank, rIdx) => {
    const cats = appData.categories.filter(c => c.rank_id === rank.id);
    const rankValue = rank.color || 'White';
    const rankInfo = getColorInfo(rankValue);
    
    if (cats.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.className = 'main-td';
      td.style.backgroundColor = rankInfo.name;
      td.style.setProperty('--bg', rankInfo.name);
      td.dataset.path = `ranks.${rIdx}.color`;
      td.innerHTML = `<div class="cell"><div class="info-title">${rank.id}. ${rank.name}</div><div class="info-colors">EN: <span class="en">${rankInfo.name}</span> | RU: <span class="ru">${rankInfo.ru}</span></div></div>`;
      td.onclick = () => openModal(td.dataset.path);
      tr.appendChild(td);
      
      const tdCat = document.createElement('td');
      tdCat.className = 'main-td';
      tdCat.textContent = 'Нет категорий';
      tr.appendChild(tdCat);
      tbody.appendChild(tr);
      return;
    }
    
    cats.forEach((cat, cIdx) => {
      const tr = document.createElement('tr');
      
      if(cIdx === 0) {
        const td = document.createElement('td');
        td.rowSpan = cats.length;
        td.className = 'main-td';
        td.style.backgroundColor = rankInfo.name;
        td.style.setProperty('--bg', rankInfo.name);
        td.dataset.path = `ranks.${rIdx}.color`;
        td.innerHTML = `<div class="cell"><div class="info-title">${rank.id}. ${rank.name}</div><div class="info-colors">EN: <span class="en">${rankInfo.name}</span> | RU: <span class="ru">${rankInfo.ru}</span></div></div>`;
        td.onclick = () => openModal(td.dataset.path);
        tr.appendChild(td);
      }
      
      const catValue = cat.color || rank.color;
      const catInfo = getColorInfo(catValue);
      const tdCat = document.createElement('td');
      tdCat.className = 'main-td';
      tdCat.style.backgroundColor = catInfo.name;
      tdCat.style.setProperty('--bg', catInfo.name);
      tdCat.dataset.path = `categories.${cat.id}.color`;
      
      if (cat.color) {
        tdCat.innerHTML = `<div class="cell"><div class="info-title">${cat.id}. ${cat.name}</div><div class="info-colors">EN: <span class="en">${catInfo.name}</span> | RU: <span class="ru">${catInfo.ru}</span></div></div>`;
      } else {
        tdCat.innerHTML = `<div class="cell"><div class="info-title">${cat.id}. ${cat.name}</div></div>`;
      }
      tdCat.onclick = () => openModal(tdCat.dataset.path);
      tr.appendChild(tdCat);
      tbody.appendChild(tr);
    });
  });
}

function showStatus(msg, type) {
  const el = document.getElementById('status-box');
  el.textContent = msg; el.className = `status ${type}`; el.style.display = 'block';
}

document.getElementById('apply-btn').onclick = () => {
  try {
    appData = JSON.parse(document.getElementById('json-input').value);
    renderTable();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
    showStatus('Данные применены', 'success');
  } catch(e) { showStatus(`Ошибка JSON: ${e.message}`, 'error'); }
};

init();