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

        // كانت المحافظة المحفوظة بتتخزن في الحقل المخفي بس مش بتتعرض في الزرار
        // (كان لسه شكله "اختر المحافظة..." حتى لو فعلاً محفوظة محافظة قبل كده)
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

    if (!name || name.length < 3) return showToast("👤 برجاء إدخال اسمك الكامل (3 أحرف على الأقل)", "error");
    if (!/^01[0125]\d{8}$/.test(phone)) return showToast("📱 رقم هاتف مصري غير صحيح (مثال: 01012345678)", "error");
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
    const isHidden = dd.classList.contains("hidden");
    
    if (isHidden) {
        dd.classList.remove("hidden");
        chev.style.transform = "rotate(180deg)";
        renderGovernorates();
        setTimeout(() => document.getElementById("govSearch").focus(), 100);
    } else {
        dd.classList.add("hidden");
        chev.style.transform = "rotate(0deg)";
    }
}

function selectGovernorate(gov) {
    const selected = document.getElementById("selectedGovernorate");
    selected.innerText = gov;
    selected.classList.remove("text-slate-400");
    selected.classList.add("text-slate-900", "font-bold");
    document.getElementById("pfGovernorate").value = gov;
    document.getElementById("governorateDropdown").classList.add("hidden");
    document.getElementById("govChevron").style.transform = "rotate(0deg)";
}

function filterGovernorates() {
    const query = document.getElementById("govSearch").value;
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
    if (confirm("هل تريد تسجيل الخروج؟")) logoutUser();
}

window.saveProfile = saveProfile;
window.handleLogout = handleLogout;
window.goToFavorites = () => { window.location.href = "index.html#favorites"; };
