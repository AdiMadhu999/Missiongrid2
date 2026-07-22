import { db, getFirebaseFunctions } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

export const sendNotification = async (receiverId: string, senderId: string, activityType: any, activityId: string, title: string, description: string) => {
    if (receiverId === senderId) return;
    
    // 1. Create the notification document in Firestore for the UI
    await addDoc(collection(db, 'notifications'), {
        receiverId,
        senderId,
        activityType,
        activityId,
        title,
        description,
        read: false,
        createdAt: serverTimestamp()
    });

    // 2. Trigger the cloud function for push notification
    try {
        const functions = getFirebaseFunctions();
        const sendPush = httpsCallable(functions, 'sendPushNotification');
        await sendPush({
            receiverId,
            title,
            description,
            activityId,
            activityType
        });
    } catch (error) {
        console.error('Error triggering push notification:', error);
    }
};

