import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, addDoc, doc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  // need to get from .env
};
// I can just read it from firebase-applet-config.json
