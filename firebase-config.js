// firebase-config.js
// تهيئة Firebase (Authentication + Realtime Database) لمنصة SAKANI-X

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getDatabase,
  ref,
  set,
  get,
  push,
  update,
  remove,
  onValue,
  child,
  query,
  orderByChild,
  equalTo
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDW1u0V41aKuphDC4FUdDsSZX7wUlb6twk", // ضع مفتاح الـ API الخاص بمشروعك هنا من إعدادات Firebase
  authDomain: "cmd1-1c696.firebaseapp.com",
  databaseURL: "https://cmd1-1c696-default-rtdb.firebaseio.com/",
  projectId: "cmd1-1c696",
  storageBucket: "cmd1-1c696.appspot.com",
  messagingSenderId: "0000000000",
  appId: "1:0000000000:web:0000000000000000000000"
};

// تهيئة التطبيق
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);

export {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
  ref,
  set,
  get,
  push,
  update,
  remove,
  onValue,
  child,
  query,
  orderByChild,
  equalTo
};
