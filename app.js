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
let activeFilter = "all";

auth.onAuthStateChanged((user) => {
    currentUser = user;
    if (user) {
        listenToFavorites(user.uid, (favs) => {
            userFavorites = favs;
            applyFiltersAndRender();
        });
        checkLatestBooking(user.uid);
    } else {
        userFavorites = [];
        applyFiltersAndRender();
    }
});

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
            applyFiltersAndRender();
            renderSections();
        });function
    }
});

listenToSections((sections) => {
    allSections = sections;
    renderSections();
});

 // ==========================================
// دالة الفلترة الشاملة (تفلتر البيانات أولاً)
// ==========================================
function getFilteredHousings() {
    const query = document.getElementById("searchInput")?.value.toLowerCase() || "";
    let filtered = allHousings.filter(p => 
        p.title?.toLowerCase().includes(query) || 
        p.location?.toLowerCase().includes(query) ||
        p.city?.toLowerCase().includes(query)
    );

    if (activeFilter === "luxury") {
        filtered = filtered.filter(p => p.isLuxury);
    } else if (activeFilter !== "all") {
        filtered = filtered.filter(p => p.gender === activeFilter);
    }

    return filtered;
}

// ==========================================
// تحديث العرض للقائمة الرئيسية والأقسام معاُ
// ==========================================
function applyFiltersAndRender() {
    const filtered = getFilteredHousings();
    renderListings(filtered);
    renderSections(filtered); // استدعاء الأقسام بالبيانات المفلترة
}

// ==========================================
// عرض الأقسام المفلترة ديناميكياً
// ==========================================
function renderSections(filteredHousings = null) {
    const container = document.getElementById("sectionsContainer");
    if (!container) return;
    
    if (allSections.length === 0) {
        container.innerHTML = "";
        return;
    }
    
    // استخدام البيانات المفلترة الحالية (إن وجدت) أو حسابها
    const sourceData = filteredHousings || getFilteredHousings();
    
    container.innerHTML = allSections.map(section => {
        // فلترة الوحدات التابعة للقسم والتي تطابق خيار (طالبات / طلاب / بحث) في نفس الوقت
        const sectionHousings = sourceData.filter(h => h.section === section.id);
        
        // إذا كان القسم لا يحتوي على أي وحدات تطابق الفلتر الحالي، ين مخفياً تماماً
        if (sectionHousings.length === 0) return "";
        
        return `
        <div class="mt-6 px-5">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                    <i class="fa-solid ${section.icon || 'fa-building'} text-amber-500"></i>
                    ${section.name}
                </h3>
                <a href="view-more.html?category=${section.id}&gender=${activeFilter}" class="text-xs font-bold text-amber-600 border border-slate-200 px-3 py-1.5 rounded-full hover:bg-amber-50 transition-all flex items-center gap-1">
                    عرض المزيد (${sectionHousings.length}) <i class="fa-solid fa-chevron-left"></i>
                </a>
            </div>
            <div class="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                ${sectionHousings.slice(0, 6).map(item => `
                    <div class="min-w-[260px] max-w-[260px] flex-shrink-0">
                        ${renderCard(item)}
                    </div>
                `).join('')}
            </div>
        </div>`;
    }).join('');
}


function renderCard(item) {
    const isFav = userFavorites.includes(item.id);
    const genderClass = item.gender === 'girls' ? 'bg-pink-500/80' : item.gender === 'boys' ? 'bg-blue-500/80' : 'bg-slate-500/80';
    const genderLabel = item.gender === 'girls' ? 'سكن طالبات' : item.gender === 'boys' ? 'سكن طلاب' : 'عائلات / موظفين';
    const genderIcon = item.gender === 'girls' ? 'fa-person-dress' : 'fa-person';
    const totalBeds = item.beds.length;
    const availableBeds = item.beds.filter(b => b.status === 'available').length;
    
    return `
    <a href="details.html?id=${item.id}" class="block bg-white rounded-2xl overflow-hidden shadow-lg border border-slate-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
        <div class="relative h-52 overflow-hidden">
            <img src="${item.image}" alt="${item.title}" class="w-full h-full object-cover transition-transform duration-500 hover:scale-105" onerror="this.src='https://via.placeholder.com/600x400?text=SAKANI-X'">
            <div class="absolute top-3 right-3 left-3 flex justify-between items-center">
                <span class="text-white text-xs font-bold px-3 py-1 rounded-full backdrop-blur-sm ${genderClass}">
                    <i class="fa-solid ${genderIcon}"></i> ${genderLabel}
                </span>
                <button class="fav-btn w-9 h-9 rounded-full bg-white/90 flex items-center justify-center shadow-md transition-transform active:scale-90 ${isFav ? 'text-red-500' : 'text-slate-700'}" 
                        onclick="event.preventDefault(); event.stopPropagation(); handleFavToggle('${item.id}', this);">
                    <i class="fa-${isFav ? 'solid' : 'regular'} fa-heart"></i>
                </button>
            </div>
        </div>
        <div class="p-4">
            <div class="text-lg font-extrabold text-amber-600 mb-1">${item.price?.toLocaleString()} ج.م <span class="text-xs text-slate-400 font-medium">/ شهرياً</span></div>
            <h3 class="text-base font-bold text-slate-900 mb-2">${item.title}</h3>
            <div class="flex items-center gap-2 text-sm text-slate-500 mb-3">
                <i class="fa-solid fa-location-dot text-amber-500"></i>
                <span>${item.location}</span>
            </div>
            <div class="flex items-center justify-between pt-3 border-t border-dashed border-slate-200">
                <span class="text-xs font-bold ${availableBeds > 0 ? 'text-emerald-600' : 'text-red-500'}">
                    <i class="fa-solid fa-bed"></i> متبقي ${availableBeds} من أصل ${totalBeds} سرير
                </span>
                <span class="text-xs text-slate-400"><i class="fa-solid fa-arrow-left"></i></span>
            </div>
        </div>
    </a>`;
}

