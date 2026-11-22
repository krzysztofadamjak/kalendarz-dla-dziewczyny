import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  // Skopiuj te dane z konsoli Firebase (Project settings)
  apiKey: "AIzaSyCacqtdm7yyveKNDsAPbZPJ2ilzn3vwWuQ",
  authDomain: "kalendarz-adwentowy-3dd00.firebaseapp.com",
  projectId: "kalendarz-adwentowy-3dd00",
  storageBucket: "kalendarz-adwentowy-3dd00.firebasestorage.app",
  messagingSenderId: "338068061344",
  appId: "1:338068061344:web:adf7538c710cc099351dc5"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);