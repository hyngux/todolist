// Gestão de Temas
function toggleDarkMode() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
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
        const isDark = theme === 'dark';
        btn.setAttribute('aria-pressed', String(isDark));
        const label = btn.querySelector('.toggle-text');
        if (label) label.textContent = isDark ? 'Light' : 'Dark';
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

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Navegação
function showSection(id, el) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.getElementById('section-' + id).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    el.classList.add('active');
    syncSectionCommandbar(id);
    
    if(id === 'overview') updateOverview();
    loadAll();
}

function syncSectionCommandbar(sectionId) {
    document.querySelectorAll('.section-pill').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.section === sectionId);
    });
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
            const safeDisplayTitle = escapeHtml(displayTitle);
            const safeContent = escapeHtml(e.content || '');
            const safeTitle = escapeHtml(e.title || '');

            return `
                <div class="entry-row" id="row-${e.id}">
                    <div class="entry-header" onclick="${hasBody ? `document.getElementById('row-${e.id}').classList.toggle('open')` : ''}">
                        <div class="entry-main-info">
                            <div class="circle-check ${e.status == 1 ? 'done' : ''}" onclick="event.stopPropagation(); toggleTask(${e.id}, '${cat}')"></div>
                            <span class="entry-text" style="${e.status == 1 ? 'text-decoration:line-through;opacity:0.5' : ''}">${safeDisplayTitle}</span>
                        </div>
                        <div class="entry-meta">
                            <span class="badge-date">${dStr}</span>
                            <span class="badge-time">${tStr}</span>
                            <button class="btn-edit" onclick="event.stopPropagation(); startEdit(${e.id}, '${cat}')">EDIT</button>
                            <button class="btn-del" onclick="event.stopPropagation(); deleteItem(${e.id}, '${cat}')">DEL</button>
                        </div>
                    </div>
                    ${hasBody ? `<div class="entry-body">${safeContent}</div>` : ''}
                    <div class="entry-edit" id="edit-${e.id}">
                        ${(cat === 'journal' || cat === 'tarefa') ? `
                            <input type="text" class="input-minimal edit-title" value="${safeTitle}" placeholder="Título...">
                            <textarea class="input-minimal edit-body" rows="3" placeholder="Conteúdo...">${safeContent}</textarea>
                        ` : `
                            <input type="text" class="input-minimal edit-content" value="${safeContent}" placeholder="Editar...">
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

let confirmDialogReady = false;

function initConfirmDialog() {
    if (confirmDialogReady) return;

    const modal = document.getElementById('confirm-modal');
    const cancelBtn = document.getElementById('confirm-cancel');
    const okBtn = document.getElementById('confirm-ok');
    if (!modal || !cancelBtn || !okBtn) return;

    const resolveAndClose = (value) => {
        const resolver = modal._resolver;
        modal._resolver = null;
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
        if (resolver) resolver(value);
    };

    cancelBtn.addEventListener('click', () => resolveAndClose(false));
    okBtn.addEventListener('click', () => resolveAndClose(true));
    modal.addEventListener('click', (e) => {
        if (e.target === modal) resolveAndClose(false);
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('open')) {
            resolveAndClose(false);
        }
    });

    confirmDialogReady = true;
}

function confirmAction({ title, message, confirmText = 'Delete', cancelText = 'Cancel' }) {
    initConfirmDialog();
    const modal = document.getElementById('confirm-modal');
    if (!modal) return Promise.resolve(window.confirm(message || title || 'Confirmar ação?'));

    const titleEl = document.getElementById('confirm-title');
    const messageEl = document.getElementById('confirm-message');
    const cancelBtn = document.getElementById('confirm-cancel');
    const okBtn = document.getElementById('confirm-ok');

    if (titleEl) titleEl.textContent = title || 'Confirmar ação';
    if (messageEl) messageEl.textContent = message || 'Queres continuar?';
    if (cancelBtn) cancelBtn.textContent = cancelText;
    if (okBtn) okBtn.textContent = confirmText;

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');

    return new Promise(resolve => {
        modal._resolver = resolve;
    });
}

async function deleteItem(id, cat) {
    const confirmed = await confirmAction({
        title: 'Apagar item',
        message: 'Este item vai ser removido permanentemente.',
        confirmText: 'Apagar',
        cancelText: 'Cancelar'
    });
    if (!confirmed) return;

    await authFetch(`/api/entries/${id}?category=${encodeURIComponent(cat)}`, { method: 'DELETE' });
    loadList(cat);
    updateOverview();
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
    if (cat === 'journal' || cat === 'tarefa') {
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
    let currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
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
        const now = new Date();
        const elapsedSeconds = now.getMinutes() * 60 + now.getSeconds();
        const value = Math.min(100, Math.round((elapsedSeconds / 3600) * 100));
        if (loadBar) loadBar.style.width = value + "%";
        if (loadVal) loadVal.textContent = value + "%";
    }

    function updateUptime() {
        const now = new Date();
        if (uptimeEl) uptimeEl.textContent = `${String(now.getMinutes()).padStart(2, '0')}m`;
    }

    updateNeuralLoad();
    updateUptime();
    setInterval(updateNeuralLoad, 1000);
    setInterval(updateUptime, 1000);
})();

