import { 
    db, ref, push, set, onValue, remove, update, get,
    auth, signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "../firebase-config.js";

let uploadedImagesBase64 = [];
let ledgerImageBase64 = "";
let allSections = [];
let allHousings = [];
let allLedgerEntries = [];

const loginScreen = document.getElementById("adminLoginScreen");
const dashboardWrapper = document.getElementById("adminDashboardWrapper");
const loginErrorEl = document.getElementById("adminLoginError");

function showAdminLoginScreen(errorMsg) {
    loginScreen.classList.remove("hidden");
    dashboardWrapper.classList.add("hidden");
    if (errorMsg) {
        loginErrorEl.textContent = errorMsg;
        loginErrorEl.classList.remove("hidden");
    } else {
        loginErrorEl.classList.add("hidden");
    }
}

function showAdminDashboard() {
    loginScreen.classList.add("hidden");
    dashboardWrapper.classList.remove("hidden");
}

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        showAdminLoginScreen();
        return;
    }
    try {
        const adminSnap = await get(ref(db, `admins/${user.uid}`));
        if (!adminSnap.exists()) {
            await signOut(auth);
            showAdminLoginScreen("هذا الحساب غير مصرّح له بالدخول للوحة الإدارة");
            return;
        }
        showAdminDashboard();
    } catch (err) {
        showAdminLoginScreen("تعذّر التحقق من صلاحياتك، حاول تاني");
    }
});

async function adminLogin() {
    const email = document.getElementById("adminEmail").value.trim();
    const password = document.getElementById("adminPassword").value;

    if (!email || !password) {
        loginErrorEl.textContent = "أدخل البريد الإلكتروني وكلمة المرور";
        loginErrorEl.classList.remove("hidden");
        return;
    }

    const btn = document.getElementById("adminLoginBtn");
    btn.disabled = true;
    btn.innerText = "جاري الدخول...";

    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
        loginErrorEl.textContent = "البريد الإلكتروني أو كلمة المرور غير صحيحة";
        loginErrorEl.classList.remove("hidden");
    } finally {
        btn.disabled = false;
        btn.innerText = "دخول";
    }
}
window.adminLogin = adminLogin;

function adminLogout() {
    signOut(auth);
}
window.adminLogout = adminLogout;

document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".nav-btn").forEach(b => {
            b.classList.remove("active", "bg-indigo-600", "text-white");
            b.classList.add("text-slate-400");
        });
        document.querySelectorAll(".tab-content").forEach(c => c.classList.add("hidden"));
        btn.classList.add("active", "bg-indigo-600", "text-white");
        btn.classList.remove("text-slate-400");
        document.getElementById(btn.dataset.tab).classList.remove("hidden");
    });
});

function showToast(msg, type = "info") {
    const t = document.createElement("div");
    t.className = `fixed top-5 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 rounded-xl text-sm font-bold shadow-2xl transition-all duration-300 opacity-0 -translate-y-5`;
    t.style.background = type === "success" ? "#10b981" : type === "error" ? "#ef4444" : "#6366f1";
    t.style.color = "#fff";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.classList.remove("opacity-0", "-translate-y-5"), 50);
    setTimeout(() => { 
        t.classList.add("opacity-0", "-translate-y-5"); 
        setTimeout(() => t.remove(), 300); 
    }, 3000);
}

