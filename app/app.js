import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  getDatabase, 
  ref, 
  set, 
  push, 
  onValue, 
  get 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// إعداد الفايربيس الخاص بمشروعك
const firebaseConfig = {
  databaseURL: "https://cmd1-1c696-default-rtdb.firebaseio.com/",
  authDomain: "cmd1-1c696.firebaseapp.com",
  projectId: "cmd1-1c696"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const googleProvider = new GoogleAuthProvider();

let currentUser = null;
let currentSelectedBed = null;

// نظام الإشعارات البديل لـ alert
export function showToast(message, type = 'info') {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = `toast-item toast-${type}`;
  toast.innerHTML = `
    <i class="fa-solid ${type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-info'}"></i>
    <span>${message}</span>
  `;

  toastContainer.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// متابعة حالة المستخدم وتحديث الواجهة
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  updateProfileUI(user);
});

// 1. جلب السكنات المضافة من الفايربيس فقط
export function listenToFirebaseHousings() {
  const container = document.getElementById("listingsContainer");
  if (!container) return;

  container.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-muted);">جاري تحميل السكنات المتاحة...</div>`;

  const housingsRef = ref(db, 'housings');
  onValue(housingsRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) {
      container.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-muted);">لا توجد سكنات مضافة حالياً من الإدارة.</div>`;
      return;
    }

    const items = Object.keys(data).map(key => ({ id: key, ...data[key] }));
    container.innerHTML = items.map(item => `
      <a href="details.html?id=${item.id}" class="housing-card">
        <div class="card-media">
          <img src="${item.image || 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af'}" alt="${item.title}">
          <div class="badge-tag ${item.gender === 'girls' ? 'gender-girls' : 'gender-boys'}">
            ${item.gender === 'girls' ? 'سكن طالبات' : 'سكن طلاب'}
          </div>
        </div>
        <div class="card-body">
          <div class="card-price">${Number(item.price || 0).toLocaleString()} ج.م <span>/ شهرياً</span></div>
          <h3 class="card-title">${item.title}</h3>
          <div class="card-location">
            <i class="fa-solid fa-location-dot" style="color: var(--accent-gold);"></i>
            <span>${item.location || 'غير محدد'}</span>
          </div>
        </div>
      </a>
    `).join('');
  }, (err) => {
    showToast("خطأ في جلب البيانات: " + err.message, "error");
  });
}

// 2. تسجيل الدخول بجوجل
window.handleGoogleLogin = async function() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    showToast(`أهلاً بك ${result.user.displayName || ''}`, "success");
    window.closeAuthModal();
  } catch (err) {
    showToast("فشل تسجيل الدخول بجوجل: " + err.message, "error");
  }
};

// 3. تسجيل الدخول بالبريد ومربوط دون إعادة تحويل (منع الكراش)
window.handleEmailAuth = async function(event) {
  event.preventDefault();
  const email = document.getElementById("authEmail").value;
  const password = document.getElementById("authPassword").value;

  if (!email || !password) {
    showToast("يرجى إدخال البريد وكلمة المرور", "error");
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
    showToast("تم تسجيل الدخول بنجاح", "success");
    window.closeAuthModal();
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      try {
        await createUserWithEmailAndPassword(auth, email, password);
        showToast("تم إنشاء حساب جديد بنجاح", "success");
        window.closeAuthModal();
      } catch (cErr) {
        showToast("خطأ في الإنشاء: " + cErr.message, "error");
      }
    } else {
      showToast("بيانات الدخول غير صحيحة", "error");
    }
  }
};

// 4. تحميل تفاصيل السكن والأسرة المتاحة
window.loadPropertyDetails = async function() {
  const params = new URLSearchParams(window.location.search);
  const propId = params.get('id');
  if (!propId) return;

  const snapshot = await get(ref(db, `housings/${propId}`));
  if (!snapshot.exists()) {
    showToast("السكن غير متوفر", "error");
    return;
  }

  const item = snapshot.val();
  document.getElementById("propTitle").innerText = item.title;
  document.getElementById("propLocation").innerText = item.location;
  document.getElementById("propPrice").innerText = `${Number(item.price).toLocaleString()} ج.م`;
  document.getElementById("propImage").src = item.image || 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af';

  const bedsGrid = document.getElementById("bedsGrid");
  if (item.beds && Array.isArray(item.beds)) {
    bedsGrid.innerHTML = item.beds.map((bed, idx) => `
      <div class="bed-card ${bed.status}" onclick="window.selectBed('${bed.id || idx}', this, '${bed.status}')">
        <i class="fa-solid fa-bed"></i>
        <div style="font-weight:700; font-size:13px;">${bed.roomName || 'سرير'}</div>
        <div style="font-size:11px;">${bed.status === 'available' ? 'متاح' : 'محجوز'}</div>
      </div>
    `).join('');
  } else {
    bedsGrid.innerHTML = `<p style="color:var(--text-muted)">لا تفاصيل أسرة مسجلة لهذا السكن.</p>`;
  }
};