// --- Productivity system ---
const TASK_ORDER_KEY = "hyxmind_task_order";
const DAY_MS = 24 * 60 * 60 * 1000;
const TWO_DAYS_MS = 2 * DAY_MS;
let habitsTicking = false;

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
        const safeHabitName = escapeHtml(h.name || '');
        const cooldown = getHabitCooldownMs(h);
        const locked = cooldown > 0;
        const buttonText = locked ? `Wait ${formatCountdown(cooldown)}` : "Done";
        const helperText = getHabitHelperText(h, cooldown);
        const row = document.createElement("div");
        row.className = "habit-row";
        const nextAt = parseHabitDate(h.next_available_at);
        const expiresAt = parseHabitDate(h.expires_at);
        if (nextAt) row.dataset.nextAt = String(nextAt.getTime());
        if (expiresAt) row.dataset.expiresAt = String(expiresAt.getTime());
        row.dataset.streak = String(h.streak || 0);
        row.innerHTML = `
            <div class="habit-info">
                <div class="habit-name">${safeHabitName}</div>
                <div class="habit-streak">Streak: ${h.streak} days</div>
                <div class="habit-timer">${escapeHtml(helperText)}</div>
            </div>
            <div class="habit-actions">
                <button class="habit-btn" type="button" ${locked ? "disabled" : ""}>${escapeHtml(buttonText)}</button>
                <button class="habit-del" type="button">Delete</button>
            </div>
        `;
        row.querySelector(".habit-btn").addEventListener("click", () => completeHabit(h.id));
        row.querySelector(".habit-del").addEventListener("click", () => deleteHabit(h.id));
        list.appendChild(row);
    });

    if (!habitsTicking) {
        habitsTicking = true;
        setInterval(renderHabitsLiveTimers, 1000);
    }
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
        const res = await authFetch(`/api/habits/${id}/complete`, { method: 'PATCH' });
        if (!res.ok && res.status !== 409) {
            throw new Error('Failed to complete habit');
        }
        renderHabits();
        updateProductivityCard();
    } catch (err) {
        console.error("Erro ao completar hábito:", err);
    }
}