function customConfirm(message, onConfirm) {
    const overlay = document.createElement("div");
    overlay.className = "fixed inset-0 bg-black/70 backdrop-blur-sm z-[3000] flex items-center justify-center p-4";
    overlay.innerHTML = `
        <div class="glass rounded-2xl p-6 max-w-sm w-full text-center">
            <div class="w-14 h-14 rounded-full bg-rose-500/20 flex items-center justify-center mx-auto mb-4">
                <i class="fa-solid fa-triangle-exclamation text-2xl text-rose-400"></i>
            </div>
            <p class="text-base font-bold mb-6">${message}</p>
            <div class="flex gap-3">
                <button class="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl transition-all" id="confirmYes">تأكيد</button>
                <button class="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-all" id="confirmNo">إلغاء</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#confirmYes").onclick = () => { overlay.remove(); onConfirm(); };
    overlay.querySelector("#confirmNo").onclick = () => overlay.remove();
}

const DEFAULT_MAP_CENTER = [30.0444, 31.2357];
let locationMap = null;
let housingMarker = null;
let universityMarker = null;
let activePinType = "housing";

const universityIcon = L.divIcon({
    html: '<div style="width:30px;height:30px;border-radius:50%;background:#10b981;display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.4);border:2px solid #fff;"><i class="fa-solid fa-graduation-cap" style="font-size:13px;"></i></div>',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    className: ""
});
const housingIcon = L.divIcon({
    html: '<div style="width:32px;height:32px;border-radius:50% 50% 50% 0;background:#ef4444;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.4);border:2px solid #fff;"><i class="fa-solid fa-house" style="font-size:12px;color:#fff;transform:rotate(45deg);"></i></div>',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    className: ""
});

function setActivePinType(type) {
    activePinType = type;
    const housingBtn = document.getElementById("pinTypeHousingBtn");
    const uniBtn = document.getElementById("pinTypeUniversityBtn");
    if (type === "housing") {
        housingBtn.className = "flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all bg-rose-500/20 text-rose-400 border-rose-500/40";
        uniBtn.className = "flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all bg-[#0f172a] text-slate-400 border-slate-700";
    } else {
        uniBtn.className = "flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all bg-emerald-500/20 text-emerald-400 border-emerald-500/40";
        housingBtn.className = "flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all bg-[#0f172a] text-slate-400 border-slate-700";
    }
}
window.setActivePinType = setActivePinType;

function initPickerMap() {
    if (locationMap) return;
    locationMap = L.map("locationPickerMap").setView(DEFAULT_MAP_CENTER, 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(locationMap);
    locationMap.on("click", (e) => placePin(activePinType, e.latlng.lat, e.latlng.lng));
}

function placePin(type, lat, lng) {
    if (type === "housing") {
        if (housingMarker) housingMarker.setLatLng([lat, lng]);
        else housingMarker = L.marker([lat, lng], { icon: housingIcon }).addTo(locationMap);
        document.getElementById("housing-lat").value = lat;
        document.getElementById("housing-lng").value = lng;
        document.getElementById("housingCoordPreview").innerText = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    } else {
        if (universityMarker) universityMarker.setLatLng([lat, lng]);
        else universityMarker = L.marker([lat, lng], { icon: universityIcon }).addTo(locationMap);
        document.getElementById("university-lat").value = lat;
        document.getElementById("university-lng").value = lng;
        document.getElementById("universityCoordPreview").innerText = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
    locationMap.setView([lat, lng], Math.max(locationMap.getZoom(), 14));
}

function openLocationPickerModal() {
    const modal = document.getElementById("locationPickerModal");
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    setActivePinType("housing");
    setTimeout(() => {
        initPickerMap();
        locationMap.invalidateSize();
        const hLat = document.getElementById("housing-lat").value;
        const hLng = document.getElementById("housing-lng").value;
        if (hLat && hLng) placePin("housing", Number(hLat), Number(hLng));
        const uLat = document.getElementById("university-lat").value;
        const uLng = document.getElementById("university-lng").value;
        if (uLat && uLng) placePin("university", Number(uLat), Number(uLng));
    }, 80);
}
window.openLocationPickerModal = openLocationPickerModal;

function closeLocationPickerModal() {
    const modal = document.getElementById("locationPickerModal");
    modal.classList.add("hidden");
    modal.classList.remove("flex");
}
window.closeLocationPickerModal = closeLocationPickerModal;

function confirmLocationPicker() {
    if (!document.getElementById("housing-lat").value) {
        showToast("لازم تحدد موقع السكن على الأقل", "error");
        return;
    }
    updateLocationStatusBadge();
    closeLocationPickerModal();
}
window.confirmLocationPicker = confirmLocationPicker;

function updateLocationStatusBadge() {
    const badge = document.getElementById("locationStatusBadge");
    if (!badge) return;
    const hasHousing = document.getElementById("housing-lat").value;
    const hasUniversity = document.getElementById("university-lat").value;
    if (hasHousing && hasUniversity) {
        badge.className = "text-[11px] font-bold text-emerald-400";
        badge.innerHTML = `<i class="fa-solid fa-check-circle"></i> السكن والجامعة محددين`;
    } else if (hasHousing) {
        badge.className = "text-[11px] font-bold text-amber-400";
        badge.innerHTML = `<i class="fa-solid fa-check-circle"></i> موقع السكن محدد فقط`;
    } else {
        badge.className = "text-[11px] font-bold text-rose-400";
        badge.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> لسه محددتش الموقع`;
    }
}

