// profile.js
import { auth, db, ref, get, update } from "./firebase-config.js";
import { onAuthStateChanged, logoutUser, showToast } from "./auth.js";
import { updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let currentUser = null;

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html#login";
        return;
    }
    currentUser = user;
    document.body.classList.add("profile-ready");
    await loadProfile();
});

async function loadProfile() {
    if (!currentUser) return;

    // 1. عرض إيميل الحساب المسجل حالياً بشكل ديناميكي
    const emailElem = document.getElementById("profileEmail");
    if (emailElem) {
        emailElem.innerText = currentUser.email || "";
    }

    // 2. تعيين اسم مبدئي
    const nameElem = document.getElementById("profileName");
    if (nameElem) {
        nameElem.innerText = currentUser.displayName || "مستخدم";
    }

    const avatar = document.getElementById("profileAvatar");
    if (avatar && currentUser.photoURL) {
        avatar.innerHTML = `<img src="${currentUser.photoURL}" alt="avatar">`;
    }

    try {
        // 3. جلب بيانات المستخدم المسجل حالياً من قاعدة البيانات بواسطة uid الخاص به
        const snap = await get(ref(db, `users/${currentUser.uid}`));
        if (snap.exists()) {
            const p = snap.val();

            // تحديث الاسم العلوي بالاسم المخزن في قاعدة البيانات
            if (p.name && nameElem) {
                nameElem.innerText = p.name;
            }

            // تعبئة حقول الإدخال
            if (document.getElementById("pfName")) document.getElementById("pfName").value = p.name || currentUser.displayName || "";
            if (document.getElementById("pfPhone")) document.getElementById("pfPhone").value = p.phone || "";
            if (document.getElementById("pfGovernorate")) document.getElementById("pfGovernorate").value = p.governorate || "";
            if (document.getElementById("pfCity")) document.getElementById("pfCity").value = p.city || "";
            if (document.getElementById("pfUniversity")) document.getElementById("pfUniversity").value = p.university || "";

            if (p.governorate) {
                const selectedLabel = document.getElementById("selectedGovernorate");
                if (selectedLabel) {
                    selectedLabel.innerText = p.governorate;
                    selectedLabel.classList.remove("text-slate-400");
                    selectedLabel.classList.add("text-slate-900", "font-bold");
                }
            }

            if (p.name && p.phone && p.governorate) {
                const badge = document.getElementById("profileBadge");
                if (badge) {
                    badge.style.background = "rgba(16, 185, 129, 0.15)";
                    badge.style.color = "var(--success)";
                    badge.innerHTML = `<i class="fa-solid fa-circle-check"></i> حسابك مكتمل`;
                }
            }
        }
    } catch (err) {
        console.error("خطأ أثناء تحميل الملف الشخصي:", err);
    }
}

async function saveProfile() {
    const nameInput = document.getElementById("pfName");
    const phoneInput = document.getElementById("pfPhone");
    const govInput = document.getElementById("pfGovernorate");
    const cityInput = document.getElementById("pfCity");
    const uniInput = document.getElementById("pfUniversity");

    const name = nameInput ? nameInput.value.trim() : "";
    const phone = phoneInput ? phoneInput.value.trim() : "";
    const governorate = govInput ? govInput.value : "";
    const city = cityInput ? cityInput.value.trim() : "";
    const university = uniInput ? uniInput.value.trim() : "";

    if (!name || name.length < 3) return showToast("👤 برجاء إدخال اسمك الكامل (3 أحرف على الأقل)", "error");
    if (!/^01[0125]\d{8}$/.test(phone)) return showToast("📱 رقم هاتف مصري غير صحيح (مثال: 01012345678)", "error");
    if (!governorate) return showToast("📍 برجاء اختيار المحافظة", "error");

    const btn = document.getElementById("saveProfileBtn");
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> جاري الحفظ...`;
    }

    try {
        // تحديث الاسم داخل نظام المصادقة (Firebase Auth)
        if (auth.currentUser) {
            await updateProfile(auth.currentUser, { displayName: name });
        }

        // تحديث البيانات في قاعدة البيانات تحت uid الحساب الحالي
        await update(ref(db, `users/${currentUser.uid}`), {
            name,
            phone,
            governorate,
            city,
            university,
            profileComplete: true,
            updatedAt: Date.now()
        });

        showToast("✅ تم حفظ بياناتك بنجاح", "success");

        const nameElem = document.getElementById("profileName");
        if (nameElem) nameElem.innerText = name;

        const badge = document.getElementById("profileBadge");
        if (badge) {
            badge.style.background = "rgba(16, 185, 129, 0.15)";
            badge.style.color = "var(--success)";
            badge.innerHTML = `<i class="fa-solid fa-circle-check"></i> حسابك مكتمل`;
        }

        setTimeout(() => window.location.href = "index.html", 1200);
    } catch (err) {
        console.error(err);
        showToast("فشل الحفظ: " + err.message, "error");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> حفظ البيانات`;
        }
    }
}

