// app.js — منطق منصة SAKANI-X المشترك بين جميع الصفحات
import {
  auth, db,
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signInWithPopup, GoogleAuthProvider, signOut, updateProfile,
  ref, set, get, push, update, remove, onValue, child, query, orderByChild, equalTo
} from "./firebase-config.js";

/* ========================= 1) الوضع الليلي (Dark Mode) ========================= */
export function initDarkMode() {
  const saved = localStorage.getItem("sakani_theme") || "light";
  document.documentElement.setAttribute("data-theme", saved);
  document.querySelectorAll(".dark-toggle").forEach(t => {
    t.checked = saved === "dark";
    t.addEventListener("change", () => {
      const mode = t.checked ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", mode);
      localStorage.setItem("sakani_theme", mode);
      document.querySelectorAll(".dark-toggle").forEach(o => (o.checked = t.checked));
    });
  });
}

/* ========================= 2) الهيدر + القائمة الجانبية + الشريط السفلي ========================= */
const HEADER_HTML = `
<header class="topbar">
  <button class="icon-btn" id="openDrawerBtn" aria-label="القائمة">
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
  </button>
  <a href="index.html" class="logo">SAKANI<span>-X</span></a>
  <a href="profile.html" class="icon-btn avatar-btn" id="profileBtn" aria-label="حسابي">
    <img id="topAvatar" src="https://api.dicebear.com/7.x/initials/svg?seed=SX" alt="">
  </a>
</header>

<div class="drawer-overlay" id="drawerOverlay"></div>
<aside class="drawer" id="drawer">
  <div class="drawer-head">
    <img id="drawerAvatar" src="https://api.dicebear.com/7.x/initials/svg?seed=SX" alt="">
    <div>
      <p class="drawer-name" id="drawerName">زائر</p>
      <p class="drawer-email" id="drawerEmail">سجّل الدخول للمتابعة</p>
    </div>
    <button class="icon-btn" id="closeDrawerBtn">✕</button>
  </div>

  <div class="drawer-item toggle-row">
    <span>🌙 الوضع الليلي</span>
    <label class="switch"><input type="checkbox" class="dark-toggle"><span class="slider"></span></label>
  </div>

  <a class="drawer-item" href="profile.html">👤 حسابي</a>
  <a class="drawer-item" href="profile.html#academic">🎓 ملف الطالب الجامعي</a>
  <a class="drawer-item" href="dashboard.html">🏢 لوحة التحكم (عقاراتي)</a>
  <a class="drawer-item" href="favorites.html">❤️ المفضلة</a>
  <a class="drawer-item" href="bookings.html">📖 حجوزاتي</a>
  <a class="drawer-item" href="#" id="notifLink">🔔 الإشعارات <span class="badge" id="notifCount">0</span></a>
  <a class="drawer-item" href="support.html">🛟 الدعم الفني</a>
  <button class="drawer-item auth-btn" id="authActionBtn">🔐 تسجيل الدخول</button>
</aside>

<nav class="bottom-nav">
  <a href="index.html" data-page="index"><span>🏠</span>الرئيسية</a>
  <a href="support.html" data-page="support"><span>🛟</span>الدعم</a>
  <a href="index.html#search" data-page="search"><span>🔍</span>البحث</a>
  <a href="favorites.html" data-page="favorites"><span>❤️</span>المفضلة</a>
  <a href="bookings.html" data-page="bookings"><span>📖</span>حجوزاتي</a>
</nav>
`;

export function mountShell(activePage) {
  const shellHost = document.getElementById("app-shell");
  if (!shellHost) return;
  shellHost.innerHTML = HEADER_HTML;

  const drawer = document.getElementById("drawer");
  const overlay = document.getElementById("drawerOverlay");
  document.getElementById("openDrawerBtn").onclick = () => { drawer.classList.add("open"); overlay.classList.add("show"); };
  document.getElementById("closeDrawerBtn").onclick = closeDrawer;
  overlay.onclick = closeDrawer;
  function closeDrawer() { drawer.classList.remove("open"); overlay.classList.remove("show"); }

  document.querySelectorAll(`.bottom-nav a[data-page="${activePage}"]`).forEach(a => a.classList.add("active"));

  initDarkMode();
  watchAuthState();
  watchNotifications();
}

/* ========================= 3) حالة تسجيل الدخول ========================= */
export let currentUser = null;

