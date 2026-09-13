// auth.js
import { 
    auth, googleProvider, facebookProvider,
    signInWithPopup, signOut, onAuthStateChanged,
    createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile
} from "./firebase-config.js";
import { db, ref, set, get, child } from "./firebase-config.js";

let currentUser = null;
let authCallbacks = [];

// مراقبة حالة المستخدم
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        // حفظ بيانات المستخدم في قاعدة البيانات
        const userRef = ref(db, `users/${user.uid}`);
        const snapshot = await get(userRef);
        if (!snapshot.exists()) {
            await set(userRef, {
                name: user.displayName || "مستخدم",
                email: user.email,
                photo: user.photoURL || "",
                createdAt: Date.now()
            });
        }
        // تحديث الواجهة
        updateAuthUI(true, user);
    } else {
        currentUser = null;
        updateAuthUI(false, null);
    }
    // تنفيذ الـ callbacks
    authCallbacks.forEach(cb => cb(user));
});

// تحديث الواجهة بناءً على حالة الدخول
function updateAuthUI(isLoggedIn, user) {
    const authBtn = document.getElementById("authTriggerBtn");
    if (!authBtn) return;
    
    if (isLoggedIn && user) {
        authBtn.innerHTML = user.photoURL 
            ? `<img src="${user.photoURL}" alt="${user.displayName}">`
            : `<i class="fa-solid fa-user" style="color: var(--primary);"></i>`;
        authBtn.onclick = () => showUserMenu();
    } else {
        authBtn.innerHTML = `<i class="fa-solid fa-user" style="color: var(--primary);"></i>`;
        authBtn.onclick = () => toggleAuthModal(true);
    }
}

// تسجيل الدخول بـ Google
async function loginWithGoogle() {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        closeAuthModal();
        showToast("تم تسجيل الدخول بنجاح ✅", "success");
        return result.user;
    } catch (error) {
        console.error("Google login error:", error);
        showToast("فشل تسجيل الدخول بـ Google: " + error.message, "error");
    }
}

// تسجيل الدخول بـ Facebook
async function loginWithFacebook() {
    try {
        const result = await signInWithPopup(auth, facebookProvider);
        closeAuthModal();
        showToast("تم تسجيل الدخول بنجاح ✅", "success");
        return result.user;
    } catch (error) {
        console.error("Facebook login error:", error);
        showToast("فشل تسجيل الدخول بـ Facebook: " + error.message, "error");
    }
}

// تسجيل الدخول / إنشاء حساب بالبريد
async function handleEmailAuth(isSignUp) {
    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value;
    const name = document.getElementById("authName")?.value.trim() || "";
    
    if (!email || !password) {
        showToast("برجاء إدخال البريد وكلمة المرور", "error");
        return;
    }
    
    try {
        if (isSignUp) {
            const result = await createUserWithEmailAndPassword(auth, email, password);
            if (name) await updateProfile(result.user, { displayName: name });
            showToast("تم إنشاء الحساب بنجاح ✅", "success");
        } else {
            await signInWithEmailAndPassword(auth, email, password);
            showToast("تم تسجيل الدخول بنجاح ✅", "success");
        }
        closeAuthModal();
    } catch (error) {
        console.error("Email auth error:", error);
        const msg = error.code === "auth/email-already-in-use" ? "البريد مستخدم بالفعل" :
                    error.code === "auth/wrong-password" ? "كلمة المرور غير صحيحة" :
                    error.code === "auth/user-not-found" ? "المستخدم غير موجود" :
                    "حدث خطأ: " + error.message;
        showToast(msg, "error");
    }
}

// تسجيل الخروج
async function logoutUser() {
    try {
        await signOut(auth);
        showToast("تم تسجيل الخروج", "info");
        window.location.href = "index.html";
    } catch (error) {
        showToast("فشل تسجيل الخروج", "error");
    }
}

// التحقق من تسجيل الدخول (للمسارات المحمية)
function requireAuth(callback) {
    if (auth.currentUser) {
        callback(auth.currentUser);
    } else {
        authCallbacks.push((user) => {
            if (user) callback(user);
        });
    }
}

// Toast notification
function showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add("show"), 100);
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

export { 
    currentUser, loginWithGoogle, loginWithFacebook, 
    handleEmailAuth, logoutUser, requireAuth, showToast 
};
