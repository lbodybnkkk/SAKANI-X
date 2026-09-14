import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, GoogleAuthProvider, FacebookAuthProvider, 
    signInWithPopup, signOut, onAuthStateChanged, 
    createUserWithEmailAndPassword, signInWithEmailAndPassword, 
    updateProfile, sendPasswordResetEmail 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getDatabase, ref, push, set, onValue, update, remove, 
    get, child, query, orderByChild, equalTo, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyDW1u0V41aKuphDC4FUdDsSZX7wUlb6twk",
    authDomain: "cmd1-1c696.firebaseapp.com",
    databaseURL: "https://cmd1-1c696-default-rtdb.firebaseio.com/",
    projectId: "cmd1-1c696",
    storageBucket: "cmd1-1c696.appspot.com",
    messagingSenderId: "453052774738",
    appId: "1:453052774738:web:af04e9df543cc42a57628b"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const googleProvider = new GoogleAuthProvider();
const facebookProvider = new FacebookAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export { 
    auth, db, ref, push, set, onValue, update, remove, get, child,
    query, orderByChild, equalTo, serverTimestamp,
    googleProvider, facebookProvider,
    signInWithPopup, signOut, onAuthStateChanged,
    createUserWithEmailAndPassword, signInWithEmailAndPassword, 
    updateProfile, sendPasswordResetEmail
};