async function searchLocation() {
    const query = document.getElementById("locationSearchInput").value.trim();
    const resultsBox = document.getElementById("locationSearchResults");
    if (!query) return;
    resultsBox.classList.remove("hidden");
    resultsBox.innerHTML = `<div class="p-3 text-xs text-slate-400"><i class="fa-solid fa-spinner fa-spin"></i> جاري البحث...</div>`;
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&accept-language=ar&q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (!data.length) {
            resultsBox.innerHTML = `<div class="p-3 text-xs text-slate-400">مفيش نتائج، جرّب اسم مختلف</div>`;
            return;
        }
        resultsBox.innerHTML = data.map((r, i) => `
            <button type="button" class="search-result-item w-full text-right px-3 py-2.5 text-xs text-slate-300 hover:bg-indigo-600/20 border-b border-slate-800 last:border-0" data-lat="${r.lat}" data-lng="${r.lon}">
                <i class="fa-solid fa-location-dot text-indigo-400"></i> ${r.display_name}
            </button>
        `).join('');
        resultsBox.querySelectorAll(".search-result-item").forEach(btn => {
            btn.addEventListener("click", () => {
                const lat = Number(btn.dataset.lat), lng = Number(btn.dataset.lng);
                placePin(activePinType, lat, lng);
                resultsBox.classList.add("hidden");
            });
        });
    } catch (err) {
        resultsBox.innerHTML = `<div class="p-3 text-xs text-rose-400">تعذّر البحث، جرّب تاني</div>`;
    }
}
window.searchLocation = searchLocation;

function useMyCurrentLocation() {
    if (!navigator.geolocation) return showToast("المتصفح لا يدعم تحديد الموقع", "error");
    showToast("جاري تحديد موقعك...", "info");
    navigator.geolocation.getCurrentPosition(
        (pos) => placePin(activePinType, pos.coords.latitude, pos.coords.longitude),
        () => showToast("تعذّر الوصول لموقعك، حدد الموقع يدويًا على الخريطة", "error")
    );
}
window.useMyCurrentLocation = useMyCurrentLocation;

function resetLocationMap() {
    ["housing-lat", "housing-lng", "university-lat", "university-lng"].forEach(id => {
        document.getElementById(id).value = "";
    });
    if (housingMarker && locationMap) { locationMap.removeLayer(housingMarker); housingMarker = null; }
    if (universityMarker && locationMap) { locationMap.removeLayer(universityMarker); universityMarker = null; }
    document.getElementById("housingCoordPreview").innerText = "غير محدد";
    document.getElementById("universityCoordPreview").innerText = "غير محدد (اختياري)";
    updateLocationStatusBadge();
}

// ========== حساب الأسرّة تلقائياً ==========
function calcTotalBeds() {
    const rooms = Number(document.getElementById("roomsCount")?.value) || 0;
    const bedsPerRoom = Number(document.getElementById("bedsPerRoom")?.value) || 0;
    const occupied = Number(document.getElementById("occupiedBeds")?.value) || 0;
    
    const total = rooms * bedsPerRoom;
    const available = Math.max(0, total - occupied);

    const totalEl = document.getElementById("totalBedsPreview");
    const occEl = document.getElementById("occupiedBedsPreview");
    const availEl = document.getElementById("availableBedsPreview");
    
    if (totalEl) totalEl.innerText = total;
    if (occEl) occEl.innerText = occupied;
    if (availEl) availEl.innerText = available;
}
window.calcTotalBeds = calcTotalBeds;

// ========== رفع الصور للسكن ==========
async function compressImageToBase64(file, maxW = 800, maxH = 800, quality = 0.7) {
    return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith("image/")) {
            reject(new Error("الملف المحدد ليس صورة صالحة."));
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                let w = img.width, h = img.height;

                if (w > h) {
                    if (w > maxW) { h = Math.round((h * maxW) / w); w = maxW; }
                } else {
                    if (h > maxH) { w = Math.round((w * maxH) / h); h = maxH; }
                }

                canvas.width = w;
                canvas.height = h;
                canvas.getContext("2d").drawImage(img, 0, 0, w, h);

                const base64 = canvas.toDataURL("image/jpeg", quality);

                const sizeKB = (base64.length * 3) / 4 / 1024;
                if (sizeKB > 300) {
                    console.warn(` حجم الصورة بعد الضغط: ${sizeKB.toFixed(0)}KB`);
                }

                resolve(base64);
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

const imageInput = document.getElementById("image-input");
const imagePreview = document.getElementById("image-preview");

imageInput?.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files);
    for (let file of files) {
        try {
            const base64 = await compressImageToBase64(file);
            uploadedImagesBase64.push(base64);
            renderImagePreviews();
        } catch (err) {
            showToast("خطأ في ضغط الصورة: " + err.message, "error");
        }
    }
});

