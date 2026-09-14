/* ==========================================
   SAKANI-X CORE JS ENGINE — Firebase Connected
   ========================================== */

import { 
    auth, db, ref, onValue, get, update, remove, push, set 
} from "./firebase-config.js";
import { 
    loginWithGoogle, loginWithFacebook, handleEmailAuth, 
    logoutUser, showToast, resetPassword
} from "./auth.js";
import { 
    listenToHousings, listenToSections,
    toggleFavorite, listenToFavorites 
} from "./data-service.js";

let allHousings = [];
let allSections = [];
let currentUser = null;
let userFavorites = [];
let selectedBedId = null;
let isSignUpMode = false;

// ========== مراقبة حالة المستخدم ==========
auth.onAuthStateChanged((user) => {
    currentUser = user;
    if (user) {
        listenToFavorites(user.uid, (favs) => {
            userFavorites = favs;
            renderListings(allHousings);
        });
        // عرض نافذة آخر حجز
        checkLatestBooking(user.uid);
    } else {
        userFavorites = [];
    }
});

// ========== تحميل السكنات من Firebase ==========
document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("listingsContainer");
    if (container) {
        listenToHousings((housings) => {
            allHousings = housings.map(h => ({
                id: h.id,
                title: h.title,
                location: h.address || h.city,
                city: h.city,
                price: h.price,
                gender: h.gender?.includes("طالبات") ? "girls" : h.gender?.includes("طلاب") ? "boys" : "all",
                isLuxury: h.price > 2000,
                image: h.images?.[0] || "https://via.placeholder.com/600x400?text=SAKANI-X",
                images: h.images || [],
                amenities: h.amenities || [],
                description: h.description || "",
                phone: h.phone,
                deposit: h.deposit,
                type: h.type,
                beds: h.beds || [],
                section: h.section || "",
                createdAt: h.createdAt || 0
            }));
            renderListings(allHousings);
            renderSections();
        });
    }
});

// ========== تحميل الأقسام ==========
listenToSections((sections) => {
    allSections = sections;
    renderSections();
});

// ========== عرض الأقسام ==========
function renderSections() {
    const container = document.getElementById("sectionsContainer");
    if (!container) return;
    
    if (allSections.length === 0) {
        container.innerHTML = "";
        return;
    }
    
    container.innerHTML = allSections.map(section => {
        const sectionHousings = allHousings.filter(h => h.section === section.id);
        if (sectionHousings.length === 0) return "";
        
        return `
        <div class="section-block" data-section-id="${section.id}">
            <div class="section-header">
                <h3 class="section-title">
                    <i class="fa-solid fa-building"></i>
                    ${section.name}
                </h3>
                <button class="section-more" onclick="showSectionHousings('${section.id}')">
                    عرض المزيد <i class="fa-solid fa-chevron-left"></i>
                </button>
            </div>
            <div class="section-scroll" id="section-${section.id}">
                ${sectionHousings.slice(0, 6).map(item => renderCard(item)).join('')}
            </div>
        </div>`;
    }).join('');
}

