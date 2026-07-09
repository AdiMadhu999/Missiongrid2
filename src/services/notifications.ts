import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export const sendNotification = async (receiverId: string, senderId: string, activityType: any, activityId: string, title: string, description: string) => {
    if (receiverId === senderId) return;
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
};