function renderImagePreviews() {
    if (!imagePreview) return;
    imagePreview.innerHTML = uploadedImagesBase64.map((src, i) => `
        <div class="relative inline-block">
            <img src="${src}" class="w-20 h-20 md:w-24 md:h-24 object-cover rounded-xl border border-slate-700">
            <button type="button" onclick="removeImage(${i})" class="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-rose-500 text-white border-2 border-[#0a0f1a] flex items-center justify-center text-xs">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
    `).join('');
}

function removeImage(index) {
    uploadedImagesBase64.splice(index, 1);
    renderImagePreviews();
}
window.removeImage = removeImage;

// ========== رفع صورة السجل ==========
const ledgerImageInput = document.getElementById("ledger-image-input");
const ledgerImagePreview = document.getElementById("ledger-image-preview");

ledgerImageInput?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
        ledgerImageBase64 = await compressImageToBase64(file);
        ledgerImagePreview.innerHTML = `
            <div class="relative inline-block">
                <img src="${ledgerImageBase64}" class="w-20 h-20 object-cover rounded-xl border border-slate-700">
                <button type="button" onclick="removeLedgerImage()" class="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-rose-500 text-white border-2 border-[#0a0f1a] flex items-center justify-center text-xs">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>`;
    } catch (err) {
        showToast("خطأ في رفع الصورة", "error");
    }
});

function removeLedgerImage() {
    ledgerImageBase64 = "";
    if (ledgerImagePreview) ledgerImagePreview.innerHTML = "";
    if (ledgerImageInput) ledgerImageInput.value = "";
}
window.removeLedgerImage = removeLedgerImage;

// ========== نموذج إضافة السكن ==========
const housingForm = document.getElementById("housing-form");
housingForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("housing-id").value;
    const selectedAmenities = Array.from(document.querySelectorAll(".amenities-check:checked")).map(c => c.value);
    const roomsCount = Number(document.getElementById("roomsCount").value) || 1;
    const bedsPerRoom = Number(document.getElementById("bedsPerRoom").value) || 1;
    const occupiedBeds = Number(document.getElementById("occupiedBeds").value) || 0;
    const totalBeds = roomsCount * bedsPerRoom;

    if (occupiedBeds > totalBeds) {
        showToast("عدد الأسرّة المشغولة أكبر من الإجمالي!", "error");
        return;
    }

    let existingBedsMap = {};
    if (id) {
        const existingBedsSnap = await get(ref(db, `housings/${id}/beds`));
        if (existingBedsSnap.exists()) {
            (existingBedsSnap.val() || []).forEach(bed => {
                existingBedsMap[bed.id] = bed.status;
            });
        }
    }

    const beds = [];
    let bedIndex = 0;
    for (let r = 1; r <= roomsCount; r++) {
        for (let b = 1; b <= bedsPerRoom; b++) {
            const bedId = `r${r}-b${b}`;
            const status = existingBedsMap.hasOwnProperty(bedId)
                ? existingBedsMap[bedId]
                : (bedIndex < occupiedBeds ? "occupied" : "available");
            beds.push({
                id: bedId,
                room: `غرفة ${r}`,
                status
            });
            bedIndex++;
        }
    }

    const lat = document.getElementById("housing-lat").value;
    const lng = document.getElementById("housing-lng").value;
    if (!lat || !lng) {
        showToast("حدد موقع السكن على الخريطة قبل الحفظ", "error");
        return;
    }
    const uniLat = document.getElementById("university-lat").value;
    const uniLng = document.getElementById("university-lng").value;

    const data = {
        title: document.getElementById("title").value,
        city: document.getElementById("city").value,
        address: document.getElementById("address").value,
        lat: Number(lat),
        lng: Number(lng),
        universityLat: uniLat ? Number(uniLat) : null,
        universityLng: uniLng ? Number(uniLng) : null,
        type: document.getElementById("type").value,
        gender: document.getElementById("gender").value,
        section: document.getElementById("section").value,
        price: Number(document.getElementById("price").value),
        deposit: Number(document.getElementById("deposit").value),
        phone: document.getElementById("phone").value,
        description: document.getElementById("description").value,
        amenities: selectedAmenities,
        images: uploadedImagesBase64.length > 0 ? uploadedImagesBase64 : ["https://via.placeholder.com/600x400?text=No+Image"],
        roomsCount,
        bedsPerRoom,
        occupiedBeds,
        totalBeds,
        beds,
        updatedAt: Date.now()
    };

    if (id) {
        await update(ref(db, `housings/${id}`), data);
        showToast("تم تعديل السكن بنجاح", "success");
    } else {
        data.createdAt = Date.now();
        const newRef = push(ref(db, "housings"));
        await set(newRef, data);
        showToast("تمت إضافة السكن بنجاح", "success");
    }

    resetForm();
    document.querySelector('[data-tab="manage-housing"]').click();
});

