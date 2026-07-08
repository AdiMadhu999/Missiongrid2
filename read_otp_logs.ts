import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function readOtpLogs() {
  console.log("--- Reading OTP Logs from Firestore ---");
  try {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      console.log("No FIREBASE_SERVICE_ACCOUNT_KEY found");
      return;
    }
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    const app = initializeApp({
      credential: cert(serviceAccount),
      projectId: 'mission-selection-ultimate'
    });
    const db = getFirestore(app, "(default)");
    const logsSnap = await db.collection('otp_logs').orderBy('timestamp', 'desc').limit(20).get();
    console.log(`Found ${logsSnap.size} logs:`);
    logsSnap.forEach(doc => {
      console.log(doc.id, "=>", doc.data());
    });
  } catch (err: any) {
    console.error("Error reading logs:", err);
  }
}

readOtpLogs();
