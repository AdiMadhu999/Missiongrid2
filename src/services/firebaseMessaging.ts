import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

export const requestNotificationPermission = async () => {
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            // In a real app, you'd get the token and send it to your server
            console.log('Notification permission granted.');
            const token = await getToken(messaging, { 
                vapidKey: 'YOUR_VAPID_KEY_HERE' 
            });
            console.log('FCM Token:', token);
            return token;
        }
    } catch (error) {
        console.error('Error requesting notification permission:', error);
    }
    return null;
};

export const onMessageListener = () =>
    new Promise((resolve) => {
        onMessage(messaging, (payload) => {
            resolve(payload);
        });
    });