const governorates = [
    "القاهرة", "الجيزة", "الإسكندرية", "الدقهلية", "الشرقية", "القليوبية",
    "المنوفية", "الغربية", "كفر الشيخ", "دمياط", "بورسعيد", "الإسماعيلية",
    "السويس", "شمال سيناء", "جنوب سيناء", "الفيوم", "بني سويف", "المنيا",
    "أسيوط", "سوهاج", "قنا", "الأقصر", "أسوان", "البحر الأحمر",
    "الوادي الجديد", "مطروح"
];

function renderGovernorates(filter = "") {
    const list = document.getElementById("governorateList");
    if (!list) return;
    const filtered = governorates.filter(g => g.includes(filter));
    
    if (filtered.length === 0) {
        list.innerHTML = `<div class="text-center py-4 text-slate-400 text-sm">لا نتائج</div>`;
        return;
    }

    list.innerHTML = filtered.map(g => `
        <button type="button" onclick="selectGovernorate('${g}')" 
                class="w-full text-right px-4 py-2.5 text-sm hover:bg-amber-50 transition-all flex items-center justify-between group">
            <span>${g}</span>
            <i class="fa-solid fa-check text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity text-xs"></i>
        </button>
    `).join('');
}

function toggleGovernorateDropdown(e) {
    if (e) e.stopPropagation();
    const dd = document.getElementById("governorateDropdown");
    const chev = document.getElementById("govChevron");
    if (!dd) return;
    const isHidden = dd.classList.contains("hidden");
    
    if (isHidden) {
        dd.classList.remove("hidden");
        if (chev) chev.style.transform = "rotate(180deg)";
        renderGovernorates();
        setTimeout(() => {
            const searchInput = document.getElementById("govSearch");
            if (searchInput) searchInput.focus();
        }, 100);
    } else {
        dd.classList.add("hidden");
        if (chev) chev.style.transform = "rotate(0deg)";
    }
}

function selectGovernorate(gov) {
    const selected = document.getElementById("selectedGovernorate");
    if (selected) {
        selected.innerText = gov;
        selected.classList.remove("text-slate-400");
        selected.classList.add("text-slate-900", "font-bold");
    }
    const govInput = document.getElementById("pfGovernorate");
    if (govInput) govInput.value = gov;

    const dd = document.getElementById("governorateDropdown");
    if (dd) dd.classList.add("hidden");

    const chev = document.getElementById("govChevron");
    if (chev) chev.style.transform = "rotate(0deg)";
}

function filterGovernorates() {
    const searchInput = document.getElementById("govSearch");
    const query = searchInput ? searchInput.value : "";
    renderGovernorates(query);
}

document.addEventListener("click", (e) => {
    const dropdown = document.getElementById("governorateDropdown");
    const btn = document.getElementById("governorateBtn");
    if (dropdown && btn && !dropdown.contains(e.target) && !btn.contains(e.target)) {
        dropdown.classList.add("hidden");
        const chev = document.getElementById("govChevron");
        if (chev) chev.style.transform = "rotate(0deg)";
    }
});

window.toggleGovernorateDropdown = toggleGovernorateDropdown;
window.selectGovernorate = selectGovernorate;
window.filterGovernorates = filterGovernorates;

function handleLogout() {
    const overlay = document.createElement("div");
    overlay.className = "logout-confirm-overlay";
    overlay.innerHTML = `
        <div class="logout-confirm-card">
            <div class="logout-confirm-logo">
                <i class="fa-solid fa-building-shield"></i>
            </div>
            <h3>SAKANI <span>X</span></h3>
            <p>هل تريد تسجيل الخروج من حسابك؟</p>
            <div class="logout-confirm-actions">
                <button id="logoutConfirmYes" class="logout-confirm-yes">تسجيل الخروج</button>
                <button id="logoutConfirmNo" class="logout-confirm-no">إلغاء</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    document.getElementById("logoutConfirmNo").onclick = () => overlay.remove();
    document.getElementById("logoutConfirmYes").onclick = () => {
        overlay.remove();
        showLogoutLoading();
    };
}

function showLogoutLoading() {
    const overlay = document.createElement("div");
    overlay.className = "logout-loading-overlay";
    overlay.innerHTML = `
        <div class="logout-loading-logo">
            <i class="fa-solid fa-building-shield"></i>
        </div>
        <h2>SAKANI <span>X</span></h2>
        <p>جاري تسجيل الخروج...</p>
        <div class="logout-progress-track">
            <div id="logoutProgressBar" class="logout-progress-fill"></div>
        </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const bar = document.getElementById("logoutProgressBar");
            if (bar) bar.style.width = "100%";
        });
    });
    setTimeout(() => logoutUser(), 2000);
}

window.saveProfile = saveProfile;
window.handleLogout = handleLogout;
window.goToFavorites = () => { window.location.href = "index.html#favorites"; };
