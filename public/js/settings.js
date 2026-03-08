function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('theme-btn');
    if (!btn) return;
    const isDark = theme === 'dark';
    btn.setAttribute('aria-pressed', String(isDark));
    const label = btn.querySelector('.toggle-text');
    if (label) label.textContent = isDark ? 'Light' : 'Dark';
}

function initTheme() {
    const saved = localStorage.getItem('hyxmind_theme');
    setTheme(saved === 'dark' ? 'dark' : 'light');
    const btn = document.getElementById('theme-btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        setTheme(next);
        localStorage.setItem('hyxmind_theme', next);
    });
}

async function authFetch(url, options) {
    const res = await fetch(url, options);
    if (res.status === 401) {
        window.location.href = '/login';
        throw new Error('Unauthorized');
    }
    return res;
}

function setFeedback(message, type = 'info') {
    const el = document.getElementById('settings-feedback');
    if (!el) return;
    el.textContent = message;
    el.dataset.type = type;
}

async function loadUser() {
    const res = await authFetch('/auth/me');
    const data = await res.json();
    const user = data?.user || {};
    const usernameInput = document.getElementById('settings-username');
    const emailInput = document.getElementById('settings-email');
    if (usernameInput) usernameInput.value = user.username || '';
    if (emailInput) emailInput.value = user.email || '';
}

async function saveProfile() {
    const usernameInput = document.getElementById('settings-username');
    const username = String(usernameInput?.value || '').trim();
    if (!username) {
        setFeedback('Display name is required.', 'error');
        return;
    }

    const res = await authFetch('/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save profile');
    }

    setFeedback('Profile updated.', 'success');
}

async function savePassword() {
    const currentPassword = String(document.getElementById('settings-current-password')?.value || '');
    const newPassword = String(document.getElementById('settings-new-password')?.value || '');
    const confirmPassword = String(document.getElementById('settings-confirm-password')?.value || '');

    if (!currentPassword || !newPassword || !confirmPassword) {
        setFeedback('Fill all password fields.', 'error');
        return;
    }
    if (newPassword.length < 8) {
        setFeedback('New password must have at least 8 chars.', 'error');
        return;
    }
    if (newPassword !== confirmPassword) {
        setFeedback('Password confirmation does not match.', 'error');
        return;
    }

    const res = await authFetch('/auth/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update password');
    }

    document.getElementById('settings-current-password').value = '';
    document.getElementById('settings-new-password').value = '';
    document.getElementById('settings-confirm-password').value = '';
    setFeedback('Password updated.', 'success');
}

async function logout() {
    try {
        await fetch('/auth/logout', { method: 'POST' });
    } finally {
        window.location.href = '/login';
    }
}

window.addEventListener('load', async () => {
    initTheme();
    setFeedback('Ready', 'info');
    try {
        await loadUser();
    } catch (err) {
        setFeedback(err.message || 'Failed to load profile', 'error');
    }

    const profileBtn = document.getElementById('settings-save-profile');
    const passwordBtn = document.getElementById('settings-save-password');
    const logoutBtn = document.getElementById('settings-logout');

    if (profileBtn) {
        profileBtn.addEventListener('click', async () => {
            try {
                await saveProfile();
            } catch (err) {
                setFeedback(err.message || 'Failed to save profile', 'error');
            }
        });
    }

    if (passwordBtn) {
        passwordBtn.addEventListener('click', async () => {
            try {
                await savePassword();
            } catch (err) {
                setFeedback(err.message || 'Failed to update password', 'error');
            }
        });
    }

    if (logoutBtn) logoutBtn.addEventListener('click', logout);
});
