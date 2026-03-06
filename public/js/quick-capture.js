(function initTodayPageEnhancements() {
    const greetingEl = document.getElementById('today-greeting');
    const dateEl = document.getElementById('today-date');
    const todayTasksListEl = document.getElementById('today-tasks-list');

    const journalInput = document.getElementById('today-journal-input');
    const journalSaveBtn = document.getElementById('today-journal-save');
    const noteInput = document.getElementById('today-note-input');
    const noteSaveBtn = document.getElementById('today-note-save');
    const todayTasksStatus = document.getElementById('today-tasks-status');
    const journalStatus = document.getElementById('today-journal-status');
    const noteStatus = document.getElementById('today-note-status');

    const quickBtn = document.getElementById('quick-capture-btn');
    const quickModal = document.getElementById('quick-capture-modal');
    const quickTaskInput = document.getElementById('quick-capture-task');
    const quickNoteInput = document.getElementById('quick-capture-note');
    const quickCancelBtn = document.getElementById('quick-capture-cancel');
    const quickSaveBtn = document.getElementById('quick-capture-save');
    const taskDetailModal = document.getElementById('task-detail-modal');
    const taskDetailClose = document.getElementById('task-detail-close');
    const taskDetailTitle = document.getElementById('task-detail-title');
    const taskDetailMeta = document.getElementById('task-detail-meta');
    const taskDetailDescription = document.getElementById('task-detail-description');

    if (!greetingEl || !dateEl || !todayTasksListEl) return;

    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 12 ? 'Good morning' : (hour < 18 ? 'Good afternoon' : 'Good evening');
    greetingEl.textContent = greeting;
    dateEl.textContent = now.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
    });

    const dateKey = getLocalDateKey(now);
    const journalKey = `hyxmind_today_journal_${dateKey}`;
    const notesKey = `hyxmind_today_note_${dateKey}`;

    if (journalInput) {
        journalInput.value = readStored(journalKey);
        if (journalStatus && journalInput.value.trim()) {
            setInlineStatus(journalStatus, 'Saved draft', 'saved');
        }
    }

    if (noteInput) {
        noteInput.value = readStored(notesKey);
        if (noteStatus && noteInput.value.trim()) {
            setInlineStatus(noteStatus, 'Saved draft', 'saved');
        }
    }

    if (journalSaveBtn && journalInput) {
        journalSaveBtn.addEventListener('click', async () => {
            const content = journalInput.value.trim();
            const localOk = writeStored(journalKey, content);
            const remoteOk = content ? await persistTodayEntry('journal', content, 'Daily Reflection') : true;
            const ok = localOk && remoteOk;
            setSaveFeedback(journalSaveBtn, ok ? 'Saved' : 'Error');
            if (journalStatus) {
                setInlineStatus(journalStatus, ok ? 'Saved now' : 'Save failed', ok ? 'saved' : 'error');
            }
            if (ok) refreshDashboardData();
        });
    }

    if (noteSaveBtn && noteInput) {
        noteSaveBtn.addEventListener('click', async () => {
            const content = noteInput.value.trim();
            const localOk = writeStored(notesKey, content);
            const remoteOk = content ? await persistTodayEntry('gratidao', content) : true;
            const ok = localOk && remoteOk;
            setSaveFeedback(noteSaveBtn, ok ? 'Saved' : 'Error');
            if (noteStatus) {
                setInlineStatus(noteStatus, ok ? 'Saved now' : 'Save failed', ok ? 'saved' : 'error');
            }
            if (ok) refreshDashboardData();
        });
    }

    async function loadTodayTasks() {
        try {
            const res = await fetch('/api/entries/tarefa');
            if (!res.ok) throw new Error('Failed to load tasks');
            const tasks = await res.json();
            const today = new Date();
            const todayOnly = Array.isArray(tasks)
                ? tasks.filter(t => {
                    if (!t || !t.created_at) return false;
                    const created = new Date(t.created_at);
                    return created.getFullYear() === today.getFullYear()
                        && created.getMonth() === today.getMonth()
                        && created.getDate() === today.getDate();
                })
                : [];

            if (!todayOnly.length) {
                todayTasksListEl.innerHTML = '<p class="today-placeholder">No tasks for today yet.</p>';
                if (todayTasksStatus) setInlineStatus(todayTasksStatus, 'No tasks yet');
                return;
            }

            todayTasksListEl.innerHTML = todayOnly
                .map(t => {
                    const title = t.title && String(t.title).trim() ? t.title : (t.content || 'Untitled task');
                    const description = (t.content && String(t.content).trim()) || 'No extra description for this task.';
                    const createdLabel = t.created_at
                        ? new Date(t.created_at).toLocaleString('en-US', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
                        : 'Today';

                    return `
                        <button
                            class="today-task-item"
                            type="button"
                            data-task-title="${escapeAttr(title)}"
                            data-task-description="${escapeAttr(description)}"
                            data-task-meta="${escapeAttr(createdLabel)}"
                        >
                            ${escapeHtml(title)}
                        </button>
                    `;
                })
                .join('');
            bindTodayTaskDetails();
            if (todayTasksStatus) {
                const label = todayOnly.length === 1 ? '1 task today' : `${todayOnly.length} tasks today`;
                setInlineStatus(todayTasksStatus, label, 'saved');
            }
        } catch {
            todayTasksListEl.innerHTML = '<p class="today-placeholder">Unable to load today\'s tasks.</p>';
            if (todayTasksStatus) setInlineStatus(todayTasksStatus, 'Sync failed', 'error');
        }
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function escapeAttr(value) {
        return escapeHtml(value).replace(/`/g, '&#96;');
    }

    function bindTodayTaskDetails() {
        if (!todayTasksListEl || !taskDetailModal || !taskDetailTitle || !taskDetailDescription || !taskDetailMeta) return;
        todayTasksListEl.querySelectorAll('.today-task-item').forEach(item => {
            if (item.dataset.bound === '1') return;
            item.dataset.bound = '1';
            item.addEventListener('click', () => {
                taskDetailTitle.textContent = item.dataset.taskTitle || 'Task Details';
                taskDetailMeta.textContent = item.dataset.taskMeta || 'Today';
                taskDetailDescription.textContent = item.dataset.taskDescription || 'No description.';
                taskDetailModal.classList.add('open');
                taskDetailModal.setAttribute('aria-hidden', 'false');
            });
        });
    }

    function closeTaskDetail() {
        if (!taskDetailModal) return;
        taskDetailModal.classList.remove('open');
        taskDetailModal.setAttribute('aria-hidden', 'true');
    }

    if (taskDetailClose) taskDetailClose.addEventListener('click', closeTaskDetail);
    if (taskDetailModal) {
        taskDetailModal.addEventListener('click', (e) => {
            if (e.target === taskDetailModal) closeTaskDetail();
        });
    }

    function openQuickCapture() {
        if (!quickModal) return;
        quickModal.classList.add('open');
        quickModal.setAttribute('aria-hidden', 'false');
        if (quickTaskInput) quickTaskInput.focus();
    }

    function closeQuickCapture() {
        if (!quickModal) return;
        quickModal.classList.remove('open');
        quickModal.setAttribute('aria-hidden', 'true');
    }

    if (quickBtn) quickBtn.addEventListener('click', openQuickCapture);
    if (quickCancelBtn) quickCancelBtn.addEventListener('click', closeQuickCapture);

    if (quickModal) {
        quickModal.addEventListener('click', (e) => {
            if (e.target === quickModal) closeQuickCapture();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && quickModal && quickModal.classList.contains('open')) {
            closeQuickCapture();
        }
        if (e.key === 'Escape' && taskDetailModal && taskDetailModal.classList.contains('open')) {
            closeTaskDetail();
        }
    });

    if (quickSaveBtn) {
        quickSaveBtn.addEventListener('click', async () => {
            const quickTask = quickTaskInput ? quickTaskInput.value.trim() : '';
            const quickNote = quickNoteInput ? quickNoteInput.value.trim() : '';

            if (quickTask) {
                try {
                    await fetch('/api/entries', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ title: null, content: quickTask, category: 'tarefa' })
                    });
                } catch {}
            }

            if (quickNote) {
                if (noteInput) noteInput.value = quickNote;
                writeStored(notesKey, quickNote);
                if (noteSaveBtn) setSaveFeedback(noteSaveBtn, 'Saved');
                if (noteStatus) setInlineStatus(noteStatus, 'Saved now', 'saved');
            }

            if (quickTaskInput) quickTaskInput.value = '';
            if (quickNoteInput) quickNoteInput.value = '';

            closeQuickCapture();
            loadTodayTasks();
            refreshDashboardData();
        });
    }

    loadTodayTasks();

    async function persistTodayEntry(category, content, title) {
        try {
            const payload = { category, content };
            if (category === 'journal') payload.title = title || '';
            const res = await fetch('/api/entries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            return res.ok;
        } catch {
            return false;
        }
    }

    function refreshDashboardData() {
        if (typeof loadAll === 'function') loadAll();
        if (typeof updateOverview === 'function') updateOverview();
        if (typeof updateProductivityCard === 'function') updateProductivityCard();
    }

    function getLocalDateKey(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function readStored(key) {
        try {
            return localStorage.getItem(key) || sessionStorage.getItem(key) || '';
        } catch {
            try {
                return sessionStorage.getItem(key) || '';
            } catch {
                return '';
            }
        }
    }

    function writeStored(key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch {
            try {
                sessionStorage.setItem(key, value);
                return true;
            } catch {
                return false;
            }
        }
    }

    function setSaveFeedback(button, label) {
        if (!button) return;
        const defaultText = button.dataset.defaultText || button.textContent;
        button.dataset.defaultText = defaultText;
        button.textContent = label;
        button.disabled = true;
        setTimeout(() => {
            button.textContent = defaultText;
            button.disabled = false;
        }, 1200);
    }

    function setInlineStatus(el, text, state) {
        if (!el) return;
        el.textContent = text;
        el.classList.remove('saved', 'error');
        if (state === 'saved') el.classList.add('saved');
        if (state === 'error') el.classList.add('error');
    }
})();