// ========== عرض المزيد من قسم ==========
function showSectionHousings(sectionId) {
    const section = allSections.find(s => s.id === sectionId);
    if (!section) return;
    const sectionHousings = allHousings.filter(h => h.section === sectionId);
    
    const modal = document.createElement("div");
    modal.className = "modal-overlay active";
    modal.id = "sectionModal";
    modal.innerHTML = `
        <div class="auth-modal-content" style="max-width: 90%; max-height: 85vh; overflow-y: auto;">
            <div class="modal-drag-indicator"></div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h3 style="font-size:18px; font-weight:800; color:var(--primary);">
                    <i class="fa-solid fa-building" style="color:var(--accent-gold);"></i>
                    ${section.name}
                </h3>
                <button onclick="document.getElementById('sectionModal').remove()" 
                        style="background:transparent; border:none; font-size:22px; cursor:pointer; color:var(--text-muted);">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div style="display:flex; flex-direction:column; gap:16px;">
                ${sectionHousings.map(item => renderCard(item)).join('')}
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// ========== عرض بطاقة سكن ==========
function renderCard(item) {
    const isFav = userFavorites.includes(item.id);
    const genderClass = item.gender === 'girls' ? 'gender-girls' : item.gender === 'boys' ? 'gender-boys' : '';
    const genderLabel = item.gender === 'girls' ? 'سكن طالبات' : item.gender === 'boys' ? 'سكن طلاب' : 'عائلات / موظفين';
    const genderIcon = item.gender === 'girls' ? 'fa-person-dress' : 'fa-person';
    
    return `
    <a href="details.html?id=${item.id}" class="housing-card" data-id="${item.id}">
        <div class="card-media">
            <img src="${item.image}" alt="${item.title}" onerror="this.src='https://via.placeholder.com/600x400?text=SAKANI-X'">
            <div class="card-badges">
                <span class="badge-tag ${genderClass}">
                    <i class="fa-solid ${genderIcon}"></i>
                    ${genderLabel}
                </span>
                <button class="fav-btn ${isFav ? 'active' : ''}" 
                        onclick="event.preventDefault(); event.stopPropagation(); handleFavToggle('${item.id}', this);">
                    <i class="fa-${isFav ? 'solid' : 'regular'} fa-heart"></i>
                </button>
            </div>
        </div>
        <div class="card-body">
            <div class="card-price">${item.price?.toLocaleString()} ج.م <span>/ شهرياً</span></div>
            <h3 class="card-title">${item.title}</h3>
            <div class="card-location">
                <i class="fa-solid fa-location-dot" style="color: var(--accent-gold);"></i>
                <span>${item.location}</span>
            </div>
            <div class="card-features">
                ${(item.amenities || []).slice(0, 3).map(a => 
                    `<span><i class="fa-solid fa-check-circle"></i> ${a}</span>`
                ).join('')}
            </div>
        </div>
    </a>`;
}

// ========== عرض السكنات (الرئيسية) ==========
function renderListings(items) {
    const container = document.getElementById("listingsContainer");
    if (!container) return;

    if (items.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding: 60px 20px; color: var(--text-muted);">
                <i class="fa-solid fa-building" style="font-size: 48px; margin-bottom: 16px; opacity: 0.3;"></i>
                <h3>لا توجد وحدات سكنية متاحة حالياً</h3>
                <p>سيتم إضافة وحدات جديدة قريباً</p>
            </div>`;
        return;
    }

    container.innerHTML = items.map(item => renderCard(item)).join('');
}

// ========== المفضلة ==========
async function handleFavToggle(housingId, btnEl) {
    if (!currentUser) {
        toggleAuthModal(true);
        showToast("سجّل دخولك أولاً لإضافة المفضلة", "info");
        return;
    }
    const isNowFav = await toggleFavorite(currentUser.uid, housingId);
    btnEl.classList.toggle('active', isNowFav);
    btnEl.querySelector('i').className = `fa-${isNowFav ? 'solid' : 'regular'} fa-heart`;
    showToast(isNowFav ? "تمت الإضافة للمفضلة ❤️" : "تمت الإزالة من المفضلة", "success");
}

// ========== البحث والفلترة ==========
function filterListings() {
    const query = document.getElementById("searchInput").value.toLowerCase();
    const filtered = allHousings.filter(p => 
        p.title?.toLowerCase().includes(query) || 
        p.location?.toLowerCase().includes(query) ||
        p.city?.toLowerCase().includes(query)
    );
    renderListings(filtered);
}

function setFilter(type, btnElement) {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    btnElement.classList.add('active');

    if (type === 'all') {
        renderListings(allHousings);
    } else if (type === 'luxury') {
        renderListings(allHousings.filter(p => p.isLuxury));
    } else {
        renderListings(allHousings.filter(p => p.gender === type));
    }
}

