import { db, ref, push, set, onValue, remove, update } from "../firebase-config.js";
import { compressImageToBase64 } from "../utils/image-converter.js";

let uploadedImagesBase64 = [];

// Navigation System
document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

        btn.classList.add("active");
        document.getElementById(btn.dataset.tab).classList.add("active");
    });
});

// Image Upload Handler
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
            alert("حدث خطأ أثناء ضغط الصورة: " + err.message);
        }
    }
});

// Add / Edit Housing Submit
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
        // Edit Mode
        await update(ref(db, `housings/${id}`), data);
        alert("تم تعديل السكن بنجاح!");
    } else {
        // Add Mode
        data.createdAt = Date.now();
        const newRef = push(ref(db, "housings"));
        await set(newRef, data);
        alert("تمت إضافة السكن بنجاح إلى المنصة!");
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

// Load Housing Realtime Data
onValue(ref(db, "housings"), (snapshot) => {
    const tableBody = document.getElementById("housing-table-body");
    tableBody.innerHTML = "";
    const data = snapshot.val();

    let count = 0;
    if (data) {
        Object.keys(data).forEach(key => {
            count++;
            const item = data[key];
            const tr = document.createElement("tr");

            tr.innerHTML = `
                <td><img src="${item.images[0]}" class="thumb-img"></td>
                <td><strong>${item.title}</strong></td>
                <td>${item.city}</td>
                <td>${item.type}</td>
                <td>${item.price} ج.م</td>
                <td>
                    <button class="btn-action btn-edit" data-id="${key}"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-action btn-delete" data-id="${key}"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    }

    document.getElementById("stat-total-housing").innerText = count;

    // Attach Action Listeners
    document.querySelectorAll(".btn-delete").forEach(btn => {
        btn.addEventListener("click", async () => {
            if (confirm("هل أنت تأكد من حذف هذا السكن؟")) {
                await remove(ref(db, `housings/${btn.dataset.id}`));
            }
        });
    });

    document.querySelectorAll(".btn-edit").forEach(btn => {
        btn.addEventListener("click", () => {
            const item = data[btn.dataset.id];
            document.getElementById("housing-id").value = btn.dataset.id;
            document.getElementById("title").value = item.title;
            document.getElementById("city").value = item.city;
            document.getElementById("address").value = item.address;
            document.getElementById("type").value = item.type;
            document.getElementById("gender").value = item.gender;
            document.getElementById("price").value = item.price;
            document.getElementById("deposit").value = item.deposit;
            document.getElementById("phone").value = item.phone;
            document.getElementById("description").value = item.description;

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

// Load Bookings Data Realtime
onValue(ref(db, "bookings"), (snapshot) => {
    const tableBody = document.getElementById("bookings-table-body");
    tableBody.innerHTML = "";
    const data = snapshot.val();

    let pendingCount = 0;
    let approvedCount = 0;

    if (data) {
        Object.keys(data).forEach(key => {
            const booking = data[key];

            if (booking.status === "pending") pendingCount++;
            if (booking.status === "approved") approvedCount++;

            const statusBadge = booking.status === "approved" 
                ? `<span class="badge badge-approved">مقبول</span>`
                : booking.status === "rejected"
                ? `<span class="badge badge-rejected">مرفوض</span>`
                : `<span class="badge badge-pending">قيد الانتظار</span>`;

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${booking.userName}</strong></td>
                <td><a href="https://wa.me/2${booking.userPhone}" target="_blank" style="color: var(--green); text-decoration:none;"><i class="fa-brands fa-whatsapp"></i> ${booking.userPhone}</a></td>
                <td>${booking.housingTitle}</td>
                <td>${booking.moveInDate}</td>
                <td>${booking.notes || 'لا يوجد'}</td>
                <td>${statusBadge}</td>
                <td>
                    <button class="btn-action btn-approve" data-id="${key}"><i class="fa-solid fa-check"></i></button>
                    <button class="btn-action btn-reject" data-id="${key}"><i class="fa-solid fa-xmark"></i></button>
                    <button class="btn-action btn-delete" data-id="${key}"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    }

    document.getElementById("stat-pending-bookings").innerText = pendingCount;
    document.getElementById("stat-approved-bookings").innerText = approvedCount;

    // Booking actions
    document.querySelectorAll("#bookings-table-body .btn-approve").forEach(b => {
        b.addEventListener("click", () => update(ref(db, `bookings/${b.dataset.id}`), { status: "approved" }));
    });
    document.querySelectorAll("#bookings-table-body .btn-reject").forEach(b => {
        b.addEventListener("click", () => update(ref(db, `bookings/${b.dataset.id}`), { status: "rejected" }));
    });
    document.querySelectorAll("#bookings-table-body .btn-delete").forEach(b => {
        b.addEventListener("click", () => remove(ref(db, `bookings/${b.dataset.id}`)));
    });
});
