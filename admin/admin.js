// admin/admin.js
import { db, ref, push, set, onValue, remove, update } from "../firebase-config.js";

let uploadedImagesBase64 = [];

// Navigation
document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById(btn.dataset.tab).classList.add("active");
    });
});

// Image converter (fallback لو الملف مش موجود)
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

// Image Upload
const imageInput = document.getElementById("image-input");
const imagePreview = document.getElementById("image-preview");

imageInput.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files);
    for (let file of files) {
        try {
            const base64 = await compressImageToBase64(file);
            uploadedImagesBase64.push(base64);
            const img = document.createElement("img");
            img.src = base64;
            imagePreview.appendChild(img);
        } catch (err) {
            alert("خطأ في ضغط الصورة: " + err.message);
        }
    }
});

// Housing Submit
const housingForm = document.getElementById("housing-form");
housingForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("housing-id").value;
    const selectedAmenities = Array.from(document.querySelectorAll(".amenities-check:checked")).map(c => c.value);

    const data = {
        title: document.getElementById("title").value,
        city: document.getElementById("city").value,
        address: document.getElementById("address").value,
        type: document.getElementById("type").value,
        gender: document.getElementById("gender").value,
        price: Number(document.getElementById("price").value),
        deposit: Number(document.getElementById("deposit").value),
        phone: document.getElementById("phone").value,
        description: document.getElementById("description").value,
        amenities: selectedAmenities,
        images: uploadedImagesBase64.length > 0 ? uploadedImagesBase64 : ["https://via.placeholder.com/600x400?text=No+Image"],
        updatedAt: Date.now()
    };

    if (id) {
        await update(ref(db, `housings/${id}`), data);
        alert("✅ تم تعديل السكن بنجاح!");
    } else {
        data.createdAt = Date.now();
        data.beds = [
            { id: "b1", room: "غرفة 1", status: "available" },
            { id: "b2", room: "غرفة 1", status: "available" },
            { id: "b3", room: "غرفة 2", status: "available" },
            { id: "b4", room: "غرفة 2", status: "available" }
        ];
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

// Load Housings
onValue(ref(db, "housings"), (snapshot) => {
    const tbody = document.getElementById("housing-table-body");
    tbody.innerHTML = "";
    const data = snapshot.val();
    let count = 0;

    if (data) {
        Object.keys(data).forEach(key => {
            count++;
            const item = data[key];
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><img src="${item.images?.[0] || ''}" class="thumb-img"></td>
                <td><strong>${item.title}</strong></td>
                <td>${item.city}</td>
                <td>${item.type}</td>
                <td>${item.price} ج.م</td>
                <td>
                    <button class="btn-action btn-edit" data-id="${key}"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-action btn-delete" data-id="${key}"><i class="fa-solid fa-trash"></i></button>
                </td>`;
            tbody.appendChild(tr);
        });
    }
    document.getElementById("stat-total-housing").innerText = count;

    document.querySelectorAll(".btn-delete").forEach(btn => {
        btn.addEventListener("click", async () => {
            if (confirm("تأكيد الحذف؟")) await remove(ref(db, `housings/${btn.dataset.id}`));
        });
    });

    document.querySelectorAll(".btn-edit").forEach(btn => {
        btn.addEventListener("click", () => {
            const item = data[btn.dataset.id];
            document.getElementById("housing-id").value = btn.dataset.id;
            ["title","city","address","type","gender","price","deposit","phone","description"].forEach(f => {
                const el = document.getElementById(f);
                if (el) el.value = item[f] || "";
            });
            uploadedImagesBase64 = item.images || [];
            imagePreview.innerHTML = "";
            uploadedImagesBase64.forEach(src => {
                const img = document.createElement("img");
                img.src = src;
                imagePreview.appendChild(img);
            });
            document.getElementById("form-title").innerText = "تعديل بيانات السكن";
            document.getElementById("cancel-edit-btn").classList.remove("hidden");
            document.querySelector('[data-tab="add-housing"]').click();
        });
    });
});

// Load Bookings
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
        b.addEventListener("click", () => update(ref(db, `bookings/${b.dataset.id}`), { status: "approved" }));
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