async function deleteHabit(id) {
    const confirmed = await confirmAction({
        title: 'Apagar hábito',
        message: 'Este hábito vai ser removido permanentemente.',
        confirmText: 'Apagar',
        cancelText: 'Cancelar'
    });
    if (!confirmed) return;

    try {
        await authFetch(`/api/habits/${id}`, { method: 'DELETE' });
        renderHabits();
        updateProductivityCard();
    } catch (err) {
        console.error("Erro ao apagar hábito:", err);
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

function parseHabitDate(value) {
    if (!value) return null;
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
    const fallback = new Date(String(value).replace(' ', 'T'));
    return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function getHabitCooldownMs(habit) {
    if (typeof habit.remaining_ms === 'number') return Math.max(0, habit.remaining_ms);
    const last = parseHabitDate(habit.last_completed);
    if (!last) return 0;
    return Math.max(0, DAY_MS - (Date.now() - last.getTime()));
}

function getHabitHelperText(habit, cooldownMs) {
    const last = parseHabitDate(habit.last_completed);
    if (!last) return "First check-in starts your streak.";
    if (cooldownMs > 0) return `Next streak in ${formatCountdown(cooldownMs)}.`;
    const elapsed = Date.now() - last.getTime();
    if (elapsed >= TWO_DAYS_MS) return "Missed 48h window. Streak resets on next done.";
    const expires = TWO_DAYS_MS - elapsed;
    return `Window closes in ${formatCountdown(expires)}.`;
}

function formatCountdown(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
    return `${m}m ${String(s).padStart(2, '0')}s`;
}

function renderHabitsLiveTimers() {
    document.querySelectorAll('.habit-row').forEach(row => {
        const timerEl = row.querySelector('.habit-timer');
        const button = row.querySelector('.habit-btn');
        if (!timerEl || !button) return;

        const nextAtMs = Number(row.dataset.nextAt || 0);
        const expiresAtMs = Number(row.dataset.expiresAt || 0);
        const streak = Number(row.dataset.streak || 0);

        if (!nextAtMs) return;

        const now = Date.now();
        const cooldown = Math.max(0, nextAtMs - now);
        if (cooldown > 0) {
            timerEl.textContent = `Next streak in ${formatCountdown(cooldown)}.`;
            button.textContent = `Wait ${formatCountdown(cooldown)}`;
            button.disabled = true;
            return;
        }

        if (expiresAtMs && now > expiresAtMs) {
            timerEl.textContent = "Missed 48h window. Streak resets on next done.";
            button.textContent = "Done";
            button.disabled = false;
            const streakEl = row.querySelector('.habit-streak');
            if (streakEl) streakEl.textContent = `Streak: 0 days`;
            row.dataset.streak = '0';
            return;
        }

        if (expiresAtMs) {
            timerEl.textContent = `Window closes in ${formatCountdown(expiresAtMs - now)}.`;
        } else {
            timerEl.textContent = `Current streak: ${streak} days.`;
        }
        button.textContent = "Done";
        button.disabled = false;
    });
}

function initCalendarShortcut() {
    const openLinkBtn = document.getElementById('calendar-open-link');
    if (!openLinkBtn) return;
    openLinkBtn.addEventListener('click', () => {
        window.location.href = '/calendar.html';
    });
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
    const subEl = document.getElementById('profile-sub');
    try {
        const res = await fetch('/auth/me');
        if (!res.ok) return;
        const data = await res.json();
        let username = '';
        if (nameEl && data.user && data.user.username) {
            username = data.user.username;
            nameEl.textContent = username;
        }

        const prefs = readProfilePrefs();
        if (nameEl && prefs.name) nameEl.textContent = prefs.name;
        if (subEl) subEl.textContent = prefs.sub || 'Welcome back';

        const inputName = document.getElementById('profile-settings-name');
        const inputSub = document.getElementById('profile-settings-sub');
        if (inputName) inputName.value = prefs.name || username || '';
        if (inputSub) inputSub.value = prefs.sub || 'Welcome back';
    } catch (err) {
        const prefs = readProfilePrefs();
        if (nameEl && prefs.name) nameEl.textContent = prefs.name;
        if (subEl) subEl.textContent = prefs.sub || 'Welcome back';
        const inputName = document.getElementById('profile-settings-name');
        const inputSub = document.getElementById('profile-settings-sub');
        if (inputName) inputName.value = prefs.name || '';
        if (inputSub) inputSub.value = prefs.sub || 'Welcome back';
        console.error('Erro ao carregar utilizador:', err);
    }
}

function readProfilePrefs() {
    try {
        return JSON.parse(localStorage.getItem('hyxmind_profile_prefs') || '{}');
    } catch {
        return {};
    }
}

function writeProfilePrefs(prefs) {
    try {
        localStorage.setItem('hyxmind_profile_prefs', JSON.stringify(prefs));
    } catch {}
}

function initProfileSettings() {
    const settingsBtn = document.getElementById('profile-settings-btn');
    const panel = document.getElementById('profile-settings');
    const saveBtn = document.getElementById('profile-settings-save');
    const inputName = document.getElementById('profile-settings-name');
    const inputSub = document.getElementById('profile-settings-sub');
    const nameEl = document.getElementById('profile-name');
    const subEl = document.getElementById('profile-sub');
    const card = document.getElementById('user-profile');
    if (!settingsBtn || !panel || !saveBtn || !nameEl || !subEl || !card) return;

    const closePanel = () => {
        panel.classList.remove('open');
        panel.setAttribute('aria-hidden', 'true');
        settingsBtn.setAttribute('aria-expanded', 'false');
    };

    const openPanel = () => {
        panel.classList.add('open');
        panel.setAttribute('aria-hidden', 'false');
        settingsBtn.setAttribute('aria-expanded', 'true');
    };

    settingsBtn.addEventListener('click', () => {
        if (panel.classList.contains('open')) closePanel();
        else openPanel();
    });

    document.addEventListener('click', (e) => {
        if (!card.contains(e.target)) closePanel();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closePanel();
    });

    saveBtn.addEventListener('click', () => {
        const name = inputName ? inputName.value.trim() : '';
        const sub = inputSub ? inputSub.value.trim() : '';
        if (name) nameEl.textContent = name;
        subEl.textContent = sub || 'Welcome back';
        writeProfilePrefs({ name, sub });
        saveBtn.textContent = 'Saved';
        saveBtn.disabled = true;
        setTimeout(() => {
            saveBtn.textContent = 'Save';
            saveBtn.disabled = false;
        }, 1000);
        closePanel();
    });
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

function initSectionCommandbar() {
    document.querySelectorAll('.section-pill').forEach(btn => {
        btn.addEventListener('click', () => {
            const section = btn.dataset.section;
            const navItem = document.querySelector(`.nav-item[onclick*="${section}"]`);
            if (section && navItem) showSection(section, navItem);
        });
    });

    const activeSection = document.querySelector('.content-section.active');
    if (activeSection && activeSection.id.startsWith('section-')) {
        syncSectionCommandbar(activeSection.id.replace('section-', ''));
    }
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
    initProfileSettings();
    initSectionCommandbar();
    initCalendarShortcut();
    renderHabits();
    updateProductivityCard();
    initTaskDragAndDrop();
});
