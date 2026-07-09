import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const keyContent = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!keyContent) {
  console.error("Error: FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not defined.");
  process.exit(1);
}

const keyPath = path.resolve('firebase-key-temp.json');
try {
  // Write key content to file
  fs.writeFileSync(keyPath, keyContent, 'utf8');
  console.log(`Temporary service account key file written to: ${keyPath}`);

  // Deploy to Firebase Hosting using GOOGLE_APPLICATION_CREDENTIALS
  console.log("Deploying to Firebase Hosting...");
  
  // Set it in process.env and pass it to execSync
  const childEnv = { 
    ...process.env, 
    GOOGLE_APPLICATION_CREDENTIALS: keyPath 
  };
  
  execSync(`firebase deploy --only hosting --project mission-selection-ultimate`, { 
    stdio: 'inherit',
    env: childEnv
  });
  console.log("Firebase Hosting deployment completed successfully!");

} catch (error) {
  console.error("Deployment failed:", error.message || String(error));
  process.exit(1);
} finally {
  // Always clean up the temporary key
  if (fs.existsSync(keyPath)) {
    fs.unlinkSync(keyPath);
    console.log("Temporary service account key file cleaned up.");
  }
}