// ========== نافذة آخر حجز ==========
function checkLatestBooking(userId) {
    const bookingsRef = ref(db, "bookings");
    onValue(bookingsRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;
        
        const userBookings = Object.entries(data)
            .filter(([_, v]) => v.userId === userId)
            .map(([id, val]) => ({ id, ...val }))
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        
        const latest = userBookings[0];
        if (!latest) return;
        
        // التحقق إذا تم إخفاؤه مؤقتاً
        const dismissed = localStorage.getItem(`dismissed_booking_${latest.id}`);
        if (dismissed === "true") return;
        
        // عرض النافذة إذا كان الحجز معلقاً أو مقبولاً
        if (latest.status === "pending" || latest.status === "approved") {
            showBookingNotification(latest);
        }
    });
}

function showBookingNotification(booking) {
    // إزالة أي نافذة سابقة
    document.getElementById("bookingNotification")?.remove();
    
    const isPending = booking.status === "pending";
    const statusInfo = isPending 
        ? { icon: "fa-hourglass-half", color: "#f59e0b", bg: "rgba(245,158,11,0.12)", text: "قيد المراجعة" }
        : { icon: "fa-circle-check", color: "#10b981", bg: "rgba(16,185,129,0.12)", text: "مؤكد" };
    
    const modal = document.createElement("div");
    modal.className = "modal-overlay active";
    modal.id = "bookingNotification";
    modal.innerHTML = `
        <div class="auth-modal-content">
            <div class="modal-drag-indicator"></div>
            
            <div style="text-align:center; margin-bottom:20px;">
                <div style="width:64px; height:64px; border-radius:50%; background:${statusInfo.bg}; display:flex; align-items:center; justify-content:center; margin:0 auto 12px;">
                    <i class="fa-solid ${statusInfo.icon}" style="font-size:28px; color:${statusInfo.color};"></i>
                </div>
                <h3 style="font-size:18px; font-weight:800; color:var(--primary);">
                    ${isPending ? 'لديك حجز قيد المراجعة' : '🎉 تم قبول حجزك!'}
                </h3>
                <p style="font-size:14px; color:var(--text-muted); margin-top:6px;">
                    ${isPending 
                        ? 'سيتم مراجعة طلبك قريباً، يمكنك متابعة الحالة من صفحة حجوزاتي' 
                        : 'يمكنك الآن التواصل مع المالك لاستكمال الإجراءات'}
                </p>
            </div>
            
            <div style="background:#f8fafc; border-radius:14px; padding:16px; margin-bottom:16px;">
                <div style="display:flex; justify-content:space-between; font-size:14px; margin-bottom:10px;">
                    <span style="color:var(--text-muted);">الوحدة:</span>
                    <strong>${booking.housingTitle || '—'}</strong>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:14px; margin-bottom:10px;">
                    <span style="color:var(--text-muted);">السرير:</span>
                    <strong>${booking.bedLabel || '—'}</strong>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:14px; margin-bottom:10px;">
                    <span style="color:var(--text-muted);">من:</span>
                    <strong>${booking.checkInDate || '—'}</strong>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:14px;">
                    <span style="color:var(--text-muted);">إلى:</span>
                    <strong>${booking.checkOutDate || '—'}</strong>
                </div>
            </div>
            
            <div style="display:flex; gap:10px;">
                <button class="btn-submit-luxury" style="flex:1; background:${statusInfo.color};" 
                        onclick="goToBookings()">
                    <i class="fa-solid fa-calendar-check"></i> عرض حجوزاتي
                </button>
            </div>
            
            <div style="display:flex; gap:10px; margin-top:10px;">
                <button onclick="dismissBookingNotification('${booking.id}')" 
                        style="flex:1; padding:12px; background:transparent; border:1px solid var(--border-color); border-radius:14px; font-family:inherit; font-weight:600; color:var(--text-muted); cursor:pointer;">
                    <i class="fa-solid fa-bell-slash"></i> ذكرني لاحقاً
                </button>
                ${!isPending ? `
                <button onclick="dismissForever('${booking.id}')" 
                        style="flex:1; padding:12px; background:transparent; border:1px solid var(--border-color); border-radius:14px; font-family:inherit; font-weight:600; color:var(--text-muted); cursor:pointer;">
                    <i class="fa-solid fa-ban"></i> عدم الإظهار
                </button>` : ''}
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function dismissBookingNotification(bookingId) {
    localStorage.setItem(`dismissed_booking_${bookingId}`, "true");
    document.getElementById("bookingNotification")?.remove();
}

function dismissForever(bookingId) {
    localStorage.setItem(`dismissed_booking_${bookingId}`, "true");
    document.getElementById("bookingNotification")?.remove();
}

function goToBookings() {
    document.getElementById("bookingNotification")?.remove();
    window.location.href = "bookings.html";
}

// ========== الدايلوج ==========
function toggleAuthModal(show) {
    const modal = document.getElementById("authModal");
    if (modal) modal.classList.toggle("active", show);
    if (show) switchAuthTab('login');
}
function closeAuthModal() { toggleAuthModal(false); }

function openSupportModal() {
    const modal = document.getElementById("supportModal");
    if (modal) modal.classList.add("active");
}
function closeSupportModal() {
    const modal = document.getElementById("supportModal");
    if (modal) modal.classList.remove("active");
}

// ========== تبديل تابات الدخول ==========
function switchAuthTab(mode) {
    isSignUpMode = mode === 'signup';

    const loginTab = document.getElementById("loginTab");
    const signupTab = document.getElementById("signupTab");
    const authTitle = document.getElementById("authTitle");
    const authSubtitle = document.getElementById("authSubtitle");
    const nameField = document.getElementById("authName");
    const submitBtn = document.getElementById("authSubmitBtn");
    const forgotBtn = document.getElementById("forgotPasswordBtn");

    if (!loginTab || !signupTab) return;

    if (isSignUpMode) {
        loginTab.style.background = "transparent";
        loginTab.style.color = "var(--text-muted)";
        loginTab.style.boxShadow = "none";
        signupTab.style.background = "#fff";
        signupTab.style.color = "var(--primary)";
        signupTab.style.boxShadow = "var(--shadow-sm)";

        if (authTitle) authTitle.innerText = "إنشاء حساب جديد";
        if (authSubtitle) authSubtitle.innerText = "انضم لمنصة SAKANI-X واحجز سكنك";
        if (nameField) nameField.style.display = "block";
        if (forgotBtn) forgotBtn.style.display = "none";
        if (submitBtn) {
            submitBtn.innerText = "إنشاء حساب";
            submitBtn.onclick = () => handleEmailAuth(true);
        }
    } else {
        signupTab.style.background = "transparent";
        signupTab.style.color = "var(--text-muted)";
        signupTab.style.boxShadow = "none";
        loginTab.style.background = "#fff";
        loginTab.style.color = "var(--primary)";
        loginTab.style.boxShadow = "var(--shadow-sm)";

        if (authTitle) authTitle.innerText = "مرحباً بعودتك 👋";
        if (authSubtitle) authSubtitle.innerText = "سجّل دخولك لمتابعة حجوزاتك";
        if (nameField) nameField.style.display = "none";
        if (forgotBtn) forgotBtn.style.display = "block";
        if (submitBtn) {
            submitBtn.innerText = "دخول";
            submitBtn.onclick = () => handleEmailAuth(false);
        }
    }
}

// ========== تصدير الدوال ==========
window.loginWithGoogle = loginWithGoogle;
window.loginWithFacebook = loginWithFacebook;
window.handleEmailAuth = handleEmailAuth;
window.logoutUser = logoutUser;
window.resetPassword = resetPassword;
window.toggleAuthModal = toggleAuthModal;
window.closeAuthModal = closeAuthModal;
window.openSupportModal = openSupportModal;
window.closeSupportModal = closeSupportModal;
window.switchAuthTab = switchAuthTab;
window.filterListings = filterListings;
window.setFilter = setFilter;
window.handleFavToggle = handleFavToggle;
window.showSectionHousings = showSectionHousings;
window.dismissBookingNotification = dismissBookingNotification;
window.dismissForever = dismissForever;
window.goToBookings = goToBookings;
window.allHousings = allHousings;
window.userFavorites = userFavorites;