window.selectBed = function(bedId, el, status) {
  if (status === 'occupied') {
    showToast("هذا السرير محجوز بالفعل", "error");
    return;
  }
  document.querySelectorAll('.bed-card').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  currentSelectedBed = bedId;
};

// 5. تأكيد الحجز المباشر في الفايربيس
window.confirmBooking = async function() {
  if (!currentUser) {
    showToast("سجل دخولك أولاً للحجز", "info");
    window.toggleAuthModal(true);
    return;
  }

  if (!currentSelectedBed) {
    showToast("يرجى اختيار السرير المفضل قبل الحجز", "info");
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const propId = params.get('id');

  try {
    const bookingRef = push(ref(db, 'bookings'));
    await set(bookingRef, {
      userId: currentUser.uid,
      userEmail: currentUser.email,
      propertyId: propId,
      bedId: currentSelectedBed,
      createdAt: new Date().toISOString(),
      status: "pending"
    });

    showToast("تم الحجز بنجاح!", "success");
    setTimeout(() => window.location.href = "bookings.html", 1500);
  } catch (err) {
    showToast("حدث خطأ أثناء الحجز: " + err.message, "error");
  }
};

// 6. تحميل حجوزات المستخدم
window.loadUserBookings = async function() {
  const container = document.getElementById("userBookingsContainer");
  if (!container) return;

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      container.innerHTML = `<p style="text-align:center; padding:30px;">يرجى تسجيل الدخول لعرض حجوزاتك.</p>`;
      return;
    }

    const snapshot = await get(ref(db, 'bookings'));
    if (!snapshot.exists()) {
      container.innerHTML = `<p style="text-align:center; padding:30px;">لا توجد حجوزات سابقة.</p>`;
      return;
    }

    const bookings = snapshot.val();
    const myBookings = Object.keys(bookings)
      .map(k => ({ id: k, ...bookings[k] }))
      .filter(b => b.userId === user.uid);

    if (myBookings.length === 0) {
      container.innerHTML = `<p style="text-align:center; padding:30px;">لا توجد حجوزات سابقة مسجلة باسمك.</p>`;
      return;
    }

    container.innerHTML = myBookings.map(b => `
      <div class="profile-card">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h4 style="font-weight:800;">طلب حجز #${b.id.slice(-5)}</h4>
          <span style="background:var(--accent-gold); color:#fff; padding:4px 8px; border-radius:8px; font-size:12px;">${b.status}</span>
        </div>
        <p style="font-size:13px; color:var(--text-muted); margin-top:8px;">السرير المحجوز: ${b.bedId}</p>
        <p style="font-size:12px; color:var(--text-muted);">التاريخ: ${new Date(b.createdAt).toLocaleDateString('ar-EG')}</p>
      </div>
    `).join('');
  });
};

function updateProfileUI(user) {
  const container = document.getElementById("profileSection");
  if (!container) return;

  if (user) {
    container.innerHTML = `
      <div class="profile-card">
        <div class="profile-info">
          <div class="profile-avatar"><i class="fa-solid fa-user"></i></div>
          <div>
            <h4 style="font-weight: 800;">${user.displayName || 'مستخدم SAKANI-X'}</h4>
            <p style="font-size: 13px; color: var(--text-muted);">${user.email}</p>
          </div>
        </div>
        <button onclick="window.handleSignOut()" class="btn-submit-luxury" style="margin-top: 15px; background: #ef4444;">تسجيل الخروج</button>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="profile-card" style="text-align: center;">
        <p style="margin-bottom: 12px; font-weight: 700;">قم بتسجيل الدخول لمتابعة حسابك وحجوزاتك</p>
        <button onclick="window.toggleAuthModal(true)" class="btn-submit-luxury">تسجيل الدخول / إنشاء حساب</button>
      </div>
    `;
  }
}

window.handleSignOut = () => signOut(auth).then(() => showToast("تم تسجيل الخروج بنجاح", "info"));
window.toggleAuthModal = (show) => document.getElementById("authModal")?.classList.toggle("active", show);
window.closeAuthModal = () => window.toggleAuthModal(false);