function resetForm() {
    housingForm?.reset();
    document.getElementById("housing-id").value = "";
    uploadedImagesBase64 = [];
    if (imagePreview) imagePreview.innerHTML = "";
    const formTitle = document.getElementById("form-title");
    if (formTitle) formTitle.innerText = "إضافة وحدة سكنية جديدة";
    document.getElementById("cancel-edit-btn")?.classList.add("hidden");
    calcTotalBeds();
    resetLocationMap();
}

document.getElementById("cancel-edit-btn")?.addEventListener("click", resetForm);

// ========== الأقسام في القائمة المنسدلة ==========
onValue(ref(db, "sections"), (snapshot) => {
    const data = snapshot.val();
    allSections = data ? Object.entries(data).map(([id, val]) => ({ id, ...val })) : [];
    const select = document.getElementById("section");
    if (select) {
        select.innerHTML = '<option value="">بدون قسم</option>' + 
            allSections.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    }
});

// ========== عرض السكنات ==========
onValue(ref(db, "housings"), (snapshot) => {
    const tbody = document.getElementById("housing-table-body");
    if (!tbody) return;
    tbody.innerHTML = "";
    const data = snapshot.val();
    allHousings = data ? Object.entries(data).map(([id, val]) => ({ id, ...val })) : [];
    let count = 0, totalBeds = 0;

    if (data) {
        Object.keys(data).forEach(key => {
            count++;
            const item = data[key];
            const beds = item.beds || [];
            const availableBeds = beds.filter(b => b.status === "available").length;
            totalBeds += beds.length;

            const tr = document.createElement("tr");
            tr.className = "border-b border-slate-800 hover:bg-slate-800/50 transition-all";
            tr.innerHTML = `
                <td class="p-3 md:p-4"><img src="${item.images?.[0] || ''}" class="w-10 h-10 md:w-12 md:h-12 rounded-lg object-cover"></td>
                <td class="p-3 md:p-4"><strong class="text-white text-xs md:text-sm">${item.title}</strong></td>
                <td class="p-3 md:p-4 text-slate-400 text-xs">${item.city}</td>
                <td class="p-3 md:p-4 text-slate-400 text-xs">${item.type}</td>
                <td class="p-3 md:p-4 text-amber-400 font-bold text-xs">${item.price} ج.م</td>
                <td class="p-3 md:p-4">
                    <span class="${availableBeds > 0 ? 'text-emerald-400' : 'text-rose-400'} text-xs font-bold">
                        ${availableBeds}/${beds.length}
                    </span>
                </td>
                <td class="p-3 md:p-4 whitespace-nowrap">
                    <button class="btn-edit bg-amber-500 text-black font-bold px-2.5 py-1.5 rounded-lg text-xs mr-1" data-id="${key}">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn-delete bg-rose-600 text-white font-bold px-2.5 py-1.5 rounded-lg text-xs" data-id="${key}">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>`;
            tbody.appendChild(tr);
        });
    }
    document.getElementById("stat-total-housing").innerText = count;
    document.getElementById("stat-total-beds").innerText = totalBeds;

    document.querySelectorAll(".btn-delete").forEach(btn => {
        btn.addEventListener("click", () => {
            customConfirm("هل أنت متأكد من حذف هذا السكن؟", async () => {
                await remove(ref(db, `housings/${btn.dataset.id}`));
                showToast("تم حذف السكن", "info");
            });
        });
    });

    document.querySelectorAll(".btn-edit").forEach(btn => {
        btn.addEventListener("click", () => {
            const item = data[btn.dataset.id];
            document.getElementById("housing-id").value = btn.dataset.id;
            ["title","city","address","type","gender","section","price","deposit","phone","description","roomsCount","bedsPerRoom"].forEach(f => {
                const el = document.getElementById(f);
                if (el) el.value = item[f] || "";
            });
            document.getElementById("occupiedBeds").value = item.occupiedBeds || 0;

            const savedAmenities = item.amenities || [];
            document.querySelectorAll(".amenities-check").forEach(chk => {
                chk.checked = savedAmenities.includes(chk.value);
            });

            uploadedImagesBase64 = item.images || [];
            renderImagePreviews();
            calcTotalBeds();

            document.getElementById("housing-lat").value = item.lat || "";
            document.getElementById("housing-lng").value = item.lng || "";
            document.getElementById("university-lat").value = item.universityLat || "";
            document.getElementById("university-lng").value = item.universityLng || "";
            updateLocationStatusBadge();

            document.getElementById("form-title").innerText = "تعديل بيانات السكن";
            document.getElementById("cancel-edit-btn").classList.remove("hidden");
            document.querySelector('[data-tab="add-housing"]').click();
        });
    });
});

