// auth.js
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

// ========== ترجمة أخطاء Firebase للعربي ==========
function translateAuthError(error) {
    const code = error.code || "";
    const map = {
        "auth/invalid-credential": "❌ البريد الإلكتروني أو كلمة المرور غير صحيحة. لو حسابك جديد، اضغط على 'حساب جديد' الأول.",
        "auth/user-not-found": "❌ لا يوجد حساب بهذا البريد. اضغط على 'حساب جديد' لإنشائه.",
        "auth/wrong-password": "❌ كلمة المرور غير صحيحة. جرّب مرة أخرى أو اضغط 'نسيت كلمة المرور'.",
        "auth/invalid-email": "❌ صيغة البريد الإلكتروني غير صحيحة.",
        "auth/email-already-in-use": "⚠️ هذا البريد مستخدم بالفعل. جرّب تسجيل الدخول بدلاً من إنشاء حساب.",
        "auth/weak-password": "🔒 كلمة المرور ضعيفة جداً (6 أحرف على الأقل).",
        "auth/too-many-requests": "⏳ محاولات كثيرة فاشلة. انتظر دقيقة وحاول مجدداً.",
        "auth/popup-closed-by-user": "🚪 تم إغلاق نافذة تسجيل الدخول.",
        "auth/popup-blocked": "🚫 المتصفح منع النافذة المنبثقة. اسمح بها وأعد المحاولة.",
        "auth/account-exists-with-different-credential": "⚠️ البريد مسجل بطريقة تسجيل أخرى. جرّب Google أو Facebook.",
        "auth/network-request-failed": "📡 فشل الاتصال بالإنترنت. تحقق من الشبكة.",
        "auth/cancelled-popup-request": "❌ تم إلغاء العملية.",
        "auth/operation-not-allowed": "⚙️ هذه الطريقة غير مفعّلة. راجع إعدادات Firebase.",
        "auth/unauthorized-domain": "🌐 النطاق الحالي غير مصرح به في Firebase."
    };
    return map[code] || `⚠️ حدث خطأ: ${error.message}`;
}

// ========== مراقبة حالة المستخدم ==========
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
    const authBtn = document.getElementById("authTriggerBtn");
    if (!authBtn) return;
    
    if (isLoggedIn && user) {
        authBtn.innerHTML = user.photoURL 
            ? `<img src="${user.photoURL}" alt="${user.displayName || 'User'}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`
            : `<i class="fa-solid fa-user" style="color: var(--primary);"></i>`;
        authBtn.onclick = () => window.location.href = "profile.html";
    } else {
        authBtn.innerHTML = `<i class="fa-solid fa-user" style="color: var(--primary);"></i>`;
        authBtn.onclick = () => window.toggleAuthModal(true);
    }
}

// ========== تسجيل الدخول بـ Google ==========
async function loginWithGoogle() {
    try {
        showToast("جاري الاتصال بـ Google...", "info");
        await signInWithPopup(auth, googleProvider);
        if (window.closeAuthModal) window.closeAuthModal();
        showToast("تم تسجيل الدخول بنجاح ✅", "success");
    } catch (error) {
        console.error("Google login error:", error);
        showToast(translateAuthError(error), "error");
    }
}

// ========== تسجيل الدخول بـ Facebook ==========
async function loginWithFacebook() {
    try {
        showToast("جاري الاتصال بـ Facebook...", "info");
        await signInWithPopup(auth, facebookProvider);
        if (window.closeAuthModal) window.closeAuthModal();
        showToast("تم تسجيل الدخول بنجاح ✅", "success");
    } catch (error) {
        console.error("Facebook login error:", error);
        showToast(translateAuthError(error), "error");
    }
}

// ========== تسجيل/دخول بالبريد ==========
async function handleEmailAuth(isSignUp) {
    const email = document.getElementById("authEmail")?.value.trim();
    const password = document.getElementById("authPassword")?.value;
    const name = document.getElementById("authName")?.value.trim() || "";
    const submitBtn = document.getElementById("authSubmitBtn");
    
    if (!email) return showToast("📧 برجاء إدخال البريد الإلكتروني", "error");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showToast("📧 صيغة البريد الإلكتروني غير صحيحة", "error");
    if (!password) return showToast("🔒 برجاء إدخال كلمة المرور", "error");
    if (password.length < 6) return showToast("🔒 كلمة المرور يجب أن تكون 6 أحرف على الأقل", "error");
    if (isSignUp && !name) return showToast("👤 برجاء إدخال الاسم الكامل", "error");
    
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = isSignUp ? "جاري إنشاء الحساب..." : "جاري الدخول...";
    }
    
    try {
        if (isSignUp) {
            const result = await createUserWithEmailAndPassword(auth, email, password);
            if (name) await updateProfile(result.user, { displayName: name });
            showToast("🎉 تم إنشاء حسابك بنجاح!", "success");
        } else {
            await signInWithEmailAndPassword(auth, email, password);
            showToast("✅ تم تسجيل الدخول بنجاح", "success");
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

// ========== نسيت كلمة المرور ==========
async function resetPassword() {
    const email = document.getElementById("authEmail")?.value.trim();
    if (!email) return showToast("📧 أدخل بريدك الإلكتروني أولاً", "error");
    try {
        await sendPasswordResetEmail(auth, email);
        showToast("📧 تم إرسال رابط إعادة التعيين لبريدك", "success");
    } catch (error) {
        showToast(translateAuthError(error), "error");
    }
}

// ========== تسجيل الخروج ==========
async function logoutUser() {
    try {
        await signOut(auth);
        showToast("تم تسجيل الخروج 👋", "info");
        setTimeout(() => window.location.href = "index.html", 800);
    } catch (error) {
        showToast("فشل تسجيل الخروج", "error");
    }
}

// ========== التحقق من البروفايل ==========
async function isProfileComplete() {
    if (!currentUser) return false;
    const snap = await get(ref(db, `users/${currentUser.uid}`));
    if (!snap.exists()) return false;
    const profile = snap.val();
    return !!(profile.name && profile.phone && profile.governorate);
}

// ========== Toast ==========
function showToast(message, type = "info") {
    const existing = document.querySelector(".toast");
    if (existing) existing.remove();
    
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add("show"), 50);
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

export { 
    currentUser, userProfile, loginWithGoogle, loginWithFacebook, 
    handleEmailAuth, logoutUser, isProfileComplete, showToast,
    translateAuthError, onAuthStateChanged, auth, resetPassword
};
