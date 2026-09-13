// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, FacebookAuthProvider, signInWithPopup, signOut, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, push, set, onValue, update, remove, get, child, query, orderByChild, equalTo, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyDW1u0V41aKuphDC4FUdDsSZX7wUlb6twk", // ⚠️ أضف مفتاح API من Firebase Console
    authDomain: "cmd1-1c696.firebaseapp.com",
    databaseURL: "https://cmd1-1c696-default-rtdb.firebaseio.com/",
    projectId: "cmd1-1c696",
    storageBucket: "cmd1-1c696.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Providers
const googleProvider = new GoogleAuthProvider();
const facebookProvider = new FacebookAuthProvider();

export { 
    auth, db, ref, push, set, onValue, update, remove, get, child,
    query, orderByChild, equalTo, serverTimestamp,
    googleProvider, facebookProvider,
    signInWithPopup, signOut, onAuthStateChanged,
    createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile
};