function renderListings(items) {
    const container = document.getElementById("listingsContainer");
    if (!container) return;

    if (items.length === 0) {
        container.innerHTML = `
            <div class="text-center py-16 px-4 text-slate-400">
                <i class="fa-solid fa-building text-5xl mb-4 opacity-30"></i>
                <h3 class="text-lg font-bold text-slate-900 mb-1">لا توجد وحدات سكنية متاحة</h3>
                <p class="text-sm">سيتم إضافة وحدات جديدة قريباً</p>
            </div>`;
        return;
    }

    container.innerHTML = items.map(item => renderCard(item)).join('');
}

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
        <div class="mt-6 px-5">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                    <i class="fa-solid ${section.icon || 'fa-building'} text-amber-500"></i>
                    ${section.name}
                </h3>
                <a href="view-more.html?category=${section.id}" class="text-xs font-bold text-amber-600 border border-slate-200 px-3 py-1.5 rounded-full hover:bg-amber-50 transition-all flex items-center gap-1">
                    عرض المزيد <i class="fa-solid fa-chevron-left"></i>
                </a>
            </div>
            <div class="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                ${sectionHousings.slice(0, 6).map(item => `
                    <div class="min-w-[260px] max-w-[260px] flex-shrink-0">
                        ${renderCard(item)}
                    </div>
                `).join('')}
            </div>
        </div>`;
    }).join('');
}

async function handleFavToggle(housingId, btnEl) {
    if (!currentUser) {
        toggleAuthModal(true);
        showToast("سجّل دخولك أولاً لإضافة المفضلة", "info");
        return;
    }
    const isNowFav = await toggleFavorite(currentUser.uid, housingId);
    btnEl.classList.toggle('text-red-500', isNowFav);
    btnEl.classList.toggle('text-slate-700', !isNowFav);
    btnEl.querySelector('i').className = `fa-${isNowFav ? 'solid' : 'regular'} fa-heart`;
    showToast(isNowFav ? "تمت الإضافة للمفضلة" : "تمت الإزالة من المفضلة", "success");
}

function filterListings() {
    applyFiltersAndRender();
}

function setFilter(type, btnElement) {
    activeFilter = type;
    document.querySelectorAll('.chip').forEach(c => {
        c.classList.remove('bg-slate-900', 'text-white', 'border-slate-900');
        c.classList.add('bg-white', 'text-slate-500', 'border-slate-200');
    });
    btnElement.classList.remove('bg-white', 'text-slate-500', 'border-slate-200');
    btnElement.classList.add('bg-slate-900', 'text-white', 'border-slate-900');
    applyFiltersAndRender();
}

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
        
        const dismissed = localStorage.getItem(`dismissed_booking_${latest.id}`);
        if (dismissed === "true") return;
        
        if (latest.status === "pending" || latest.status === "approved") {
            showBookingNotification(latest);
        }
    });
}

