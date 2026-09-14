import { 
    auth, googleProvider, facebookProvider,
    signInWithPopup, signOut, onAuthStateChanged,
    createUserWithEmailAndPassword, signInWithEmailAndPassword, 
    updateProfile, sendPasswordResetEmail
} from "./firebase-config.js";
import { db, ref, set, get } from "./firebase-config.js";

let currentUser = null;
let userProfile = null;
let authCallbacks = [];

function translateAuthError(error) {
    const code = error.code || "";
    const map = {
        "auth/invalid-credential": "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
        "auth/user-not-found": "لا يوجد حساب بهذا البريد. أنشئ حسابًا جديدًا.",
        "auth/wrong-password": "كلمة المرور غير صحيحة.",
        "auth/invalid-email": "صيغة البريد الإلكتروني غير صحيحة.",
        "auth/email-already-in-use": "هذا البريد مستخدم بالفعل.",
        "auth/weak-password": "كلمة المرور يجب أن تكون 6 أحرف على الأقل.",
        "auth/too-many-requests": "محاولات كثيرة فاشلة. انتظر دقيقة.",
        "auth/popup-closed-by-user": "تم إغلاق نافذة تسجيل الدخول.",
        "auth/popup-blocked": "المتصفح منع النافذة المنبثقة. اسمح بها.",
        "auth/account-exists-with-different-credential": "البريد مسجل بطريقة أخرى.",
        "auth/network-request-failed": "فشل الاتصال بالإنترنت.",
        "auth/cancelled-popup-request": "تم إلغاء العملية.",
        "auth/operation-not-allowed": "هذه الطريقة غير مفعّلة.",
        "auth/unauthorized-domain": "النطاق الحالي غير مصرح به."
    };
    return map[code] || `حدث خطأ: ${error.message}`;
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const userRef = ref(db, `users/${user.uid}`);
        const snapshot = await get(userRef);
        
        if (!snapshot.exists()) {
            await set(userRef, {
                name: user.displayName || "",
                email: user.email,
                photo: user.photoURL || "",
                phone: "",
                governorate: "",
                city: "",
                university: "",
                profileComplete: false,
                createdAt: Date.now()
            });
            userProfile = { profileComplete: false };
        } else {
            userProfile = snapshot.val();
        }
        
        updateAuthUI(true, user);
    } else {
        currentUser = null;
        userProfile = null;
        updateAuthUI(false, null);
    }
    
    authCallbacks.forEach(cb => cb(user, userProfile));
});

function updateAuthUI(isLoggedIn, user) {
    const updateButton = () => {
        const authBtn = document.getElementById("authTriggerBtn");
        if (!authBtn) return;

        if (isLoggedIn && user) {
            authBtn.innerHTML = user.photoURL 
                ? `<img src="${user.photoURL}" alt="${user.displayName || 'User'}" class="w-full h-full object-cover rounded-full">`
                : `<i class="fa-solid fa-user text-slate-900"></i>`;
            authBtn.onclick = () => window.location.href = "profile.html";
        } else {
            authBtn.innerHTML = `<i class="fa-solid fa-user text-slate-900"></i>`;
            authBtn.onclick = () => window.toggleAuthModal(true);
        }
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", updateButton);
    } else {
        updateButton();
    }
}

async function loginWithGoogle() {
    try {
        showToast("جاري الاتصال بـ Google...", "info");
        await signInWithPopup(auth, googleProvider);
        if (window.closeAuthModal) window.closeAuthModal();
        showToast("تم تسجيل الدخول بنجاح", "success");
    } catch (error) {
        console.error("Google login error:", error);
        showToast(translateAuthError(error), "error");
    }
}

async function loginWithFacebook() {
    try {
        showToast("جاري الاتصال بـ Facebook...", "info");
        await signInWithPopup(auth, facebookProvider);
        if (window.closeAuthModal) window.closeAuthModal();
        showToast("تم تسجيل الدخول بنجاح", "success");
    } catch (error) {
        console.error("Facebook login error:", error);
        showToast(translateAuthError(error), "error");
    }
}

async function handleEmailAuth(isSignUp) {
    const email = document.getElementById("authEmail")?.value.trim();
    const password = document.getElementById("authPassword")?.value;
    const name = document.getElementById("authName")?.value.trim() || "";
    const submitBtn = document.getElementById("authSubmitBtn");
    
    if (!email) return showToast("برجاء إدخال البريد الإلكتروني", "error");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showToast("صيغة البريد غير صحيحة", "error");
    if (!password) return showToast("برجاء إدخال كلمة المرور", "error");
    if (password.length < 6) return showToast("كلمة المرور يجب أن تكون 6 أحرف على الأقل", "error");
    if (isSignUp && !name) return showToast("برجاء إدخال الاسم الكامل", "error");
    
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = isSignUp ? "جاري إنشاء الحساب..." : "جاري الدخول...";
    }
    
    try {
        if (isSignUp) {
            const result = await createUserWithEmailAndPassword(auth, email, password);
            if (name) await updateProfile(result.user, { displayName: name });
            showToast("تم إنشاء حسابك بنجاح", "success");
        } else {
            await signInWithEmailAndPassword(auth, email, password);
            showToast("تم تسجيل الدخول بنجاح", "success");
        }
        if (window.closeAuthModal) window.closeAuthModal();
    } catch (error) {
        console.error("Email auth error:", error);
        showToast(translateAuthError(error), "error");
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = isSignUp ? "إنشاء حساب" : "دخول";
        }
    }
}

async function resetPassword() {
    const email = document.getElementById("authEmail")?.value.trim();
    if (!email) return showToast("أدخل بريدك الإلكتروني أولاً", "error");
    try {
        await sendPasswordResetEmail(auth, email);
        showToast("تم إرسال رابط إعادة التعيين لبريدك", "success");
    } catch (error) {
        showToast(translateAuthError(error), "error");
    }
}

async function logoutUser() {
    try {
        await signOut(auth);
        showToast("تم تسجيل الخروج", "info");
        setTimeout(() => window.location.href = "index.html", 800);
    } catch (error) {
        showToast("فشل تسجيل الخروج", "error");
    }
}

async function isProfileComplete() {
    if (!currentUser) return false;
    const snap = await get(ref(db, `users/${currentUser.uid}`));
    if (!snap.exists()) return false;
    const profile = snap.val();
    return !!(profile.name && profile.phone && profile.governorate);
}

function showToast(message, type = "info") {
    const existing = document.querySelector(".toast");
    if (existing) existing.remove();
    
    const toast = document.createElement("div");
    toast.className = `toast toast-${type} fixed top-5 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 rounded-xl text-sm font-bold shadow-2xl transition-all duration-300 opacity-0 translate-y-[-20px]`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.remove("opacity-0", "translate-y-[-20px]"), 50);
    setTimeout(() => {
        toast.classList.add("opacity-0", "translate-y-[-20px]");
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

export { 
    currentUser, userProfile, loginWithGoogle, loginWithFacebook, 
    handleEmailAuth, logoutUser, isProfileComplete, showToast,
    translateAuthError, onAuthStateChanged, auth, resetPassword
};
