// details.js
import { auth, db, ref, onValue, push, set, get, remove } from "./firebase-config.js";
import { showToast, onAuthStateChanged, isProfileComplete } from "./auth.js";

let currentUser = null;
let currentHousing = null;
let selectedBedId = null;
let isFav = false;
let currentImageIndex = 0;
let imagesList = [];

onAuthStateChanged(auth, (user) => { currentUser = user; });

const params = new URLSearchParams(window.location.search);
const propId = params.get("id");
if (!propId) window.location.href = "index.html";

// ========== تحميل التفاصيل ==========
onValue(ref(db, `housings/${propId}`), (snapshot) => {
    if (!snapshot.exists()) {
        document.getElementById("propTitle").innerText = " الوحدة غير موجودة";
        return;
    }
    const h = { id: propId, ...snapshot.val() };
    currentHousing = h;

    document.getElementById("propTitle").innerText = h.title || "وحدة سكنية";
    document.getElementById("propLocation").innerText = h.address || h.city || "—";
    document.getElementById("propPrice").innerText = `${(h.price || 0).toLocaleString()} ج.م`;
    document.getElementById("propDescription").innerText = h.description || "لا يوجد وصف متاح.";

    // معرض الصور
    imagesList = h.images || ["https://via.placeholder.com/800x600?text=SAKANI-X"];
    currentImageIndex = 0;
    renderGallery();

    // Amenities
    const am = document.getElementById("propAmenities");
    am.innerHTML = (h.amenities || []).map(a => 
        `<span class="amenity-chip"><i class="fa-solid fa-check"></i> ${a}</span>`
    ).join('');

    // Beds
    const beds = h.beds && h.beds.length > 0 ? h.beds : [
        { id: "b1", room: "غرفة 1", status: "available" },
        { id: "b2", room: "غرفة 1", status: "available" },
        { id: "b3", room: "غرفة 2", status: "available" }
    ];
    document.getElementById("bedsGrid").innerHTML = beds.map(bed => `
        <div class="bed-card ${bed.status}" onclick="selectBed('${bed.id}', this, '${bed.status}', '${bed.room}')">
            <i class="fa-solid fa-bed"></i>
            <div style="font-weight:700; font-size:13px;">${bed.room}</div>
            <div style="font-size:11px; margin-top:2px;">${bed.status === 'available' ? 'متاح' : 'محجوز'}</div>
        </div>
    `).join('');

    // Map
    setTimeout(() => {
        if (typeof L !== "undefined") {
            const lat = h.lat || 27.1801, lng = h.lng || 31.1837;
            const map = L.map("propertyMap").setView([lat, lng], 14);
            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
            L.marker([lat, lng]).addTo(map).bindPopup(h.title).openPopup();
        }
    }, 100);

    // المفضلة
    if (currentUser) {
        get(ref(db, `favorites/${currentUser.uid}/${propId}`)).then(snap => {
            isFav = snap.exists();
            const btn = document.getElementById("detailFavBtn");
            btn.classList.toggle("active", isFav);
            btn.querySelector("i").className = `fa-${isFav ? 'solid' : 'regular'} fa-heart`;
        });
    }
}, (error) => {
    console.error("Load error:", error);
    document.getElementById("propTitle").innerText = " فشل تحميل البيانات";
    showToast("فشل تحميل الوحدة", "error");
});

// ========== معرض الصور ==========
function renderGallery() {
    const track = document.getElementById("galleryTrack");
    const dots = document.getElementById("galleryDots");
    const counter = document.getElementById("galleryCounter");
    
    if (!track) return;
    
    track.innerHTML = imagesList.map(img => 
        `<img src="${img}" onerror="this.src='https://via.placeholder.com/800x600?text=SAKANI-X'">`
    ).join('');
    
    dots.innerHTML = imagesList.map((_, i) => 
        `<button class="gallery-dot ${i === 0 ? 'active' : ''}" onclick="goToImage(${i})"></button>`
    ).join('');
    
    counter.innerText = `1 / ${imagesList.length}`;
    updateGallery();
}

function updateGallery() {
    const track = document.getElementById("galleryTrack");
    if (!track) return;
    track.style.transform = `translateX(${currentImageIndex * 100}%)`;
    
    document.querySelectorAll(".gallery-dot").forEach((d, i) => {
        d.classList.toggle("active", i === currentImageIndex);
    });
    
    const counter = document.getElementById("galleryCounter");
    if (counter) counter.innerText = `${currentImageIndex + 1} / ${imagesList.length}`;
}

function nextImage() {
    currentImageIndex = (currentImageIndex + 1) % imagesList.length;
    updateGallery();
}

function prevImage() {
    currentImageIndex = (currentImageIndex - 1 + imagesList.length) % imagesList.length;
    updateGallery();
}

function goToImage(index) {
    currentImageIndex = index;
    updateGallery();
}

// ========== اختيار السرير ==========
function selectBed(bedId, el, status, roomLabel) {
    if (status === "occupied") {
        showToast("هذا السرير محجوز بالفعل", "error");
        return;
    }
    document.querySelectorAll(".bed-card").forEach(b => b.classList.remove("selected"));
    el.classList.add("selected");
    selectedBedId = bedId;
    window._selectedRoom = roomLabel;
}

