(function initPushNotifications() {
    const enableBtn = document.getElementById('enable-notifications-btn');
    const testBtn = document.getElementById('test-notification-btn');
    const statusEl = document.getElementById('notification-status');
    const indicatorEl = document.getElementById('notification-indicator');

    if (!enableBtn && !testBtn) return;

    const supported = ('serviceWorker' in navigator) && ('PushManager' in window) && ('Notification' in window);
    if (!supported) {
        setStatus('Unsupported');
        setEnabledVisual(false);
        if (enableBtn) enableBtn.disabled = true;
        if (testBtn) testBtn.disabled = true;
        return;
    }

    if (!window.isSecureContext) {
        setStatus('HTTPS needed');
        setEnabledVisual(false);
        if (enableBtn) enableBtn.disabled = true;
        if (testBtn) testBtn.disabled = true;
        return;
    }

    let swRegistration = null;

    if (enableBtn) {
        enableBtn.addEventListener('click', async () => {
            try {
                swRegistration = swRegistration || await navigator.serviceWorker.register('/sw.js');
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') {
                    setStatus('Notifications permission denied.');
                    return;
                }

                const publicKey = await fetchPublicKey();
                if (!publicKey) throw new Error('Push public key missing');

                let subscription = await swRegistration.pushManager.getSubscription();
                if (!subscription) {
                    subscription = await swRegistration.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: urlBase64ToUint8Array(publicKey)
                    });
                }

                const saveRes = await fetch('/api/push/subscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ subscription })
                });
                if (!saveRes.ok) {
                    let msg = 'Failed to save push subscription';
                    try {
                        const data = await saveRes.json();
                        if (data?.error) msg = data.error;
                    } catch {}
                    if (saveRes.status === 401) msg = 'You are not logged in.';
                    throw new Error(msg);
                }

                setStatus('Notifications enabled.');
                setEnabledVisual(true);
                if (testBtn) testBtn.disabled = false;
            } catch (err) {
                console.error(err);
                setStatus(`Could not enable notifications: ${err?.message || 'Unknown error'}`);
                setEnabledVisual(false);
            }
        });
    }

    if (testBtn) {
        testBtn.addEventListener('click', async () => {
            try {
                const res = await fetch('/api/push/test', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: 'HYX Test Notification',
                        body: 'Push is working on your device.',
                        url: '/'
                    })
                });
                if (!res.ok) {
                    let msg = 'Failed to send test push';
                    try {
                        const data = await res.json();
                        if (data?.error) msg = data.error;
                    } catch {}
                    if (res.status === 401) msg = 'You are not logged in.';
                    throw new Error(msg);
                }
                setStatus('Test notification sent.');
            } catch (err) {
                console.error(err);
                setStatus(`Failed to send test notification: ${err?.message || 'Unknown error'}`);
            }
        });
    }

    bootstrap();

    async function bootstrap() {
        try {
            swRegistration = await navigator.serviceWorker.register('/sw.js');
            const permissionGranted = Notification.permission === 'granted';
            const sub = await swRegistration.pushManager.getSubscription();
            if (permissionGranted && sub) {
                setStatus('On');
                setEnabledVisual(true);
                if (testBtn) testBtn.disabled = false;
            } else {
                setStatus('Off');
                setEnabledVisual(false);
                if (testBtn) testBtn.disabled = true;
            }
        } catch (err) {
            console.error(err);
            setStatus(`Push setup failed: ${err?.message || 'Unknown error'}`);
            setEnabledVisual(false);
            if (testBtn) testBtn.disabled = true;
        }
    }

    function setStatus(text) {
        if (!statusEl) return;
        statusEl.textContent = text;
    }

    function setEnabledVisual(enabled) {
        if (enableBtn) enableBtn.classList.toggle('active', Boolean(enabled));
        if (indicatorEl) indicatorEl.dataset.enabled = enabled ? '1' : '0';
    }

    async function fetchPublicKey() {
        const endpoints = ['/push/public-key', '/api/push/public-key'];
        let lastError = null;
        for (const endpoint of endpoints) {
            try {
                const res = await fetch(endpoint);
                if (!res.ok) {
                    if (res.status === 401) throw new Error('You are not logged in.');
                    throw new Error(`Public key endpoint failed (${res.status})`);
                }
                const data = await res.json();
                if (data?.publicKey) return data.publicKey;
            } catch (err) {
                lastError = err;
            }
        }
        throw lastError || new Error('Failed to load push public key');
    }

    function urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; i += 1) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }
})();
