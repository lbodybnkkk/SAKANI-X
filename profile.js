// profile.js
import { auth, db, ref, get, update } from "./firebase-config.js";
import { onAuthStateChanged, logoutUser, showToast } from "./auth.js";

let currentUser = null;

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }
    currentUser = user;
    await loadProfile();
});

async function loadProfile() {
    document.getElementById("profileName").innerText = currentUser.displayName || "مستخدم";
    document.getElementById("profileEmail").innerText = currentUser.email;

    const avatar = document.getElementById("profileAvatar");
    if (currentUser.photoURL) {
        avatar.innerHTML = `<img src="${currentUser.photoURL}" alt="avatar">`;
    }

    const snap = await get(ref(db, `users/${currentUser.uid}`));
    if (snap.exists()) {
        const p = snap.val();
        document.getElementById("pfName").value = p.name || currentUser.displayName || "";
        document.getElementById("pfPhone").value = p.phone || "";
        document.getElementById("pfGovernorate").value = p.governorate || "";
        document.getElementById("pfCity").value = p.city || "";
        document.getElementById("pfUniversity").value = p.university || "";

        if (p.name && p.phone && p.governorate) {
            const badge = document.getElementById("profileBadge");
            badge.style.background = "rgba(16, 185, 129, 0.15)";
            badge.style.color = "var(--success)";
            badge.innerHTML = `<i class="fa-solid fa-circle-check"></i> حسابك مكتمل`;
        }
    }
}

async function saveProfile() {
    const name = document.getElementById("pfName").value.trim();
    const phone = document.getElementById("pfPhone").value.trim();
    const governorate = document.getElementById("pfGovernorate").value;
    const city = document.getElementById("pfCity").value.trim();
    const university = document.getElementById("pfUniversity").value.trim();

    // Validation
    if (!name || name.length < 3) return showToast("👤 برجاء إدخال اسمك الكامل (3 أحرف على الأقل)", "error");
    if (!/^01[0-2,5]\d{8}$/.test(phone)) return showToast("📱 رقم هاتف مصري غير صحيح (مثال: 01012345678)", "error");
    if (!governorate) return showToast("📍 برجاء اختيار المحافظة", "error");

    const btn = document.getElementById("saveProfileBtn");
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> جاري الحفظ...`;

    try {
        await update(ref(db, `users/${currentUser.uid}`), {
            name, phone, governorate, city, university,
            profileComplete: true,
            updatedAt: Date.now()
        });
        showToast("✅ تم حفظ بياناتك بنجاح", "success");
        document.getElementById("profileName").innerText = name;
        const badge = document.getElementById("profileBadge");
        badge.style.background = "rgba(16, 185, 129, 0.15)";
        badge.style.color = "var(--success)";
        badge.innerHTML = `<i class="fa-solid fa-circle-check"></i> حسابك مكتمل`;
        
        setTimeout(() => window.location.href = "index.html", 1200);
    } catch (err) {
        console.error(err);
        showToast("فشل الحفظ: " + err.message, "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> حفظ البيانات`;
    }
}

function handleLogout() {
    if (confirm("هل تريد تسجيل الخروج؟")) logoutUser();
}

window.saveProfile = saveProfile;
window.handleLogout = handleLogout;
window.goToFavorites = () => { window.location.href = "index.html#favorites"; };