// ========== المفضلة ==========
async function toggleDetailFav() {
    if (!currentUser) {
        window.location.href = "index.html#login";
        return;
    }
    const favRef = ref(db, `favorites/${currentUser.uid}/${propId}`);
    const snap = await get(favRef);
    if (snap.exists()) {
        await remove(favRef);
        isFav = false;
        showToast("تمت الإزالة من المفضلة", "info");
    } else {
        await set(favRef, { addedAt: Date.now() });
        isFav = true;
        showToast("تمت الإضافة للمفضلة ❤️", "success");
    }
    const btn = document.getElementById("detailFavBtn");
    btn.classList.toggle("active", isFav);
    btn.querySelector("i").className = `fa-${isFav ? 'solid' : 'regular'} fa-heart`;
}

// ========== الحجز ==========
async function confirmBooking() {
    if (!selectedBedId) return showToast("🛏️ اختر السرير أولاً", "error");
    if (!currentUser) {
        window.location.href = "index.html#login";
        return;
    }

    const complete = await isProfileComplete();
    if (!complete) {
        showToast("📝 استكمل بياناتك أولاً من صفحة حسابي", "info");
        setTimeout(() => window.location.href = "profile.html", 1500);
        return;
    }

    showBookingModal();
}

function showBookingModal() {
    const existing = document.getElementById("bookingModal");
    if (existing) existing.remove();

    const today = new Date().toISOString().split("T")[0];
    const modal = document.createElement("div");
    modal.className = "modal-overlay active";
    modal.id = "bookingModal";
    modal.innerHTML = `
        <div class="auth-modal-content">
            <div class="modal-drag-indicator"></div>
            <h3 style="text-align:center; margin-bottom:6px;">تأكيد الحجز</h3>
            <p style="text-align:center; color:var(--text-muted); font-size:13px; margin-bottom:20px;">
                ${currentHousing?.title || ''}
            </p>

            <div style="background: rgba(197,155,39,0.08); border-radius:12px; padding:12px; margin-bottom:16px;">
                <div style="display:flex; justify-content:space-between; font-size:14px; margin-bottom:6px;">
                    <span style="color: var(--text-muted);">السرير المختار:</span>
                    <strong>${window._selectedRoom || selectedBedId}</strong>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:14px;">
                    <span style="color: var(--text-muted);">السعر الشهري:</span>
                    <strong style="color: var(--accent-gold);">${(currentHousing?.price || 0).toLocaleString()} ج.م</strong>
                </div>
            </div>

            <label class="form-label">تاريخ الاستلام *</label>
            <input type="date" id="checkInDate" class="input-field" min="${today}" value="${today}">

            <label class="form-label">تاريخ المغادرة المتوقع *</label>
            <input type="date" id="checkOutDate" class="input-field" min="${today}">

            <label class="form-label">ملاحظات إضافية (اختياري)</label>
            <textarea id="bookingNotes" class="input-field" rows="3" placeholder="أي تفاصيل عن وقت الوصول أو طلبات خاصة..."></textarea>

            <button class="btn-submit-luxury" id="submitBookingBtn" onclick="submitBooking()" style="margin-top:14px;">
                <i class="fa-solid fa-paper-plane"></i> إرسال طلب الحجز
            </button>
            <button onclick="closeBookingModal()" 
                    style="width:100%; margin-top:10px; padding:12px; background:transparent; border:none; color:var(--text-muted); font-family:inherit; font-weight:600; cursor:pointer;">
                إلغاء
            </button>
        </div>
    `;
    document.body.appendChild(modal);
}

function closeBookingModal() {
    document.getElementById("bookingModal")?.remove();
}

async function submitBooking() {
    const checkInDate = document.getElementById("checkInDate").value;
    const checkOutDate = document.getElementById("checkOutDate").value;
    const notes = document.getElementById("bookingNotes").value.trim();

    if (!checkInDate) return showToast("📅 اختر تاريخ الاستلام", "error");
    if (!checkOutDate) return showToast("📅 اختر تاريخ المغادرة", "error");
    if (new Date(checkOutDate) <= new Date(checkInDate)) {
        return showToast("تاريخ المغادرة يجب أن يكون بعد تاريخ الاستلام", "error");
    }

    const btn = document.getElementById("submitBookingBtn");
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> جاري الإرسال...`;

    try {
        const userSnap = await get(ref(db, `users/${currentUser.uid}`));
        const profile = userSnap.val() || {};

        const bookingData = {
            userId: currentUser.uid,
            userName: profile.name || currentUser.displayName || "مستخدم",
            userEmail: currentUser.email,
            userPhone: profile.phone || "",
            userGovernorate: profile.governorate || "",
            housingId: propId,
            housingTitle: currentHousing.title,
            housingCity: currentHousing.city || "",
            housingImage: currentHousing.images?.[0] || "",
            bedId: selectedBedId,
            bedLabel: window._selectedRoom || selectedBedId,
            checkInDate,
            checkOutDate,
            monthlyPrice: currentHousing.price || 0,
            notes,
            status: "pending",
            createdAt: Date.now()
        };

        const newRef = push(ref(db, "bookings"));
        await set(newRef, bookingData);

        closeBookingModal();
        showToast("تم إرسال طلب الحجز بنجاح! سيتم مراجعته قريباً", "success");
        selectedBedId = null;
        document.querySelectorAll(".bed-card").forEach(b => b.classList.remove("selected"));
    } catch (err) {
        console.error(err);
        showToast("فشل الإرسال: " + err.message, "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> إرسال طلب الحجز`;
    }
}

window.selectBed = selectBed;
window.toggleDetailFav = toggleDetailFav;
window.confirmBooking = confirmBooking;
window.submitBooking = submitBooking;
window.closeBookingModal = closeBookingModal;
window.nextImage = nextImage;
window.prevImage = prevImage;
window.goToImage = goToImage;
