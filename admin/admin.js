import { db, ref, push, set, onValue, remove, update, get } from "../firebase-config.js";

let uploadedImagesBase64 = [];
let ledgerImageBase64 = "";
let allSections = [];
let allHousings = [];
let allLedgerEntries = [];

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
async function compressImageToBase64(file, maxW = 1000, quality = 0.75) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                let w = img.width, h = img.height;
                if (w > maxW) { h = (maxW / w) * h; w = maxW; }
                canvas.width = w; canvas.height = h;
                canvas.getContext("2d").drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL("image/jpeg", quality));
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

    // توليد الأسرّة
    const beds = [];
    let bedIndex = 0;
    for (let r = 1; r <= roomsCount; r++) {
        for (let b = 1; b <= bedsPerRoom; b++) {
            beds.push({
                id: `r${r}-b${b}`,
                room: `غرفة ${r}`,
                status: bedIndex < occupiedBeds ? "occupied" : "available"
            });
            bedIndex++;
        }
    }

    const data = {
        title: document.getElementById("title").value,
        city: document.getElementById("city").value,
        address: document.getElementById("address").value,
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
            uploadedImagesBase64 = item.images || [];
            renderImagePreviews();
            calcTotalBeds();
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
async function addLedgerEntry() {
    const ownerName = document.getElementById("ledger-owner-name").value.trim();
    const ownerPhone = document.getElementById("ledger-owner-phone").value.trim();
    const propertyAddress = document.getElementById("ledger-property-address").value.trim();
    const rooms = Number(document.getElementById("ledger-rooms").value) || 1;
    const bedsPerRoom = Number(document.getElementById("ledger-beds-per-room").value) || 1;
    const occupied = Number(document.getElementById("ledger-occupied").value) || 0;
    const status = document.getElementById("ledger-status").value;
    const notes = document.getElementById("ledger-notes").value.trim();

    if (!ownerName || !ownerPhone || !propertyAddress) {
        return showToast("أكمل اسم المالك ورقمه والعنوان", "error");
    }

    const total = rooms * bedsPerRoom;
    if (occupied > total) {
        return showToast("عدد الأسرّة المشغولة أكبر من الإجمالي!", "error");
    }

    const data = {
        ownerName,
        ownerPhone,
        propertyAddress,
        rooms,
        bedsPerRoom,
        totalBeds: total,
        occupiedBeds: occupied,
        availableBeds: total - occupied,
        status,
        notes,
        image: ledgerImageBase64 || "",
        createdAt: Date.now()
    };

    try {
        const newRef = push(ref(db, "owner_ledger"));
        await set(newRef, data);
        showToast("تم الحفظ في السجل بنجاح", "success");
        
        // إعادة تعيين
        ["ledger-owner-name","ledger-owner-phone","ledger-property-address","ledger-notes"].forEach(id => {
            document.getElementById(id).value = "";
        });
        document.getElementById("ledger-rooms").value = 1;
        document.getElementById("ledger-beds-per-room").value = 1;
        document.getElementById("ledger-occupied").value = 0;
        removeLedgerImage();
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

    // ترتيب: المتاح حديثاً في الأعلى، المكتمل في الأسفل
    const sorted = [...allLedgerEntries].sort((a, b) => {
        const statusOrder = { available: 0, partial: 1, full: 2 };
        const aOrder = statusOrder[a.status] ?? 1;
        const bOrder = statusOrder[b.status] ?? 1;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return (b.createdAt || 0) - (a.createdAt || 0);
    });

    if (sorted.length === 0) {
        container.innerHTML = `<div class="text-center py-12 text-slate-500 col-span-full">
            <i class="fa-solid fa-address-book text-5xl mb-4 opacity-30"></i>
            <p>لا توجد سجلات بعد، أضف أول سجل من الأعلى</p>
        </div>`;
        return;
    }

    container.innerHTML = sorted.map(item => {
        const statusInfo = item.status === "full"
            ? { text: "مكتمل", color: "bg-rose-500/20 text-rose-400" }
            : item.status === "partial"
            ? { text: `متاح ${item.availableBeds || 0}`, color: "bg-amber-500/20 text-amber-400" }
            : { text: `متاح ${item.availableBeds || 0}`, color: "bg-emerald-500/20 text-emerald-400" };

        return `
        <div class="glass rounded-2xl p-4 cursor-pointer hover:border-indigo-500/50 transition-all ${item.status === 'full' ? 'opacity-60' : ''}" 
             onclick="openLedgerDetail('${item.id}')">
            <div class="flex items-start justify-between mb-3">
                <div class="w-11 h-11 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 overflow-hidden">
                    ${item.image 
                        ? `<img src="${item.image}" class="w-full h-full object-cover">` 
                        : `<i class="fa-solid fa-building"></i>`}
                </div>
                <span class="text-xs font-bold px-2.5 py-1 rounded-full ${statusInfo.color}">
                    ${statusInfo.text}
                </span>
            </div>
            <h3 class="text-sm font-bold text-white mb-1 truncate">${item.propertyAddress}</h3>
            <p class="text-xs text-slate-400 truncate">
                <i class="fa-solid fa-user text-indigo-400"></i> ${item.ownerName}
            </p>
            <p class="text-xs text-slate-500 mt-1">
                <i class="fa-solid fa-bed"></i> ${item.availableBeds} من أصل ${item.totalBeds} سرير
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
                <div class="flex justify-between text-sm">
                    <span class="text-slate-400">عدد الغرف:</span>
                    <strong class="text-white">${item.rooms}</strong>
                </div>
                <div class="flex justify-between text-sm">
                    <span class="text-slate-400">أسرّة لكل غرفة:</span>
                    <strong class="text-white">${item.bedsPerRoom}</strong>
                </div>
            </div>
            <div class="bg-[#0f172a] rounded-xl p-4">
                <h4 class="text-sm font-bold text-slate-300 mb-3">
                    <i class="fa-solid fa-bed text-indigo-400"></i> حالة الأسرّة
                </h4>
                <div class="grid grid-cols-3 gap-3 text-center">
                    <div class="bg-emerald-500/10 rounded-lg p-3">
                        <p class="text-xl font-extrabold text-emerald-400">${item.availableBeds}</p>
                        <p class="text-xs text-slate-400">متاح</p>
                    </div>
                    <div class="bg-rose-500/10 rounded-lg p-3">
                        <p class="text-xl font-extrabold text-rose-400">${item.occupiedBeds}</p>
                        <p class="text-xs text-slate-400">مشغول</p>
                    </div>
                    <div class="bg-slate-500/10 rounded-lg p-3">
                        <p class="text-xl font-extrabold text-slate-300">${item.totalBeds}</p>
                        <p class="text-xs text-slate-400">الإجمالي</p>
                    </div>
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
