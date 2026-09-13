/* ==========================================
   SAKANI-X CORE JS ENGINE — Firebase Connected
   ========================================== */

import { auth } from "./firebase-config.js";
import { 
    loginWithGoogle, loginWithFacebook, handleEmailAuth, 
    logoutUser, requireAuth, showToast 
} from "./auth.js";
import { 
    listenToHousings, createBooking, listenToUserBookings,
    toggleFavorite, listenToFavorites 
} from "./data-service.js";

let allHousings = [];
let currentUser = null;
let userFavorites = [];
let selectedBedId = null;
let isSignUpMode = false; // ✅ متغير وضع التسجيل/الدخول

// ========== مراقبة حالة المستخدم ==========
auth.onAuthStateChanged((user) => {
    currentUser = user;
    if (user) {
        listenToFavorites(user.uid, (favs) => {
            userFavorites = favs;
            renderListings(allHousings);
        });
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
                beds: h.beds || []
            }));
            renderListings(allHousings);
        });
    }
});

// ========== عرض السكنات ==========
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

    container.innerHTML = items.map(item => {
        const isFav = userFavorites.includes(item.id);
        const genderClass = item.gender === 'girls' ? 'gender-girls' : item.gender === 'boys' ? 'gender-boys' : '';
        const genderLabel = item.gender === 'girls' ? 'سكن طالبات' : item.gender === 'boys' ? 'سكن طلاب' : 'عائلات / موظفين';
        const genderIcon = item.gender === 'girls' ? 'fa-person-dress' : 'fa-person';
        
        return `
        <a href="details.html?id=${item.id}" class="housing-card">
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
    }).join('');
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

// ========== الدايلوج ==========
function toggleAuthModal(show) {
    const modal = document.getElementById("authModal");
    if (modal) modal.classList.toggle("active", show);
    if (show) {
        // إعادة تعيين للوضع الافتراضي (دخول)
        switchAuthTab('login');
    }
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

// ✅✅✅ هنا بالظبط مكان switchAuthTab ✅✅✅
// ========== تبديل تابات الدخول / التسجيل ==========
function switchAuthTab(mode) {
    isSignUpMode = mode === 'signup';

    const loginTab = document.getElementById("loginTab");
    const signupTab = document.getElementById("signupTab");
    const authTitle = document.getElementById("authTitle");
    const authSubtitle = document.getElementById("authSubtitle");
    const nameField = document.getElementById("authName");
    const submitBtn = document.getElementById("authSubmitBtn");

    if (!loginTab || !signupTab) return;

    if (isSignUpMode) {
        // تفعيل تاب التسجيل
        loginTab.style.background = "transparent";
        loginTab.style.color = "var(--text-muted)";
        loginTab.style.boxShadow = "none";
        signupTab.style.background = "#fff";
        signupTab.style.color = "var(--primary)";
        signupTab.style.boxShadow = "var(--shadow-sm)";

        if (authTitle) authTitle.innerText = "إنشاء حساب جديد";
        if (authSubtitle) authSubtitle.innerText = "انضم لمنصة SAKANI-X واحجز سكنك";
        if (nameField) nameField.style.display = "block";
        if (submitBtn) {
            submitBtn.innerText = "إنشاء حساب";
            submitBtn.onclick = () => handleEmailAuth(true);
        }
    } else {
        // تفعيل تاب الدخول
        signupTab.style.background = "transparent";
        signupTab.style.color = "var(--text-muted)";
        signupTab.style.boxShadow = "none";
        loginTab.style.background = "#fff";
        loginTab.style.color = "var(--primary)";
        loginTab.style.boxShadow = "var(--shadow-sm)";

        if (authTitle) authTitle.innerText = "مرحباً بعودتك 👋";
        if (authSubtitle) authSubtitle.innerText = "سجّل دخولك لمتابعة حجوزاتك";
        if (nameField) nameField.style.display = "none";
        if (submitBtn) {
            submitBtn.innerText = "دخول";
            submitBtn.onclick = () => handleEmailAuth(false);
        }
    }
}
// ✅✅✅ نهاية switchAuthTab ✅✅✅

// ========== تفاصيل العقار ==========
function loadPropertyDetails() {
    const params = new URLSearchParams(window.location.search);
    const propId = params.get('id');
    if (!propId) { window.location.href = "index.html"; return; }

    listenToHousings((housings) => {
        const item = housings.find(p => p.id === propId);
        if (!item) {
            document.getElementById("propTitle").innerText = "الوحدة غير موجودة";
            return;
        }

        document.getElementById("propTitle").innerText = item.title || "";
        document.getElementById("propLocation").innerText = item.address || item.city || "";
        document.getElementById("propPrice").innerText = `${item.price?.toLocaleString() || 0} ج.م`;
        document.getElementById("propImage").src = item.images?.[0] || "https://via.placeholder.com/600x400?text=SAKANI-X";
        
        const genderBadge = document.getElementById("propGenderBadge");
        if (genderBadge) {
            const isGirls = item.gender?.includes("طالبات");
            genderBadge.innerText = isGirls ? 'سكن طالبات' : 'سكن طلاب';
            genderBadge.className = `badge-tag ${isGirls ? 'gender-girls' : 'gender-boys'}`;
        }

        // الخريطة
        if (typeof L !== 'undefined' && item.lat && item.lng) {
            const map = L.map('propertyMap').setView([item.lat, item.lng], 14);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
            L.marker([item.lat, item.lng]).addTo(map).bindPopup(item.title).openPopup();
        }

        // الأسرة
        const bedsGrid = document.getElementById("bedsGrid");
        if (bedsGrid) {
            const beds = item.beds && item.beds.length > 0 ? item.beds : [
                { id: "b1", room: "غرفة 1", status: "available" },
                { id: "b2", room: "غرفة 1", status: "available" },
                { id: "b3", room: "غرفة 2", status: "available" }
            ];
            bedsGrid.innerHTML = beds.map(bed => `
                <div class="bed-card ${bed.status}" onclick="selectBed('${bed.id}', this, '${bed.status}')">
                    <i class="fa-solid fa-bed"></i>
                    <div style="font-weight: 700; font-size: 13px;">${bed.room}</div>
                    <div style="font-size: 11px; margin-top: 2px;">${bed.status === 'available' ? 'متاح للكرية' : 'محجوز'}</div>
                </div>
            `).join('');
        }
    });
}

function selectBed(bedId, element, status) {
    if (status === 'occupied') return;
    document.querySelectorAll('.bed-card').forEach(b => b.classList.remove('selected'));
    element.classList.add('selected');
    selectedBedId = bedId;
}

// ========== الحجز ==========
function confirmBooking() {
    if (!selectedBedId) {
        showToast("برجاء اختيار السرير المطلوب أولاً", "error");
        return;
    }
    if (!currentUser) {
        toggleAuthModal(true);
        showToast("سجّل دخولك أولاً لإتمام الحجز", "info");
        return;
    }
    showBookingModal();
}

function showBookingModal() {
    const params = new URLSearchParams(window.location.search);
    const propId = params.get('id');
    const item = allHousings.find(p => p.id === propId);
    
    const modal = document.createElement("div");
    modal.className = "modal-overlay active";
    modal.id = "bookingConfirmModal";
    modal.innerHTML = `
        <div class="auth-modal-content">
            <div class="modal-drag-indicator"></div>
            <h3 style="text-align:center; margin-bottom:20px;">تأكيد الحجز</h3>
            <p style="text-align:center; color:var(--text-muted); margin-bottom:16px;">
                ${item?.title || ""}<br>
                <strong style="color:var(--accent-gold);">${item?.price?.toLocaleString() || 0} ج.م / شهرياً</strong>
            </p>
            <label style="font-size:13px; font-weight:600; display:block; margin-bottom:6px;">تاريخ الانتقال</label>
            <input type="date" id="moveInDate" class="input-field" required>
            <label style="font-size:13px; font-weight:600; display:block; margin-bottom:6px;">ملاحظات (اختياري)</label>
            <textarea id="bookingNotes" class="input-field" rows="2" placeholder="أي تفاصيل إضافية..."></textarea>
            <button class="btn-submit-luxury" onclick="submitBooking()" style="margin-top:12px;">تأكيد الحجز</button>
            <button onclick="document.getElementById('bookingConfirmModal').remove()" 
                    style="width:100%; margin-top:8px; padding:12px; background:transparent; border:1px solid var(--border-color); border-radius:14px; cursor:pointer; font-family:inherit;">
                إلغاء
            </button>
        </div>
    `;
    document.body.appendChild(modal);
    document.getElementById("moveInDate").min = new Date().toISOString().split('T')[0];
}

async function submitBooking() {
    const moveInDate = document.getElementById("moveInDate").value;
    const notes = document.getElementById("bookingNotes").value;
    if (!moveInDate) { showToast("اختر تاريخ الانتقال", "error"); return; }

    const params = new URLSearchParams(window.location.search);
    const propId = params.get('id');
    const item = allHousings.find(p => p.id === propId);

    try {
        await createBooking(
            currentUser, propId, item.title, selectedBedId, 
            selectedBedId, moveInDate, notes
        );
        document.getElementById("bookingConfirmModal")?.remove();
        showToast("تم إرسال طلب الحجز بنجاح! سيتم مراجعته قريباً ✅", "success");
        selectedBedId = null;
        document.querySelectorAll('.bed-card').forEach(b => b.classList.remove('selected'));
    } catch (error) {
        console.error("Booking error:", error);
        showToast("فشل إرسال الحجز: " + error.message, "error");
    }
}

// ========== تصدير الدوال للنطاق العام ==========
window.loginWithGoogle = loginWithGoogle;
window.loginWithFacebook = loginWithFacebook;
window.handleEmailAuth = handleEmailAuth;
window.logoutUser = logoutUser;
window.toggleAuthModal = toggleAuthModal;
window.closeAuthModal = closeAuthModal;
window.openSupportModal = openSupportModal;
window.closeSupportModal = closeSupportModal;
window.switchAuthTab = switchAuthTab; // ✅ مهم للتابات
window.filterListings = filterListings;
window.setFilter = setFilter;
window.selectBed = selectBed;
window.confirmBooking = confirmBooking;
window.submitBooking = submitBooking;
window.handleFavToggle = handleFavToggle;
window.loadPropertyDetails = loadPropertyDetails;
