// admin/admin.js
import { db, ref, push, set, onValue, remove, update, get } from "../firebase-config.js";

let uploadedImagesBase64 = [];
let allSections = [];
let allHousings = [];

// ========== Navigation ==========
document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById(btn.dataset.tab).classList.add("active");
    });
});

// ========== Image Converter ==========
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

// ========== Image Upload ==========
const imageInput = document.getElementById("image-input");
const imagePreview = document.getElementById("image-preview");

imageInput.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files);
    for (let file of files) {
        try {
            const base64 = await compressImageToBase64(file);
            uploadedImagesBase64.push(base64);
            renderImagePreviews();
        } catch (err) {
            alert("خطأ في ضغط الصورة: " + err.message);
        }
    }
});

function renderImagePreviews() {
    imagePreview.innerHTML = uploadedImagesBase64.map((src, i) => `
        <div style="position:relative; display:inline-block;">
            <img src="${src}" style="width:90px; height:90px; object-fit:cover; border-radius:8px; border:1px solid var(--border);">
            <button type="button" onclick="removeImage(${i})" 
                    style="position:absolute; top:-6px; right:-6px; width:22px; height:22px; border-radius:50%; background:var(--red); color:#fff; border:none; cursor:pointer; font-size:12px; display:flex; align-items:center; justify-content:center;">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
    `).join('');
}

function removeImage(index) {
    uploadedImagesBase64.splice(index, 1);
    renderImagePreviews();
}

// ========== Housing Submit ==========
const housingForm = document.getElementById("housing-form");
housingForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("housing-id").value;
    const selectedAmenities = Array.from(document.querySelectorAll(".amenities-check:checked")).map(c => c.value);
    const roomsCount = Number(document.getElementById("roomsCount").value) || 1;
    const bedsPerRoom = Number(document.getElementById("bedsPerRoom").value) || 1;

    // توليد الأسرّة تلقائياً
    const beds = [];
    for (let r = 1; r <= roomsCount; r++) {
        for (let b = 1; b <= bedsPerRoom; b++) {
            beds.push({
                id: `r${r}-b${b}`,
                room: `غرفة ${r}`,
                status: "available"
            });
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
        ownerName: document.getElementById("ownerName").value,
        description: document.getElementById("description").value,
        amenities: selectedAmenities,
        images: uploadedImagesBase64.length > 0 ? uploadedImagesBase64 : ["https://via.placeholder.com/600x400?text=No+Image"],
        roomsCount,
        bedsPerRoom,
        updatedAt: Date.now()
    };

    if (id) {
        // Edit mode - نحافظ على حالة الأسرّة
        const snap = await get(ref(db, `housings/${id}/beds`));
        if (snap.exists()) {
            const oldBeds = snap.val();
            data.beds = beds.map(newBed => {
                const oldBed = oldBeds.find(b => b.id === newBed.id);
                return oldBed ? { ...newBed, status: oldBed.status } : newBed;
            });
        } else {
            data.beds = beds;
        }
        await update(ref(db, `housings/${id}`), data);
        alert("✅ تم تعديل السكن بنجاح!");
    } else {
        data.createdAt = Date.now();
        data.beds = beds;
        const newRef = push(ref(db, "housings"));
        await set(newRef, data);
        alert("✅ تمت إضافة السكن بنجاح!");
    }

    resetForm();
    document.querySelector('[data-tab="manage-housing"]').click();
});

function resetForm() {
    housingForm.reset();
    document.getElementById("housing-id").value = "";
    uploadedImagesBase64 = [];
    imagePreview.innerHTML = "";
    document.getElementById("form-title").innerText = "إضافة وحدة سكنية جديدة";
    document.getElementById("cancel-edit-btn").classList.add("hidden");
}

document.getElementById("cancel-edit-btn").addEventListener("click", resetForm);

// ========== Load Sections for Select ==========
onValue(ref(db, "sections"), (snapshot) => {
    const data = snapshot.val();
    allSections = data ? Object.entries(data).map(([id, val]) => ({ id, ...val })) : [];
    const select = document.getElementById("section");
    select.innerHTML = '<option value="">بدون قسم</option>' + 
        allSections.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
});