function watchAuthState() {
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    const nameEl = document.getElementById("drawerName");
    const emailEl = document.getElementById("drawerEmail");
    const authBtn = document.getElementById("authActionBtn");
    const avatarEls = [document.getElementById("topAvatar"), document.getElementById("drawerAvatar")];

    if (user) {
      const seed = encodeURIComponent(user.displayName || user.email || "SX");
      avatarEls.forEach(el => el && (el.src = user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${seed}`));
      if (nameEl) nameEl.textContent = user.displayName || "طالب مسجل";
      if (emailEl) emailEl.textContent = user.email || "";
      if (authBtn) {
        authBtn.textContent = "🚪 تسجيل الخروج";
        authBtn.onclick = () => signOut(auth);
      }
      document.dispatchEvent(new CustomEvent("sakani:auth", { detail: { user } }));
    } else {
      if (nameEl) nameEl.textContent = "زائر";
      if (emailEl) emailEl.textContent = "سجّل الدخول للمتابعة";
      if (authBtn) {
        authBtn.textContent = "🔐 تسجيل الدخول";
        authBtn.onclick = () => { window.location.href = "profile.html"; };
      }
      document.dispatchEvent(new CustomEvent("sakani:auth", { detail: { user: null } }));
    }
  });
}

export async function loginEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}
export async function registerEmail(email, password, name) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });
  await set(ref(db, `users/${cred.user.uid}/profile`), {
    firstName: name, email, createdAt: Date.now()
  });
  return cred;
}
export async function loginGoogle() {
  return signInWithPopup(auth, new GoogleAuthProvider());
}
export async function logout() { return signOut(auth); }

/* ========================= 4) الإشعارات ========================= */
function watchNotifications() {
  const badge = document.getElementById("notifCount");
  onAuthStateChanged(auth, (user) => {
    if (!user || !badge) { if (badge) badge.style.display = "none"; return; }
    const notifRef = ref(db, `users/${user.uid}/notifications`);
    onValue(notifRef, (snap) => {
      const data = snap.val() || {};
      const unread = Object.values(data).filter(n => !n.read).length;
      badge.textContent = unread;
      badge.style.display = unread > 0 ? "inline-flex" : "none";
    });
  });
}

/* ========================= 5) بيانات تجريبية (Seed) ========================= */
export const SAMPLE_PROPERTIES = {
  p1: {
    title: "سكن الأمانة للطالبات", city: "عمّان", area: "شارع الجامعة",
    type: "بنات", price: 85, deposit: 50, verified: true, topRequested: true,
    rating: 4.7, availableBeds: 6, totalBeds: 12,
    lat: 32.0186, lng: 35.8734,
    images: [
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=900",
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=900",
      "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=900"
    ],
    description: "سكن طلابي مجهز بالكامل قريب من الحرم الجامعي، أجواء عائلية وإشراف يومي.",
    availableFrom: "2026-09-01", availableTo: "2027-06-30",
    utilities: "الكهرباء والغاز والمياه على الطلاب بالتساوي شهرياً.",
    amenities: ["Wi-Fi", "غسالة", "ثلاجة", "ديب فريزر", "سخان", "حمام مجهز"],
    rooms: {
      r1: { name: "غرفة 1", beds: { b1: { available: true }, b2: { available: false }, b3: { available: true } } },
      r2: { name: "غرفة 2", beds: { b1: { available: true }, b2: { available: true } } }
    }
  },
  p2: {
    title: "استراحة الطلاب - شباب", city: "إربد", area: "الحي الجامعي",
    type: "شباب", price: 60, deposit: 40, verified: false, topRequested: false,
    rating: 4.2, availableBeds: 3, totalBeds: 10,
    lat: 32.5556, lng: 35.8500,
    images: [
      "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=900",
      "https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=900"
    ],
    description: "سكن اقتصادي بموقع مميز وخدمة نظافة أسبوعية.",
    availableFrom: "2026-09-01", availableTo: "2027-06-30",
    utilities: "فاتورة موحدة تقسم على عدد الطلاب في نهاية كل شهر.",
    amenities: ["Wi-Fi", "غسالة", "ثلاجة"],
    rooms: {
      r1: { name: "غرفة 1", beds: { b1: { available: true }, b2: { available: false } } }
    }
  },
  p3: {
    title: "بيت الطالبات الجديد", city: "الزرقاء", area: "قرب الجامعة الهاشمية",
    type: "طالبات", price: 95, deposit: 60, verified: true, topRequested: true,
    rating: 4.9, availableBeds: 2, totalBeds: 8,
    lat: 32.0728, lng: 36.0876,
    images: ["https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?w=900"],
    description: "سكن حديث افتتح هذا العام بتجهيزات فندقية وحراسة على مدار الساعة.",
    availableFrom: "2026-09-15", availableTo: "2027-07-01",
    utilities: "متضمنة ضمن الإيجار الشهري بالكامل.",
    amenities: ["Wi-Fi", "تكييف", "غسالة", "ثلاجة", "ديب فريزر", "سخان", "حمام مجهز"],
    rooms: {
      r1: { name: "غرفة 1", beds: { b1: { available: true } } },
      r2: { name: "غرفة 2", beds: { b1: { available: true }, b2: { available: false } } }
    }
  }
};

export async function seedSampleDataIfEmpty() {
  const snap = await get(ref(db, "properties"));
  if (!snap.exists()) {
    await set(ref(db, "properties"), SAMPLE_PROPERTIES);
  }
}

export async function getAllProperties() {
  try {
    const snap = await get(ref(db, "properties"));
    if (snap.exists()) return snap.val();
  } catch (e) { console.warn("تعذر الاتصال بقاعدة البيانات، سيتم استخدام بيانات تجريبية محلية.", e); }
  return SAMPLE_PROPERTIES;
}

export async function getProperty(id) {
  try {
    const snap = await get(ref(db, `properties/${id}`));
    if (snap.exists()) return snap.val();
  } catch (e) { /* fallback */ }
  return SAMPLE_PROPERTIES[id] || null;
}

/* ========================= 6) المفضلة ========================= */
export async function toggleFavorite(propId) {
  if (!currentUser) { alert("سجّل الدخول أولاً لإضافة السكن للمفضلة"); return false; }
  const favRef = ref(db, `users/${currentUser.uid}/favorites/${propId}`);
  const snap = await get(favRef);
  if (snap.exists()) { await remove(favRef); return false; }
  await set(favRef, true);
  return true;
}
export async function isFavorite(propId) {
  if (!currentUser) return false;
  const snap = await get(ref(db, `users/${currentUser.uid}/favorites/${propId}`));
  return snap.exists();
}
export async function getFavoriteIds() {
  if (!currentUser) return [];
  const snap = await get(ref(db, `users/${currentUser.uid}/favorites`));
  return snap.exists() ? Object.keys(snap.val()) : [];
}

/* ========================= 7) الحجوزات ========================= */
export async function createBooking(propId, bedInfo) {
  if (!currentUser) { alert("سجّل الدخول أولاً لإتمام الحجز"); return null; }
  const bookingRef = push(ref(db, `bookings`));
  const booking = {
    id: bookingRef.key,
    userId: currentUser.uid,
    propId, ...bedInfo,
    status: "قيد المراجعة",
    createdAt: Date.now()
  };
  await set(bookingRef, booking);
  await set(ref(db, `users/${currentUser.uid}/bookings/${bookingRef.key}`), true);
  return booking;
}
export async function getMyBookings() {
  if (!currentUser) return [];
  const snap = await get(ref(db, `users/${currentUser.uid}/bookings`));
  if (!snap.exists()) return [];
  const ids = Object.keys(snap.val());
  const results = [];
  for (const id of ids) {
    const b = await get(ref(db, `bookings/${id}`));
    if (b.exists()) results.push(b.val());
  }
  return results;
}

/* ========================= 8) بطاقة السكن (Card) ========================= */
export function propertyCardHTML(id, p) {
  return `
  <article class="prop-card" data-id="${id}">
    <div class="prop-img-wrap">
      <img src="${p.images?.[0] || ''}" alt="${p.title}" loading="lazy">
      <button class="fav-btn" data-fav="${id}">🤍</button>
      <span class="badge-verify ${p.verified ? 'yes' : 'no'}">${p.verified ? '✔ موثق' : 'غير موثق'}</span>
      <span class="badge-type">${p.type}</span>
    </div>
    <div class="prop-body">
      <h3>${p.title}</h3>
      <p class="prop-loc">📍 ${p.area}, ${p.city}</p>
      <div class="prop-meta">
        <span>🛏️ ${p.availableBeds}/${p.totalBeds} سرير متاح</span>
        <span>⭐ ${p.rating}</span>
      </div>
      <div class="prop-price-row">
        <div>
          <strong>${p.price} د.أ</strong><span>/شهرياً</span>
          <p class="deposit">تأمين مسترد: ${p.deposit} د.أ</p>
        </div>
        <a class="btn-details" href="details.html?id=${id}">تفاصيل السكن</a>
      </div>
    </div>
  </article>`;
}

export function bindFavButtons(container) {
  container.querySelectorAll("[data-fav]").forEach(btn => {
    const id = btn.dataset.fav;
    isFavorite(id).then(fav => (btn.textContent = fav ? "❤️" : "🤍"));
    btn.addEventListener("click", async (e) => {
      e.preventDefault(); e.stopPropagation();
      const nowFav = await toggleFavorite(id);
      btn.textContent = nowFav ? "❤️" : "🤍";
    });
  });
}

export function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}