// ========== عرض الحجوزات ==========
onValue(ref(db, "bookings"), (snapshot) => {
    const tbody = document.getElementById("bookings-table-body");
    if (!tbody) return;
    tbody.innerHTML = "";
    const data = snapshot.val();
    let pendingCount = 0, approvedCount = 0;

    if (data) {
        Object.entries(data).reverse().forEach(([key, b]) => {
            if (b.status === "pending") pendingCount++;
            if (b.status === "approved") approvedCount++;

            const statusBadge = b.status === "approved"
                ? `<span class="bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full text-xs font-bold">مقبول</span>`
                : b.status === "rejected"
                ? `<span class="bg-rose-500/20 text-rose-400 px-2 py-1 rounded-full text-xs font-bold">مرفوض</span>`
                : `<span class="bg-amber-500/20 text-amber-400 px-2 py-1 rounded-full text-xs font-bold">قيد الانتظار</span>`;

            const tr = document.createElement("tr");
            tr.className = "border-b border-slate-800 hover:bg-slate-800/50 transition-all";
            tr.innerHTML = `
                <td class="p-3 md:p-4 text-white font-bold text-xs">${b.userName || '—'}</td>
                <td class="p-3 md:p-4">
                    <a href="https://wa.me/2${b.userPhone}" target="_blank" class="text-emerald-400 hover:underline text-xs">
                        <i class="fa-brands fa-whatsapp"></i> ${b.userPhone || '—'}
                    </a>
                </td>
                <td class="p-3 md:p-4 text-slate-400 text-xs">${b.userGovernorate || '—'}</td>
                <td class="p-3 md:p-4 text-slate-300 text-xs">${b.housingTitle || '—'}<br><small class="text-slate-500">${b.bedLabel || ''}</small></td>
                <td class="p-3 md:p-4 text-slate-400 text-xs">من: ${b.checkInDate || '—'}<br>إلى: ${b.checkOutDate || '—'}</td>
                <td class="p-3 md:p-4">${statusBadge}</td>
                <td class="p-3 md:p-4 whitespace-nowrap">
                    <button class="btn-approve bg-emerald-600 text-white font-bold px-2.5 py-1.5 rounded-lg text-xs mr-1" data-id="${key}">
                        <i class="fa-solid fa-check"></i>
                    </button>
                    <button class="btn-reject bg-slate-600 text-white font-bold px-2.5 py-1.5 rounded-lg text-xs mr-1" data-id="${key}">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                    <button class="btn-delete bg-rose-600 text-white font-bold px-2.5 py-1.5 rounded-lg text-xs" data-id="${key}">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>`;
            tbody.appendChild(tr);
        });
    }

    document.getElementById("stat-pending-bookings").innerText = pendingCount;
    document.getElementById("stat-approved-bookings").innerText = approvedCount;

    document.querySelectorAll("#bookings-table-body .btn-approve").forEach(b => {
        b.addEventListener("click", async () => {
            const bookingSnap = await get(ref(db, `bookings/${b.dataset.id}`));
            const booking = bookingSnap.val();
            await update(ref(db, `bookings/${b.dataset.id}`), { status: "approved" });
            if (booking?.housingId && booking?.bedId) {
                const housingSnap = await get(ref(db, `housings/${booking.housingId}/beds`));
                if (housingSnap.exists()) {
                    const beds = housingSnap.val();
                    const updated = beds.map(bed => bed.id === booking.bedId ? { ...bed, status: "occupied" } : bed);
                    await update(ref(db, `housings/${booking.housingId}`), { beds: updated });
                }
            }
            showToast("تم قبول الحجز", "success");
        });
    });
    document.querySelectorAll("#bookings-table-body .btn-reject").forEach(b => {
        b.addEventListener("click", async () => {
            await update(ref(db, `bookings/${b.dataset.id}`), { status: "rejected" });
            showToast("تم رفض الحجز", "info");
        });
    });
    document.querySelectorAll("#bookings-table-body .btn-delete").forEach(b => {
        b.addEventListener("click", () => {
            customConfirm("حذف هذا الحجز؟", async () => {
                await remove(ref(db, `bookings/${b.dataset.id}`));
                showToast("تم حذف الحجز", "info");
            });
        });
    });
});

