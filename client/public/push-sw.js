// KH Attendance — Push & Call Alert Service Worker

self.addEventListener('push', function (event) {
    if (event.data) {
        try {
            const data = event.data.json();
            const isCallAlert = data.type === 'call_alert';

            const options = {
                body: data.body,
                icon: '/icons/icon-192x192.png',
                badge: '/icons/icon-192x192.png',
                vibrate: isCallAlert
                    ? [500, 200, 500, 200, 500, 200, 500, 200, 500] // Long vibration for call alert
                    : [200, 100, 200],
                tag: isCallAlert ? 'call-alert' : 'notification',
                renotify: true,
                requireInteraction: isCallAlert, // Call alert stays until dismissed
                silent: false,
            };

            // For call alerts, add actions
            if (isCallAlert) {
                options.actions = [
                    { action: 'open', title: '📋 Mark Attendance' },
                    { action: 'dismiss', title: 'Dismiss' }
                ];
            }

            event.waitUntil(
                self.registration.showNotification(data.title, options)
            );
        } catch (err) {
            console.error('Push event error: ', err);
        }
    }
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();

    if (event.action === 'dismiss') return;

    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(windowClients => {
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url.includes('/worker') && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});
