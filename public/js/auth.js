async function postJson(url, body) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
}

const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = new FormData(loginForm);
        const payload = {
            email: form.get('email'),
            password: form.get('password')
        };
        const errorEl = document.getElementById('login-error');
        if (errorEl) errorEl.textContent = '';
        try {
            await postJson('/auth/login', payload);
            window.location.href = '/';
        } catch (err) {
            if (errorEl) errorEl.textContent = err.message;
        }
    });
}

const registerForm = document.getElementById('register-form');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = new FormData(registerForm);
        const payload = {
            username: form.get('username'),
            email: form.get('email'),
            password: form.get('password')
        };
        const errorEl = document.getElementById('register-error');
        if (errorEl) errorEl.textContent = '';
        try {
            await postJson('/auth/register', payload);
            window.location.href = '/login?created=1';
        } catch (err) {
            if (errorEl) errorEl.textContent = err.message;
        }
    });
}

const urlParams = new URLSearchParams(window.location.search);
const created = urlParams.get('created');
if (created && document.getElementById('login-form')) {
    const success = document.getElementById('login-success');
    if (success) success.textContent = 'Conta criada com sucesso. Faz login.';
}
