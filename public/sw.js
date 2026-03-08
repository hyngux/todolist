self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
    let payload = {};
    try {
        payload = event.data ? event.data.json() : {};
    } catch {
        payload = { body: event.data ? event.data.text() : 'New notification' };
    }

    const title = payload.title || 'HYX Reminder';
    const options = {
        body: payload.body || 'You have an update.',
        data: {
            url: payload.url || '/'
        }
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = event.notification?.data?.url || '/';

    event.waitUntil((async () => {
        const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
        const existing = allClients.find(c => c.url.includes(self.location.origin));
        if (existing) {
            existing.focus();
            existing.navigate(targetUrl);
            return;
        }
        await clients.openWindow(targetUrl);
    })());
});