function showBookingNotification(booking) {
    document.getElementById("bookingNotification")?.remove();
    
    const isPending = booking.status === "pending";
    const statusInfo = isPending 
        ? { icon: "fa-hourglass-half", color: "text-amber-500", bg: "bg-amber-50", text: "قيد المراجعة" }
        : { icon: "fa-circle-check", color: "text-emerald-500", bg: "bg-emerald-50", text: "مؤكد" };
    
    const modal = document.createElement("div");
    modal.className = "fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[2000] flex items-end justify-center";
    modal.id = "bookingNotification";
    modal.innerHTML = `
        <div class="bg-white w-full max-w-md rounded-t-3xl p-6 shadow-2xl transform transition-transform duration-300">
            <div class="w-12 h-1 bg-slate-200 rounded-full mx-auto mb-5"></div>
            <div class="text-center mb-5">
                <div class="w-16 h-16 rounded-full ${statusInfo.bg} flex items-center justify-center mx-auto mb-3">
                    <i class="fa-solid ${statusInfo.icon} text-2xl ${statusInfo.color}"></i>
                </div>
                <h3 class="text-lg font-extrabold text-slate-900">
                    ${isPending ? 'لديك حجز قيد المراجعة' : 'تم قبول حجزك!'}
                </h3>
                <p class="text-sm text-slate-500 mt-1">
                    ${isPending ? 'سيتم مراجعة طلبك قريباً' : 'يمكنك التواصل مع المالك لاستكمال الإجراءات'}
                </p>
            </div>
            <div class="bg-slate-50 rounded-xl p-4 mb-4 space-y-2">
                <div class="flex justify-between text-sm"><span class="text-slate-500">الوحدة:</span><strong>${booking.housingTitle || '—'}</strong></div>
                <div class="flex justify-between text-sm"><span class="text-slate-500">السرير:</span><strong>${booking.bedLabel || '—'}</strong></div>
                <div class="flex justify-between text-sm"><span class="text-slate-500">من:</span><strong>${booking.checkInDate || '—'}</strong></div>
                <div class="flex justify-between text-sm"><span class="text-slate-500">إلى:</span><strong>${booking.checkOutDate || '—'}</strong></div>
            </div>
            <button class="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl shadow-lg hover:bg-slate-800 transition-all mb-2" 
                    onclick="goToBookings()">
                <i class="fa-solid fa-calendar-check"></i> عرض حجوزاتي
            </button>
            <div class="flex gap-2">
                <button onclick="dismissBookingNotification('${booking.id}')" 
                        class="flex-1 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-50 transition-all">
                    <i class="fa-solid fa-bell-slash"></i> ذكرني لاحقاً
                </button>
                ${!isPending ? `
                <button onclick="dismissForever('${booking.id}')" 
                        class="flex-1 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-50 transition-all">
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

function toggleAuthModal(show) {
    const modal = document.getElementById("authModal");
    if (modal) {
        if (show) {
            modal.classList.remove("hidden");
            modal.classList.add("flex");
        } else {
            modal.classList.add("hidden");
            modal.classList.remove("flex");
        }
    }
    if (show) switchAuthTab('login');
}

function closeAuthModal() { toggleAuthModal(false); }

function openSupportModal() {
    const modal = document.getElementById("supportModal");
    if (modal) {
        modal.classList.remove("hidden");
        modal.classList.add("flex");
    }
}

function closeSupportModal() {
    const modal = document.getElementById("supportModal");
    if (modal) {
        modal.classList.add("hidden");
        modal.classList.remove("flex");
    }
}

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
        loginTab.classList.remove("bg-white", "text-slate-900", "shadow-sm");
        loginTab.classList.add("text-slate-400");
        signupTab.classList.add("bg-white", "text-slate-900", "shadow-sm");
        signupTab.classList.remove("text-slate-400");

        if (authTitle) authTitle.innerText = "إنشاء حساب جديد";
        if (authSubtitle) authSubtitle.innerText = "انضم لمنصة SAKANI-X";
        if (nameField) nameField.classList.remove("hidden");
        if (forgotBtn) forgotBtn.classList.add("hidden");
        if (submitBtn) {
            submitBtn.innerText = "إنشاء حساب";
            submitBtn.onclick = () => handleEmailAuth(true);
        }
    } else {
        signupTab.classList.remove("bg-white", "text-slate-900", "shadow-sm");
        signupTab.classList.add("text-slate-400");
        loginTab.classList.add("bg-white", "text-slate-900", "shadow-sm");
        loginTab.classList.remove("text-slate-400");

        if (authTitle) authTitle.innerText = "مرحباً بعودتك";
        if (authSubtitle) authSubtitle.innerText = "سجّل دخولك لمتابعة حجوزاتك";
        if (nameField) nameField.classList.add("hidden");
        if (forgotBtn) forgotBtn.classList.remove("hidden");
        if (submitBtn) {
            submitBtn.innerText = "دخول";
            submitBtn.onclick = () => handleEmailAuth(false);
        }
    }
}

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
window.dismissBookingNotification = dismissBookingNotification;
window.dismissForever = dismissForever;
window.goToBookings = goToBookings;
window.allHousings = allHousings;
window.userFavorites = userFavorites;