// ========== إدارة الأقسام ==========
async function addSection() {
    const name = document.getElementById("section-name").value.trim();
    const icon = document.getElementById("section-icon").value.trim() || "fa-building";
    if (!name) return showToast("أدخل اسم القسم", "error");
    const newRef = push(ref(db, "sections"));
    await set(newRef, { name, icon, createdAt: Date.now() });
    document.getElementById("section-name").value = "";
    showToast("تمت إضافة القسم بنجاح", "success");
}
window.addSection = addSection;

onValue(ref(db, "sections"), (snapshot) => {
    const tbody = document.getElementById("sections-table-body");
    if (!tbody) return;
    tbody.innerHTML = "";
    const data = snapshot.val();
    if (data) {
        Object.entries(data).forEach(([key, section]) => {
            const count = allHousings.filter(h => h.section === key).length;
            const tr = document.createElement("tr");
            tr.className = "border-b border-slate-800 hover:bg-slate-800/50 transition-all";
            tr.innerHTML = `
                <td class="p-3 md:p-4 text-white font-bold text-xs">${section.name}</td>
                <td class="p-3 md:p-4 text-slate-400 text-xs"><i class="fa-solid ${section.icon}"></i> ${section.icon}</td>
                <td class="p-3 md:p-4 text-slate-400 text-xs">${count} وحدة</td>
                <td class="p-3 md:p-4">
                    <button class="btn-delete bg-rose-600 text-white font-bold px-2.5 py-1.5 rounded-lg text-xs" data-id="${key}">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>`;
            tbody.appendChild(tr);
        });
    }
    document.querySelectorAll("#sections-table-body .btn-delete").forEach(b => {
        b.addEventListener("click", () => {
            customConfirm("حذف هذا القسم؟", async () => {
                await remove(ref(db, `sections/${b.dataset.id}`));
                showToast("تم حذف القسم", "info");
            });
        });
    });
});

// ========== سجل الملاك (يدوي) ==========
function openLedgerFormModal() {
    const modal = document.getElementById("ledgerFormModal");
    modal.classList.remove("hidden");
    modal.classList.add("flex");
}
window.openLedgerFormModal = openLedgerFormModal;

function closeLedgerFormModal() {
    const modal = document.getElementById("ledgerFormModal");
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    resetLedgerForm();
}
window.closeLedgerFormModal = closeLedgerFormModal;

function resetLedgerForm() {
    ["ledger-owner-name","ledger-owner-phone","ledger-property-address","ledger-notes"].forEach(id => {
        document.getElementById(id).value = "";
    });
    removeLedgerImage();
}

async function addLedgerEntry() {
    const ownerName = document.getElementById("ledger-owner-name").value.trim();
    const ownerPhone = document.getElementById("ledger-owner-phone").value.trim();
    const propertyAddress = document.getElementById("ledger-property-address").value.trim();
    const notes = document.getElementById("ledger-notes").value.trim();

    if (!ownerName || !ownerPhone || !propertyAddress) {
        return showToast("أكمل اسم المالك ورقمه والعنوان", "error");
    }

    const data = {
        ownerName,
        ownerPhone,
        propertyAddress,
        notes,
        image: ledgerImageBase64 || "",
        createdAt: Date.now()
    };

    try {
        const newRef = push(ref(db, "owner_ledger"));
        await set(newRef, data);
        showToast("تم الحفظ في السجل بنجاح", "success");
        closeLedgerFormModal();
    } catch (err) {
        showToast("فشل الحفظ: " + err.message, "error");
    }
}
window.addLedgerEntry = addLedgerEntry;

