/* ==========================================
   SAKANI-X CORE JS ENGINE & DATA PIPELINE
   ========================================== */

// Sample Luxury Data
const properties = [
  {
    id: "prop-1",
    title: "جناح الروضة الفاخر - أسيوط الجديدة",
    location: "حي رجال الأعمال - بالقرب من الجامعة الوطنية",
    price: 2200,
    gender: "girls",
    isLuxury: true,
    image: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=800&q=80",
    lat: 27.1801,
    lng: 31.1837,
    beds: [
      { id: "b1", room: "غرفة 1", status: "occupied" },
      { id: "b2", room: "غرفة 1", status: "available" },
      { id: "b3", room: "غرفة 2", status: "available" }
    ]
  },
  {
    id: "prop-2",
    title: "سكن الصفوة الطلابي VIP",
    location: "شارع الجامعات - المنيا الجديدة",
    price: 1800,
    gender: "boys",
    isLuxury: true,
    image: "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=800&q=80",
    lat: 28.0871,
    lng: 30.7618,
    beds: [
      { id: "b10", room: "غرفة 1", status: "available" },
      { id: "b11", room: "غرفة 1", status: "available" }
    ]
  }
];

let selectedBedId = null;

// Initial Render
document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("listingsContainer");
  if (container) {
    renderListings(properties);
  }
});

// Render Listings Function
function renderListings(items) {
  const container = document.getElementById("listingsContainer");
  if (!container) return;

  container.innerHTML = items.map(item => `
    <a href="details.html?id=${item.id}" class="housing-card">
      <div class="card-media">
        <img src="${item.image}" alt="${item.title}">
        <div class="card-badges">
          <span class="badge-tag ${item.gender === 'girls' ? 'gender-girls' : 'gender-boys'}">
            <i class="fa-solid ${item.gender === 'girls' ? 'fa-person-dress' : 'fa-person'}"></i>
            ${item.gender === 'girls' ? 'سكن طالبات' : 'سكن طلاب'}
          </span>
          <button class="fav-btn" onclick="event.preventDefault(); this.classList.toggle('active');">
            <i class="fa-solid fa-heart"></i>
          </button>
        </div>
      </div>
      <div class="card-body">
        <div class="card-price">${item.price.toLocaleString()} ج.م <span>/ شهرياً</span></div>
        <h3 class="card-title">${item.title}</h3>
        <div class="card-location">
          <i class="fa-solid fa-location-dot" style="color: var(--accent-gold);"></i>
          <span>${item.location}</span>
        </div>
        <div class="card-features">
          <span><i class="fa-solid fa-wifi"></i> إنترنت سريع</span>
          <span><i class="fa-solid fa-snowflake"></i> مكيف بالكامل</span>
          <span><i class="fa-solid fa-shield-halved"></i> أمن 24 ساعة</span>
        </div>
      </div>
    </a>
  `).join('');
}

// Search Filter Engine
function filterListings() {
  const query = document.getElementById("searchInput").value.toLowerCase();
  const filtered = properties.filter(p => 
    p.title.toLowerCase().includes(query) || p.location.toLowerCase().includes(query)
  );
  renderListings(filtered);
}

// Chip Filters
function setFilter(type, btnElement) {
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  btnElement.classList.add('active');

  if (type === 'all') {
    renderListings(properties);
  } else if (type === 'luxury') {
    renderListings(properties.filter(p => p.isLuxury));
  } else {
    renderListings(properties.filter(p => p.gender === type));
  }
}

// Modal Handlers
function toggleAuthModal(show) {
  const modal = document.getElementById("authModal");
  if (modal) {
    if (show) modal.classList.add("active");
    else modal.classList.remove("active");
  }
}

function closeAuthModal() {
  toggleAuthModal(false);
}

function openSupportModal() {
  const modal = document.getElementById("supportModal");
  if (modal) modal.classList.add("active");
}

function closeSupportModal() {
  const modal = document.getElementById("supportModal");
  if (modal) modal.classList.remove("active");
}

// Dynamic Property Details Loader
function loadPropertyDetails() {
  const params = new URLSearchParams(window.location.search);
  const propId = params.get('id') || 'prop-1';
  const item = properties.find(p => p.id === propId) || properties[0];

  document.getElementById("propTitle").innerText = item.title;
  document.getElementById("propLocation").innerText = item.location;
  document.getElementById("propPrice").innerText = `${item.price.toLocaleString()} ج.م`;
  document.getElementById("propImage").src = item.image;
  
  const genderBadge = document.getElementById("propGenderBadge");
  genderBadge.innerText = item.gender === 'girls' ? 'سكن طالبات' : 'سكن طلاب';
  genderBadge.className = `badge-tag ${item.gender === 'girls' ? 'gender-girls' : 'gender-boys'}`;

  // Initialize Leaflet Map
  if (typeof L !== 'undefined') {
    const map = L.map('propertyMap').setView([item.lat, item.lng], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    L.marker([item.lat, item.lng]).addTo(map).bindPopup(item.title).openPopup();
  }

  // Render Beds
  const bedsGrid = document.getElementById("bedsGrid");
  bedsGrid.innerHTML = item.beds.map(bed => `
    <div class="bed-card ${bed.status}" onclick="selectBed('${bed.id}', this, '${bed.status}')">
      <i class="fa-solid fa-bed"></i>
      <div style="font-weight: 700; font-size: 13px;">${bed.room}</div>
      <div style="font-size: 11px; margin-top: 2px;">${bed.status === 'available' ? 'متاح للكرية' : 'محجوز'}</div>
    </div>
  `).join('');
}

// Interactive Bed Selection logic
function selectBed(bedId, element, status) {
  if (status === 'occupied') return;
  document.querySelectorAll('.bed-card').forEach(b => b.classList.remove('selected'));
  element.classList.add('selected');
  selectedBedId = bedId;
}

// Direct Auth & Booking Handler
function loginWithGoogle() {
  alert("جاري الاتصال بـ Google Sign-In...");
  closeAuthModal();
}

function loginWithFacebook() {
  alert("جاري الاتصال بـ Facebook SDK...");
  closeAuthModal();
}

function confirmBooking() {
  if (!selectedBedId) {
    alert("برجاء اختيار السرير المطلوب أولاً من القائمة.");
    return;
  }
  toggleAuthModal(true);
}
