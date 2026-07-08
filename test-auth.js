import { initializeApp } from "firebase/app";
import { getAuth, signInWithCustomToken } from "firebase/auth";
import fs from "fs";

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const auth = getAuth(app);

const token = process.argv[2];
signInWithCustomToken(auth, token)
  .then((userCredential) => {
    console.log("Signed in as:", userCredential.user.uid);
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error signing in:", error);
    process.exit(1);
  });
