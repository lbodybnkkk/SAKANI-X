import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  ref, 
  set, 
  push, 
  onValue, 
  get,
  showToast 
} from "./firebase-config.js";

let currentUser = null;
let currentSelectedBed = null;
let loadedHousings = [];

// متابعة حالة المستخدم
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  updateUIForAuth(user);
});

// 1. جلب السكنات المضافة من لوحة التحكم (Firebase RTDB)
export function listenToFirebaseHousings() {
  const container = document.getElementById("listingsContainer");
  if (!container) return;

  container.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-muted);">جاري تحميل السكنات المتاحة...</div>`;

  const housingsRef = ref(db, 'housings');
  onValue(housingsRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) {
      container.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-muted);">لا توجد سكنات مضافة حالياً من الإدارة.</div>`;
      loadedHousings = [];
      return;
    }

    loadedHousings = Object.keys(data).map(key => ({ id: key, ...data[key] }));
    renderListings(loadedHousings);
  }, (error) => {
    showToast("عفواً، حدث خطأ أثناء تحميل السكنات: " + error.message, "error");
  });
}

function renderListings(items) {
  const container = document.getElementById("listingsContainer");
  if (!container) return;

  container.innerHTML = items.map(item => `
    <a href="details.html?id=${item.id}" class="housing-card">
      <div class="card-media">
        <img src="${item.image || 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af'}" alt="${item.title}">
        <div class="card-badges">
          <span class="badge-tag ${item.gender === 'girls' ? 'gender-girls' : 'gender-boys'}">
            <i class="fa-solid ${item.gender === 'girls' ? 'fa-person-dress' : 'fa-person'}"></i>
            ${item.gender === 'girls' ? 'سكن طالبات' : 'سكن طلاب'}
          </span>
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
}

// 2. تسجيل الدخول بجوجل
window.handleGoogleLogin = async function() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    showToast(`أهلاً بك ${result.user.displayName || 'مجدداً'}`, "success");
    closeAuthModal();
  } catch (err) {
    showToast("فشل تسجيل الدخول بواسطة Google: " + err.message, "error");
  }
};

// 3. تسجيل الدخول بالبريد وإصلاح منع الصفحة من الإغلاق/الكراش
window.handleEmailAuth = async function(event) {
  event.preventDefault(); // منع الكراش وإعادة التحميل
  
  const email = document.getElementById("authEmail").value;
  const password = document.getElementById("authPassword").value;

  if (!email || !password) {
    showToast("برجاء إدخال البريد الإلكتروني وكلمة المرور", "error");
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
    showToast("تم تسجيل الدخول بنجاح", "success");
    closeAuthModal();
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      try {
        await createUserWithEmailAndPassword(auth, email, password);
        showToast("تم إنشاء حسابك الجديد بنجاح!", "success");
        closeAuthModal();
      } catch (createErr) {
        showToast("فشل إنشاء الحساب: " + createErr.message, "error");
      }
    } else {
      showToast("خطأ في بيانات الدخول: " + error.message, "error");
    }
  }
};

// 4. تحميل تفاصيل السكن والأسرة المتاحة
window.loadPropertyDetails = async function() {
  const params = new URLSearchParams(window.location.search);
  const propId = params.get('id');

  if (!propId) {
    window.location.href = 'index.html';
    return;
  }

  const snapshot = await get(ref(db, `housings/${propId}`));
  if (!snapshot.exists()) {
    showToast("عفواً، هذا السكن لم يعد متوفراً", "error");
    return;
  }

  const item = snapshot.val();
  document.getElementById("propTitle").innerText = item.title;
  document.getElementById("propLocation").innerText = item.location;
  document.getElementById("propPrice").innerText = `${Number(item.price).toLocaleString()} ج.م`;
  document.getElementById("propImage").src = item.image || 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af';

  // عرض الأسرة المتاحة
  const bedsGrid = document.getElementById("bedsGrid");
  if (item.beds && Array.isArray(item.beds)) {
    bedsGrid.innerHTML = item.beds.map((bed, index) => `
      <div class="bed-card ${bed.status}" onclick="selectBed('${bed.id || index}', this, '${bed.status}')">
        <i class="fa-solid fa-bed"></i>
        <div style="font-weight: 700; font-size: 13px;">${bed.roomName || 'غرفة'}</div>
        <div style="font-size: 11px;">${bed.status === 'available' ? 'متاح' : 'محجوز'}</div>
      </div>
    `).join('');
  } else {
    bedsGrid.innerHTML = `<p style="color:var(--text-muted)">لا توجد تفاصيل أسرة مسجلة لهذا السكن.</p>`;
  }
};

window.selectBed = function(bedId, element, status) {
  if (status === 'occupied') {
    showToast("هذا السرير محجوز بالفعل", "error");
    return;
  }
  document.querySelectorAll('.bed-card').forEach(b => b.classList.remove('selected'));
  element.classList.add('selected');
  currentSelectedBed = bedId;
};

// 5. تأكيد الحجز وإرساله إلى Firebase Realtime Database
window.confirmBooking = async function() {
  if (!currentUser) {
    showToast("يجب تسجيل الدخول أولاً لإتمام الحجز", "info");
    toggleAuthModal(true);
    return;
  }

  if (!currentSelectedBed) {
    showToast("برجاء تحديد السرير المطلوب من القائمة أعلاه أولاً", "info");
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const propId = params.get('id');

  try {
    const newBookingRef = push(ref(db, 'bookings'));
    await set(newBookingRef, {
      userId: currentUser.uid,
      userEmail: currentUser.email,
      propertyId: propId,
      bedId: currentSelectedBed,
      createdAt: new Date().toISOString(),
      status: "pending"
    });

    showToast("تم إرسال طلب الحجز بنجاح! يمكنك متابعته من شاشة حجوزاتي", "success");
    setTimeout(() => window.location.href = "bookings.html", 1500);
  } catch (err) {
    showToast("فشل حفظ الحجز: " + err.message, "error");
  }
};

function updateUIForAuth(user) {
  const profileContainer = document.getElementById("profileSection");
  if (profileContainer) {
    if (user) {
      profileContainer.innerHTML = `
        <div class="profile-card">
          <div class="profile-info">
            <div class="profile-avatar"><i class="fa-solid fa-user"></i></div>
            <div>
              <h4 style="font-weight: 800;">${user.displayName || 'مستخدم SAKANI-X'}</h4>
              <p style="font-size: 13px; color: var(--text-muted);">${user.email}</p>
            </div>
          </div>
          <button onclick="handleSignOut()" class="chip" style="margin-top: 15px; background: #ef4444; color: white; border: none; width: 100%;">تسجيل الخروج</button>
        </div>
      `;
    } else {
      profileContainer.innerHTML = `
        <div class="profile-card" style="text-align: center;">
          <p style="margin-bottom: 12px; font-weight: 700;">سجل دخولك للحصول على تجربة حجز كاملة</p>
          <button onclick="toggleAuthModal(true)" class="btn-submit-luxury">تسجيل الدخول / حساب جديد</button>
        </div>
      `;
    }
  }
}

window.handleSignOut = () => signOut(auth).then(() => showToast("تم تسجيل الخروج بنجاح", "info"));
window.toggleAuthModal = (show) => document.getElementById("authModal")?.classList.toggle("active", show);
window.closeAuthModal = () => toggleAuthModal(false);
