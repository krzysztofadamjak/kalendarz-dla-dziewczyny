import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  // Skopiuj te dane z konsoli Firebase (Project settings)
  apiKey: "TWÓJ_API_KEY",
  authDomain: "twoj-projekt.firebaseapp.com",
  projectId: "twoj-projekt",
  storageBucket: "twoj-projekt.appspot.com",
  messagingSenderId: "123456789",
  appId: "TWÓJ_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);