onValue(ref(db, "owner_ledger"), (snapshot) => {
    const container = document.getElementById("ownerLedgerContainer");
    if (!container) return;
    const data = snapshot.val();
    allLedgerEntries = data ? Object.entries(data).map(([id, val]) => ({ id, ...val })) : [];

    const sorted = [...allLedgerEntries].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    if (sorted.length === 0) {
        container.innerHTML = `<div class="text-center py-12 text-slate-500 col-span-full">
            <i class="fa-solid fa-address-book text-5xl mb-4 opacity-30"></i>
            <p>لا توجد سجلات بعد، أضف أول سجل من الأعلى</p>
        </div>`;
        return;
    }

    container.innerHTML = sorted.map(item => {
        return `
        <div class="glass rounded-2xl p-4 cursor-pointer hover:border-indigo-500/50 transition-all" 
             onclick="openLedgerDetail('${item.id}')">
            <div class="flex items-start justify-between mb-3">
                <div class="w-11 h-11 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 overflow-hidden">
                    ${item.image 
                        ? `<img src="${item.image}" class="w-full h-full object-cover">` 
                        : `<i class="fa-solid fa-building"></i>`}
                </div>
            </div>
            <h3 class="text-sm font-bold text-white mb-1 truncate">${item.propertyAddress}</h3>
            <p class="text-xs text-slate-400 truncate">
                <i class="fa-solid fa-user text-indigo-400"></i> ${item.ownerName}
            </p>
            <button onclick="event.stopPropagation(); deleteLedgerEntry('${item.id}')" 
                    class="mt-3 w-full text-center bg-rose-600/20 hover:bg-rose-600/40 text-rose-400 text-xs font-bold py-2 rounded-lg transition-all">
                <i class="fa-solid fa-trash"></i> حذف
            </button>
        </div>`;
    }).join('');
});

function openLedgerDetail(id) {
    const item = allLedgerEntries.find(e => e.id === id);
    if (!item) return;

    const modal = document.getElementById("ownerDetailModal");
    document.getElementById("ownerModalTitle").innerText = item.ownerName;
    document.getElementById("ownerModalContent").innerHTML = `
        <div class="space-y-4">
            ${item.image ? `<img src="${item.image}" class="w-full h-44 object-cover rounded-xl">` : ''}
            <div class="bg-[#0f172a] rounded-xl p-4 space-y-3">
                <div class="flex justify-between text-sm">
                    <span class="text-slate-400">اسم المالك:</span>
                    <strong class="text-white">${item.ownerName}</strong>
                </div>
                <div class="flex justify-between text-sm">
                    <span class="text-slate-400">رقم الهاتف:</span>
                    <a href="tel:${item.ownerPhone}" class="text-indigo-400 font-bold">${item.ownerPhone}</a>
                </div>
                <div class="flex justify-between text-sm">
                    <span class="text-slate-400">العنوان:</span>
                    <strong class="text-white text-left">${item.propertyAddress}</strong>
                </div>
            </div>
            ${item.notes ? `<div class="bg-[#0f172a] rounded-xl p-4 text-sm text-slate-300">
                <i class="fa-solid fa-note-sticky text-amber-400"></i> ${item.notes}
            </div>` : ''}
            <a href="https://wa.me/2${item.ownerPhone}" target="_blank" 
               class="block w-full text-center bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all">
                <i class="fa-brands fa-whatsapp"></i> تواصل مع المالك
            </a>
        </div>`;
    modal.classList.remove("hidden");
    modal.classList.add("flex");
}

function closeOwnerModal() {
    document.getElementById("ownerDetailModal").classList.add("hidden");
    document.getElementById("ownerDetailModal").classList.remove("flex");
}
window.closeOwnerModal = closeOwnerModal;

function deleteLedgerEntry(id) {
    customConfirm("هل أنت متأكد من حذف هذا السجل؟", async () => {
        await remove(ref(db, `owner_ledger/${id}`));
        showToast("تم الحذف من السجل", "info");
    });
}
window.deleteLedgerEntry = deleteLedgerEntry;
window.openLedgerDetail = openLedgerDetail;
