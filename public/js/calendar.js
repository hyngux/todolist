(function initCalendarPage() {
    const monthEl = document.getElementById('calendar-page-month');
    const gridEl = document.getElementById('calendar-large-grid');
    const prevBtn = document.getElementById('calendar-page-prev');
    const nextBtn = document.getElementById('calendar-page-next');
    const sideDateEl = document.getElementById('calendar-side-date');
    const titleInput = document.getElementById('calendar-page-title');
    const timeInput = document.getElementById('calendar-page-time');
    const descInput = document.getElementById('calendar-page-desc');
    const saveBtn = document.getElementById('calendar-page-save');
    const listEl = document.getElementById('calendar-page-list');
    const themeBtn = document.getElementById('theme-btn');

    if (!monthEl || !gridEl || !prevBtn || !nextBtn || !sideDateEl || !titleInput || !timeInput || !descInput || !saveBtn || !listEl) return;

    setupTheme(themeBtn);

    const now = new Date();
    const state = {
        viewYear: now.getFullYear(),
        viewMonth: now.getMonth(),
        selectedDate: toDateKey(now),
        data: {}
    };

    bootstrap();

    async function bootstrap() {
        const ok = await ensureAuthenticated();
        if (!ok) return;
        await loadMonthData();
        renderCalendar();
        renderDayPanel();
    }

    async function loadMonthData() {
        const month = `${state.viewYear}-${String(state.viewMonth + 1).padStart(2, '0')}`;
        const res = await fetch(`/api/calendar/tasks?month=${month}`);
        if (!res.ok) throw new Error('Failed to load calendar tasks');
        const rows = await res.json();
        const grouped = {};
        rows.forEach(row => {
            const dueAt = row.due_at ? new Date(row.due_at) : null;
            if (!dueAt || Number.isNaN(dueAt.getTime())) return;
            const key = toDateKey(dueAt);
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push({
                id: row.id,
                title: row.title || 'Untitled',
                description: row.description || '',
                done: Boolean(row.done),
                dueAt: dueAt.toISOString()
            });
        });
        state.data = grouped;
    }

    function renderCalendar() {
        const firstDay = new Date(state.viewYear, state.viewMonth, 1);
        const startWeekday = firstDay.getDay();
        const totalDays = new Date(state.viewYear, state.viewMonth + 1, 0).getDate();
        monthEl.textContent = firstDay.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        gridEl.innerHTML = labels.map(label => `<div class="calendar-large-weekday">${label}</div>`).join('');

        const cells = [];
        for (let i = 0; i < startWeekday; i += 1) cells.push('<div class="calendar-large-empty"></div>');

        for (let day = 1; day <= totalDays; day += 1) {
            const date = new Date(state.viewYear, state.viewMonth, day);
            const key = toDateKey(date);
            const items = Array.isArray(state.data[key]) ? state.data[key] : [];
            const status = getCalendarDayStatus(items, date);
            const isToday = key === toDateKey(new Date());
            const isSelected = key === state.selectedDate;
            const pending = items.filter(item => !item.done).length;

            cells.push(`
                <button class="calendar-large-day ${status} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" type="button" data-day-key="${key}">
                    <span class="calendar-large-num">${day}</span>
                    ${pending ? `<span class="calendar-large-pill">${pending}</span>` : ''}
                </button>
            `);
        }

        gridEl.insertAdjacentHTML('beforeend', cells.join(''));
        gridEl.querySelectorAll('.calendar-large-day').forEach(btn => {
            btn.addEventListener('click', () => {
                state.selectedDate = btn.dataset.dayKey;
                renderCalendar();
                renderDayPanel();
            });
        });
    }

    function renderDayPanel() {
        const selected = new Date(`${state.selectedDate}T00:00:00`);
        sideDateEl.textContent = selected.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        const items = state.data[state.selectedDate] || [];
        if (!items.length) {
            listEl.innerHTML = '<p class="today-placeholder">No tasks for this day.</p>';
            return;
        }

        listEl.innerHTML = items.map((item) => {
            const due = new Date(item.dueAt);
            const late = !item.done && due.getTime() < Date.now();
            return `
                <div class="calendar-item ${item.done ? 'done' : ''}">
                    <div class="calendar-item-title">${escapeHtml(item.title || 'Untitled')}</div>
                    <div class="calendar-item-desc">${escapeHtml(item.description || '')}</div>
                    <div class="calendar-item-meta ${late ? 'late' : 'due'}">${item.done ? 'Done' : `${late ? 'Late' : 'Due'} · ${formatPlannerDue(due)}`}</div>
                    <div class="calendar-item-actions">
                        <button class="btn-ghost calendar-item-toggle" type="button" data-id="${item.id}" data-done="${item.done ? '1' : '0'}">${item.done ? 'Undo' : 'Done'}</button>
                        <button class="calendar-item-del" type="button" data-id="${item.id}">Delete</button>
                    </div>
                </div>
            `;
        }).join('');

        listEl.querySelectorAll('.calendar-item-toggle').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                const done = btn.dataset.done !== '1';
                await fetch(`/api/calendar/tasks/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ done })
                });
                await loadMonthData();
                renderCalendar();
                renderDayPanel();
            });
        });

        listEl.querySelectorAll('.calendar-item-del').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                await fetch(`/api/calendar/tasks/${id}`, { method: 'DELETE' });
                await loadMonthData();
                renderCalendar();
                renderDayPanel();
            });
        });
    }

    saveBtn.addEventListener('click', async () => {
        const title = titleInput.value.trim();
        const description = descInput.value.trim();
        if (!title && !description) return;

        const dueAt = buildDueAt(state.selectedDate, timeInput.value);
        const res = await fetch('/api/calendar/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: title || 'Untitled',
                description,
                dueAt
            })
        });
        if (!res.ok) return;

        titleInput.value = '';
        descInput.value = '';
        timeInput.value = '';
        await loadMonthData();
        renderCalendar();
        renderDayPanel();
    });

    prevBtn.addEventListener('click', async () => {
        state.viewMonth -= 1;
        if (state.viewMonth < 0) {
            state.viewMonth = 11;
            state.viewYear -= 1;
        }
        await loadMonthData();
        renderCalendar();
        renderDayPanel();
    });

    nextBtn.addEventListener('click', async () => {
        state.viewMonth += 1;
        if (state.viewMonth > 11) {
            state.viewMonth = 0;
            state.viewYear += 1;
        }
        await loadMonthData();
        renderCalendar();
        renderDayPanel();
    });

    async function ensureAuthenticated() {
        try {
            const res = await fetch('/auth/me');
            if (!res.ok) {
                window.location.href = '/login';
                return false;
            }
            return true;
        } catch {
            window.location.href = '/login';
            return false;
        }
    }

    function setupTheme(btn) {
        if (!btn) return;
        let theme = document.documentElement.getAttribute('data-theme') || 'light';
        try {
            const saved = localStorage.getItem('hyxmind_theme');
            if (saved) theme = saved;
        } catch {}
        setTheme(theme);

        btn.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme') || 'light';
            const next = current === 'dark' ? 'light' : 'dark';
            setTheme(next);
            try {
                localStorage.setItem('hyxmind_theme', next);
            } catch {}
        });

        function setTheme(next) {
            document.documentElement.setAttribute('data-theme', next);
            const isDark = next === 'dark';
            btn.setAttribute('aria-pressed', String(isDark));
            const label = btn.querySelector('.toggle-text');
            if (label) label.textContent = isDark ? 'Light' : 'Dark';
        }
    }

    function toDateKey(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function buildDueAt(dateKey, hhmm) {
        const time = hhmm && /^\d{2}:\d{2}$/.test(hhmm) ? `${hhmm}:00` : '23:59:00';
        return `${dateKey}T${time}`;
    }

    function formatPlannerDue(date) {
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function getCalendarDayStatus(items, dayDate) {
        const list = Array.isArray(items) ? items : [];
        const openItems = list.filter(item => !item.done);
        if (!openItems.length) return list.length ? 'done' : '';
        const dayKey = toDateKey(dayDate);
        const hasLate = openItems.some(item => new Date(item.dueAt || `${dayKey}T23:59:00`).getTime() < Date.now());
        return hasLate ? 'late' : 'due';
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
})();
