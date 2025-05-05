import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD1VqFbIt9eQc0wHxek8HklX0UE1kjc9sI",
  authDomain: "mina-18e40.firebaseapp.com",
  projectId: "mina-18e40",
  storageBucket: "mina-18e40.firebasestorage.app",
  messagingSenderId: "534656714401",
  appId: "1:534656714401:web:22453131894c9b287512e0",
  measurementId: "G-MV5FF7NWZ1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const analytics = getAnalytics(app);
const googleProvider = new GoogleAuthProvider();

export { app, auth, googleProvider, analytics };