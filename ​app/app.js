import { db, ref, onValue, push, set } from "../firebase-config.js";

let allHousings = {};

// Load Housings Data from Firebase
onValue(ref(db, "housings"), (snapshot) => {
    allHousings = snapshot.val() || {};
    renderHousings();
});

// Filters Elements
const filterCity = document.getElementById("filter-city");
const filterType = document.getElementById("filter-type");
const filterGender = document.getElementById("filter-gender");

filterCity.addEventListener("input", renderHousings);
filterType.addEventListener("change", renderHousings);
filterGender.addEventListener("change", renderHousings);

function renderHousings() {
    const grid = document.getElementById("housing-grid");
    const countLabel = document.getElementById("results-count");
    grid.innerHTML = "";

    const cityVal = filterCity.value.trim().toLowerCase();
    const typeVal = filterType.value;
    const genderVal = filterGender.value;

    const keys = Object.keys(allHousings);
    let visibleCount = 0;

    keys.forEach(key => {
        const item = allHousings[key];

        // Filtering logic
        const matchesCity = !cityVal || item.city.toLowerCase().includes(cityVal) || item.address.toLowerCase().includes(cityVal);
        const matchesType = !typeVal || item.type === typeVal;
        const matchesGender = !genderVal || item.gender === genderVal;

        if (matchesCity && matchesType && matchesGender) {
            visibleCount++;

            const card = document.createElement("div");
            card.className = "housing-card";

            card.innerHTML = `
                <img src="${item.images[0]}" class="card-img" alt="${item.title}">
                <div class="card-body">
                    <span class="card-tag">${item.type} - ${item.gender}</span>
                    <h3 class="card-title">${item.title}</h3>
                    <p class="card-location"><i class="fa-solid fa-location-dot"></i> ${item.city}، ${item.address}</p>
                    <div class="card-footer">
                        <div class="card-price">${item.price} <span>ج.م / شهر</span></div>
                        <button class="btn-details" data-id="${key}">التفاصيل والحجز</button>
                    </div>
                </div>
            `;

            grid.appendChild(card);
        }
    });

    countLabel.innerText = `تم العثور على (${visibleCount}) وحدة سكنية`;

    // Attach Click Handler for Details
    document.querySelectorAll(".btn-details").forEach(btn => {
        btn.addEventListener("click", () => openModal(btn.dataset.id));
    });
}

// Modal Logic
const modal = document.getElementById("details-modal");
const closeModalBtn = document.getElementById("close-modal-btn");

closeModalBtn.addEventListener("click", () => modal.classList.remove("active"));
window.addEventListener("click", (e) => { if (e.target === modal) modal.classList.remove("active"); });

function openModal(id) {
    const item = allHousings[id];
    const modalBody = document.getElementById("modal-body");

    const imagesHTML = item.images.map(src => `<img src="${src}" alt="سكن">`).join("");
    const amenitiesHTML = item.amenities ? item.amenities.map(a => `<span class="amenity-chip"><i class="fa-solid fa-circle-check"></i> ${a}</span>`).join("") : "";

    modalBody.innerHTML = `
        <h2>${item.title}</h2>
        <p style="color: #64748b; margin-bottom: 16px;"><i class="fa-solid fa-location-dot"></i> ${item.city} - ${item.address}</p>

        <div class="gallery">${imagesHTML}</div>

        <h3>عن هذا السكن</h3>
        <p style="line-height: 1.7; margin-bottom: 16px;">${item.description}</p>

        <h3>المرافق والتجهيزات</h3>
        <div class="amenities-tags">${amenitiesHTML}</div>

        <div style="margin-top: 16px; font-weight:700;">التأمين المطلوب: ${item.deposit} ج.م</div>

        <form id="modal-booking-form" class="booking-form">
            <h3>طلب حجز السكن</h3>
            <input type="text" id="user-name" placeholder="الاسم بالكامل" required>
            <input type="tel" id="user-phone" placeholder="رقم الموبايل / واتساب" required>
            <label style="font-size:12px; color:#64748b;">تاريخ الانتقال المتوقع:</label>
            <input type="date" id="move-date" required>
            <textarea id="booking-notes" rows="2" placeholder="أي ملاحظات إضافية..."></textarea>
            <button type="submit" class="btn-details" style="width:100%; padding: 14px; font-size:16px;">تأكيد وتنسيق الحجز</button>
        </form>
    `;

    modal.classList.add("active");

    // Handle Booking Form Submit
    document.getElementById("modal-booking-form").addEventListener("submit", async (e) => {
        e.preventDefault();

        const bookingData = {
            housingId: id,
            housingTitle: item.title,
            userName: document.getElementById("user-name").value,
            userPhone: document.getElementById("user-phone").value,
            moveInDate: document.getElementById("move-date").value,
            notes: document.getElementById("booking-notes").value,
            status: "pending",
            createdAt: Date.now()
        };

        const newRef = push(ref(db, "bookings"));
        await set(newRef, bookingData);

        alert("تم إرسال طلب الحجز بنجاح! سيتواصل معك المسؤول قريباً لتأكيد المعاينة.");
        modal.classList.remove("active");
    });
}
