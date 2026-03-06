// Gestão de Temas
function toggleDarkMode() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
        localStorage.setItem('hyxmind_theme', next);
    } catch {}
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('theme-btn');
    if (btn) {
        btn.innerText = theme === 'dark' ? "Light Mode" : "Dark Mode";
    }
}

async function authFetch(url, options) {
    const res = await fetch(url, options);
    if (res.status === 401) {
        window.location.href = '/login';
        throw new Error('Unauthorized');
    }
    return res;
}

// Navegação
function showSection(id, el) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.getElementById('section-' + id).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    el.classList.add('active');
    
    if(id === 'overview') updateOverview();
    loadAll();
}

// SALVAR DADOS
async function saveData(cat) {
    const contentInput = document.getElementById(cat + 'Content');
    const titleInput = document.getElementById('journalTitle');
    const taskTitleInput = document.getElementById('tarefaTitle');
    
    if (!contentInput) return;
    const content = contentInput.value;
    const title = cat === 'journal' ? titleInput.value : (cat === 'tarefa' ? (taskTitleInput ? taskTitleInput.value : null) : null);

    if(!content.trim()) return;

    try {
        const res = await authFetch('/api/entries', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ title, content, category: cat })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Erro ao salvar');
        }

        contentInput.value = '';
        if(titleInput && cat === 'journal') titleInput.value = '';
        if(taskTitleInput && cat === 'tarefa') taskTitleInput.value = '';
        loadAll();
        updateOverview();
    } catch (err) {
        console.error("Erro ao salvar:", err);
    }
}