// ========== Load Housings ==========
onValue(ref(db, "housings"), (snapshot) => {
    const tbody = document.getElementById("housing-table-body");
    tbody.innerHTML = "";
    const data = snapshot.val();
    allHousings = data ? Object.entries(data).map(([id, val]) => ({ id, ...val })) : [];
    let count = 0;
    let totalBeds = 0;

    if (data) {
        Object.keys(data).forEach(key => {
            count++;
            const item = data[key];
            const beds = item.beds || [];
            totalBeds += beds.length;
            const availableBeds = beds.filter(b => b.status === "available").length;
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><img src="${item.images?.[0] || ''}" class="thumb-img"></td>
                <td><strong>${item.title}</strong><br><small>${item.ownerName || ''}</small></td>
                <td>${item.city}</td>
                <td>${item.type}</td>
                <td>${item.price} ج.م</td>
                <td>${availableBeds}/${beds.length} متاح</td>
                <td>
                    <button class="btn-action btn-edit" data-id="${key}"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-action btn-delete" data-id="${key}"><i class="fa-solid fa-trash"></i></button>
                </td>`;
            tbody.appendChild(tr);
        });
    }
    document.getElementById("stat-total-housing").innerText = count;
    document.getElementById("stat-total-beds").innerText = totalBeds;

    document.querySelectorAll(".btn-delete").forEach(btn => {
        btn.addEventListener("click", async () => {
            if (confirm("تأكيد الحذف؟")) await remove(ref(db, `housings/${btn.dataset.id}`));
        });
    });

    document.querySelectorAll(".btn-edit").forEach(btn => {
        btn.addEventListener("click", async () => {
            const item = data[btn.dataset.id];
            document.getElementById("housing-id").value = btn.dataset.id;
            ["title","city","address","type","gender","section","price","deposit","phone","ownerName","description","roomsCount","bedsPerRoom"].forEach(f => {
                const el = document.getElementById(f);
                if (el) el.value = item[f] || "";
            });
            uploadedImagesBase64 = item.images || [];
            renderImagePreviews();
            document.getElementById("form-title").innerText = "تعديل بيانات السكن";
            document.getElementById("cancel-edit-btn").classList.remove("hidden");
            document.querySelector('[data-tab="add-housing"]').click();
        });
    });
});

// ========== Load Bookings ==========
onValue(ref(db, "bookings"), (snapshot) => {
    const tbody = document.getElementById("bookings-table-body");
    tbody.innerHTML = "";
    const data = snapshot.val();
    let pendingCount = 0, approvedCount = 0;

    if (data) {
        Object.entries(data).reverse().forEach(([key, b]) => {
            if (b.status === "pending") pendingCount++;
            if (b.status === "approved") approvedCount++;

            const statusBadge = b.status === "approved"
                ? `<span class="badge badge-approved">مقبول</span>`
                : b.status === "rejected"
                ? `<span class="badge badge-rejected">مرفوض</span>`
                : `<span class="badge badge-pending">قيد الانتظار</span>`;

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${b.userName || '—'}</strong></td>
                <td><a href="https://wa.me/2${b.userPhone}" target="_blank" style="color: var(--green); text-decoration:none;">
                    <i class="fa-brands fa-whatsapp"></i> ${b.userPhone || '—'}
                </a></td>
                <td>${b.userGovernorate || '—'}</td>
                <td>${b.housingTitle || '—'}<br><small style="color:var(--text-muted);">${b.bedLabel || ''}</small></td>
                <td><small>من: ${b.checkInDate || '—'}<br>إلى: ${b.checkOutDate || '—'}</small></td>
                <td>${b.notes || 'لا يوجد'}</td>
                <td>${statusBadge}</td>
                <td>
                    <button class="btn-action btn-approve" data-id="${key}" title="قبول"><i class="fa-solid fa-check"></i></button>
                    <button class="btn-action btn-reject" data-id="${key}" title="رفض"><i class="fa-solid fa-xmark"></i></button>
                    <button class="btn-action btn-delete" data-id="${key}" title="حذف"><i class="fa-solid fa-trash"></i></button>
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
            // تحديث حالة السرير
            if (booking?.housingId && booking?.bedId) {
                const housingSnap = await get(ref(db, `housings/${booking.housingId}/beds`));
                if (housingSnap.exists()) {
                    const beds = housingSnap.val();
                    const updated = beds.map(bed => bed.id === booking.bedId ? { ...bed, status: "occupied" } : bed);
                    await update(ref(db, `housings/${booking.housingId}`), { beds: updated });
                }
            }
        });
    });
    document.querySelectorAll("#bookings-table-body .btn-reject").forEach(b => {
        b.addEventListener("click", () => update(ref(db, `bookings/${b.dataset.id}`), { status: "rejected" }));
    });
    document.querySelectorAll("#bookings-table-body .btn-delete").forEach(b => {
        b.addEventListener("click", async () => {
            if (confirm("حذف هذا الحجز؟")) await remove(ref(db, `bookings/${b.dataset.id}`));
        });
    });
});

// ========== Sections ==========
async function addSection() {
    const name = document.getElementById("section-name").value.trim();
    const icon = document.getElementById("section-icon").value.trim() || "fa-building";
    if (!name) return alert("أدخل اسم القسم");
    
    const newRef = push(ref(db, "sections"));
    await set(newRef, { name, icon, createdAt: Date.now() });
    document.getElementById("section-name").value = "";
    alert("✅ تمت إضافة القسم بنجاح!");
}

onValue(ref(db, "sections"), (snapshot) => {
    const tbody = document.getElementById("sections-table-body");
    tbody.innerHTML = "";
    const data = snapshot.val();
    
    if (data) {
        Object.entries(data).forEach(([key, section]) => {
            const count = allHousings.filter(h => h.section === key).length;
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${section.name}</strong></td>
                <td><i class="fa-solid ${section.icon}"></i> ${section.icon}</td>
                <td>${count} وحدة</td>
                <td>
                    <button class="btn-action btn-delete" data-id="${key}"><i class="fa-solid fa-trash"></i></button>
                </td>`;
            tbody.appendChild(tr);
        });
    }

    document.querySelectorAll("#sections-table-body .btn-delete").forEach(b => {
        b.addEventListener("click", async () => {
            if (confirm("حذف هذا القسم؟")) await remove(ref(db, `sections/${b.dataset.id}`));
        });
    });
});

window.removeImage = removeImage;
window.addSection = addSection;
