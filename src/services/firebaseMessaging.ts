import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

let messagingPromise: Promise<any> | null = null;

const getMessagingInstance = async () => {
    if (!messagingPromise) {
        messagingPromise = (async () => {
            try {
                if (typeof window !== 'undefined' && await isSupported()) {
                    return getMessaging(app);
                }
            } catch (err) {
                console.warn('[FCM] Firebase Messaging is not supported in this browser environment:', err);
            }
            return null;
        })();
    }
    return messagingPromise;
};

export const requestNotificationPermission = async () => {
    try {
        if (typeof window === 'undefined' || !('Notification' in window)) {
            return null;
        }
        const messaging = await getMessagingInstance();
        if (!messaging) {
            console.log('[FCM] Notification messaging is not supported in this browser/webview.');
            return null;
        }

        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            try {
                const token = await getToken(messaging, { 
                    vapidKey: 'YOUR_VAPID_KEY_HERE' 
                });
                console.log('FCM Token:', token);
                return token;
            } catch (tokenErr) {
                console.warn('[FCM] Could not retrieve FCM token:', tokenErr);
                return null;
            }
        }
    } catch (error) {
        console.warn('Error requesting notification permission:', error);
    }
    return null;
};

export const onMessageListener = () =>
    new Promise((resolve) => {
        getMessagingInstance().then((messaging) => {
            if (messaging) {
                onMessage(messaging, (payload) => {
                    resolve(payload);
                });
            } else {
                resolve(null);
            }
        }).catch((err) => {
            console.warn('[FCM] onMessageListener error:', err);
            resolve(null);
        });
    });

