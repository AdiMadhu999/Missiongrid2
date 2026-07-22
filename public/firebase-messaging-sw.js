// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/12.14.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.14.0/firebase-messaging-compat.js');

firebase.initializeApp({
    messagingSenderId: "43729399220"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/logo.png',
        data: payload.data
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const data = event.notification.data;
    
    // Redirect to the app with information
    const path = `/app/notifications?type=${data.activityType}&id=${data.activityId}`;
    const url = new URL(path, self.location.origin).href;
    
    event.waitUntil(
        clients.matchAll({type: 'window', includeUncontrolled: true}).then((clientList) => {
            for (const client of clientList) {
                if (client.url.includes('/app') && 'focus' in client) {
                    client.focus();
                    client.postMessage({ type: 'NAVIGATE', path });
                    return;
                }
            }
            if (clients.openWindow) return clients.openWindow(url);
        })
    );
});