// CARREGAR LISTAS
async function loadList(cat) {
    try {
        const res = await authFetch(`/api/entries/${cat}`);
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Erro ao carregar');
        }
        const data = await res.json();
        if (!Array.isArray(data)) return;
        const container = document.getElementById('list-' + cat);
        if(!container) return;

        container.innerHTML = data.map(e => {
            const date = new Date(e.created_at);
            const dStr = date.toLocaleDateString('pt-PT', {day:'2-digit', month:'2-digit'});
            const tStr = date.toLocaleTimeString('pt-PT', {hour:'2-digit', minute:'2-digit'});
            
            const hasBody = (cat === 'journal' || cat === 'tarefa');
            const displayTitle = (hasBody && e.title) ? e.title : e.content;

            return `
                <div class="entry-row" id="row-${e.id}">
                    <div class="entry-header" onclick="${hasBody ? `document.getElementById('row-${e.id}').classList.toggle('open')` : ''}">
                        <div class="entry-main-info">
                            <div class="circle-check ${e.status == 1 ? 'done' : ''}" onclick="event.stopPropagation(); toggleTask(${e.id}, '${cat}')"></div>
                            <span class="entry-text" style="${e.status == 1 ? 'text-decoration:line-through;opacity:0.5' : ''}">${displayTitle}</span>
                        </div>
                        <div class="entry-meta">
                            <span class="badge-date">${dStr}</span>
                            <span class="badge-time">${tStr}</span>
                            <button class="btn-edit" onclick="event.stopPropagation(); startEdit(${e.id}, '${cat}')">EDIT</button>
                            <button class="btn-del" onclick="event.stopPropagation(); deleteItem(${e.id}, '${cat}')">DEL</button>
                        </div>
                    </div>
                    ${hasBody ? `<div class="entry-body">${e.content}</div>` : ''}
                    <div class="entry-edit" id="edit-${e.id}">
                        ${(cat === 'journal' || cat === 'tarefa') ? `
                            <input type="text" class="input-minimal edit-title" value="${e.title || ''}" placeholder="Título...">
                            <textarea class="input-minimal edit-body" rows="3" placeholder="Conteúdo...">${e.content || ''}</textarea>
                        ` : `
                            <input type="text" class="input-minimal edit-content" value="${e.content || ''}" placeholder="Editar...">
                        `}
                        <div class="edit-actions">
                            <button class="btn-ghost" onclick="event.stopPropagation(); cancelEdit(${e.id})">Cancel</button>
                            <button class="btn-submit btn-save" onclick="event.stopPropagation(); saveEdit(${e.id}, '${cat}')">Save</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error("Erro ao carregar lista:", err);
    }
}

async function toggleTask(id, cat) {
    await authFetch(`/api/entries/${id}/toggle?category=${encodeURIComponent(cat)}`, { method: 'PATCH' });
    loadList(cat);
    updateOverview();
}

async function deleteItem(id, cat) {
    if(confirm("Apagar permanentemente?")) {
        await authFetch(`/api/entries/${id}?category=${encodeURIComponent(cat)}`, { method: 'DELETE' });
        loadList(cat);
        updateOverview();
    }
}

function startEdit(id, cat) {
    const row = document.getElementById(`row-${id}`);
    if (!row) return;
    row.classList.add('editing');
}

function cancelEdit(id) {
    const row = document.getElementById(`row-${id}`);
    if (!row) return;
    row.classList.remove('editing');
}

async function saveEdit(id, cat) {
    const row = document.getElementById(`row-${id}`);
    if (!row) return;

    let payload = {};
    if (cat === 'journal') {
        const titleEl = row.querySelector('.edit-title');
        const bodyEl = row.querySelector('.edit-body');
        payload = {
            title: titleEl ? titleEl.value.trim() : '',
            content: bodyEl ? bodyEl.value.trim() : ''
        };
    } else {
        const contentEl = row.querySelector('.edit-content');
        payload = { content: contentEl ? contentEl.value.trim() : '' };
    }

    if (!payload.content) return;

    try {
        await authFetch(`/api/entries/${id}`, {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ ...payload, category: cat })
        });
        row.classList.remove('editing');
        loadList(cat);
        updateOverview();
        updateProductivityCard();
    } catch (err) {
        console.error("Erro ao editar:", err);
    }
}

async function updateOverview() {
    try {
        const resT = await authFetch('/api/entries/tarefa');
        const tasks = await resT.json();
        document.getElementById('task-count').innerText = tasks.filter(t => t.status == 1).length;

        const resJ = await authFetch('/api/entries/journal');
        const journals = await resJ.json();
        if(journals.length > 0) {
            document.getElementById('overview-recent').innerHTML = `<strong>${journals[0].title || 'Sem título'}</strong><br>${journals[0].content.substring(0, 50)}...`;
        }
    } catch (err) {
        console.error("Erro no overview:", err);
    }
}

function loadAll() {
    ['journal', 'tarefa', 'gratidao'].forEach(loadList);
}

// Inicialização
window.onload = () => {
    let currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    try {
        const saved = localStorage.getItem('hyxmind_theme');
        if (saved) currentTheme = saved;
    } catch {}
    setTheme(currentTheme);
    loadAll();
    updateOverview();
};

// --- Sidebar widgets ---
(function initSidebarWidgets() {
    const loadBar = document.getElementById("neural-load-bar");
    const loadVal = document.getElementById("neural-load-value");
    const uptimeEl = document.getElementById("daily-uptime");

    function updateNeuralLoad() {
        const value = Math.floor(Math.random() * 61) + 20; // 20–80%
        if (loadBar) loadBar.style.width = value + "%";
        if (loadVal) loadVal.textContent = value + "%";
    }

    function updateUptime() {
        const now = new Date();
        const hours = now.getHours();
        if (uptimeEl) uptimeEl.textContent = hours + "h";
    }

    const dayStrip = document.querySelectorAll("#mini-day-picker .day-strip span");
    const today = new Date().getDay(); // 0=Sun
    dayStrip.forEach(el => {
        if (Number(el.dataset.day) === today) el.classList.add("active");
    });

    const syncBtn = document.getElementById("quick-sync-btn");
    if (syncBtn) {
        syncBtn.addEventListener("click", () => console.log("Sync triggered"));
    }

    const resetBtn = document.getElementById("reset-view-btn");
    if (resetBtn) {
        resetBtn.addEventListener("click", () => {
            const overviewNav = document.querySelector(".nav-item[onclick*=\"overview\"]") || document.querySelector(".nav-item");
            if (overviewNav) showSection("overview", overviewNav);
        });
    }

    updateNeuralLoad();
    updateUptime();
    setInterval(updateNeuralLoad, 10000);
    setInterval(updateUptime, 60000);
})();

// --- Productivity system ---
const TASK_ORDER_KEY = "hyxmind_task_order";

function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

async function fetchHabits() {
    try {
        const res = await authFetch('/api/habits');
        if (!res.ok) return [];
        return await res.json();
    } catch {
        return [];
    }
}

async function renderHabits() {
    const list = document.getElementById("habit-list");
    if (!list) return;

    const habits = await fetchHabits();
    list.innerHTML = "";

    habits.forEach(h => {
        const row = document.createElement("div");
        row.className = "habit-row";
        row.innerHTML = `
            <div class="habit-info">
                <div class="habit-name">${h.name}</div>
                <div class="habit-streak">Streak: ${h.streak} days</div>
            </div>
            <button class="habit-btn" type="button">Done</button>
        `;
        row.querySelector(".habit-btn").addEventListener("click", () => completeHabit(h.id));
        list.appendChild(row);
    });
}

async function addHabit() {
    const input = document.getElementById("habit-name");
    if (!input) return;
    const name = input.value.trim();
    if (!name) return;

    try {
        await authFetch('/api/habits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        input.value = "";
        renderHabits();
        updateProductivityCard();
    } catch (err) {
        console.error("Erro ao criar hábito:", err);
    }
}

async function completeHabit(id) {
    try {
        await authFetch(`/api/habits/${id}/complete`, { method: 'PATCH' });
        renderHabits();
        updateProductivityCard();
    } catch (err) {
        console.error("Erro ao completar hábito:", err);
    }
}

async function updateProductivityCard() {
    const todayEl = document.getElementById("prod-today");
    const activeEl = document.getElementById("prod-active");
    const streakEl = document.getElementById("prod-streak");
    const focusEl = document.getElementById("prod-focus");
    if (!todayEl || !activeEl || !streakEl || !focusEl) return;

    let tasks = [];
    try {
        const res = await authFetch("/api/entries/tarefa");
        if (!res.ok) {
            tasks = [];
        } else {
            tasks = await res.json();
        }
    } catch {
        tasks = [];
    }
    if (!Array.isArray(tasks)) tasks = [];

    const today = startOfDay(new Date());
    const completed = tasks.filter(t => t.status == 1);
    const completedToday = completed.filter(t => {
        const created = new Date(t.created_at);
        return startOfDay(created).getTime() === today.getTime();
    }).length;

    const total = tasks.length;
    const active = total - completed.length;
    const focus = total ? Math.round((completed.length / total) * 100) : 0;

    const habits = await fetchHabits();
    const maxStreak = habits.reduce((max, h) => Math.max(max, h.streak || 0), 0);

    todayEl.textContent = completedToday;
    activeEl.textContent = active;
    streakEl.textContent = `${maxStreak} days`;
    focusEl.textContent = `${focus}%`;
}

function getTaskOrder() {
    try {
        return JSON.parse(localStorage.getItem(TASK_ORDER_KEY)) || [];
    } catch {
        return [];
    }
}

function setTaskOrder(order) {
    localStorage.setItem(TASK_ORDER_KEY, JSON.stringify(order));
}

function applyTaskOrder(container) {
    const rows = Array.from(container.querySelectorAll(".entry-row"));
    rows.forEach(r => {
        if (!r.dataset.taskId && r.id && r.id.startsWith("row-")) {
            r.dataset.taskId = r.id.replace("row-", "");
        }
    });

    const order = getTaskOrder();
    if (order.length) {
        const map = new Map(rows.map(r => [r.dataset.taskId, r]));
        order.forEach(id => {
            const el = map.get(String(id));
            if (el) container.appendChild(el);
        });
        rows.forEach(r => {
            if (!order.includes(String(r.dataset.taskId))) container.appendChild(r);
        });
    }

    const newOrder = Array.from(container.querySelectorAll(".entry-row")).map(r => String(r.dataset.taskId));
    setTaskOrder(newOrder);
}

function initTaskDragAndDrop() {
    const container = document.getElementById("list-tarefa");
    if (!container) return;

    if (!container.dataset.dndInit) {
        container.addEventListener("dragover", handleDragOver);
        container.addEventListener("drop", handleDrop);
        container.dataset.dndInit = "1";
    }

    const rows = Array.from(container.querySelectorAll(".entry-row"));
    rows.forEach(row => {
        if (row.dataset.dndInit) return;
        row.classList.add("task-draggable");
        row.setAttribute("draggable", "true");
        if (!row.dataset.taskId && row.id && row.id.startsWith("row-")) {
            row.dataset.taskId = row.id.replace("row-", "");
        }
        row.addEventListener("dragstart", handleDragStart);
        row.addEventListener("dragend", handleDragEnd);
        row.addEventListener("dragenter", handleDragEnter);
        row.addEventListener("dragleave", handleDragLeave);
        row.dataset.dndInit = "1";
    });

    applyTaskOrder(container);
}

function handleDragStart(e) {
    const row = e.currentTarget;
    row.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
}

function handleDragEnd(e) {
    const row = e.currentTarget;
    row.classList.remove("dragging");
    row.classList.remove("drag-over");
    const container = document.getElementById("list-tarefa");
    if (container) {
        const order = Array.from(container.querySelectorAll(".entry-row")).map(r => String(r.dataset.taskId));
        setTaskOrder(order);
    }
}

function handleDragEnter(e) {
    e.currentTarget.classList.add("drag-over");
}

function handleDragLeave(e) {
    e.currentTarget.classList.remove("drag-over");
}

function handleDragOver(e) {
    e.preventDefault();
    const container = document.getElementById("list-tarefa");
    if (!container) return;
    const dragging = container.querySelector(".dragging");
    if (!dragging) return;

    const after = getDragAfterElement(container, e.clientY);
    if (after == null) {
        container.appendChild(dragging);
    } else {
        container.insertBefore(dragging, after);
    }
}

function handleDrop(e) {
    e.preventDefault();
    const container = document.getElementById("list-tarefa");
    if (!container) return;
    const order = Array.from(container.querySelectorAll(".entry-row")).map(r => String(r.dataset.taskId));
    setTaskOrder(order);
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll(".entry-row:not(.dragging)")];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

async function loadUserProfile() {
    const nameEl = document.getElementById('profile-name');
    try {
        const res = await fetch('/auth/me');
        if (!res.ok) return;
        const data = await res.json();
        if (nameEl && data.user && data.user.username) {
            nameEl.textContent = data.user.username;
        }
    } catch (err) {
        console.error('Erro ao carregar utilizador:', err);
    }
}

function initLogout() {
    const btn = document.getElementById('logout-btn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
        try {
            await fetch('/auth/logout', { method: 'POST' });
            window.location.href = '/login';
        } catch (err) {
            console.error('Erro ao sair:', err);
        }
    });
}

const _loadList = loadList;
loadList = async function(cat) {
    await _loadList(cat);
    if (cat === "tarefa") initTaskDragAndDrop();
    updateProductivityCard();
};

const _saveData = saveData;
saveData = async function(cat) {
    await _saveData(cat);
    if (cat === "tarefa") initTaskDragAndDrop();
    updateProductivityCard();
};

const _toggleTask = toggleTask;
toggleTask = async function(id, cat) {
    await _toggleTask(id, cat);
    updateProductivityCard();
};

const _deleteItem = deleteItem;
deleteItem = async function(id, cat) {
    await _deleteItem(id, cat);
    updateProductivityCard();
};

window.addEventListener("load", () => {
    loadUserProfile();
    initLogout();
    renderHabits();
    updateProductivityCard();
    initTaskDragAndDrop();
});
