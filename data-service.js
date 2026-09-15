import { 
    db, ref, push, set, onValue, update, remove, 
    get, child, query, orderByChild, equalTo 
} from "./firebase-config.js";

function listenToHousings(callback) {
    const housingsRef = ref(db, "housings");
    onValue(housingsRef, (snapshot) => {
        const data = snapshot.val();
        const list = data ? Object.entries(data).map(([id, val]) => ({ id, ...val })) : [];
        callback(list);
    });
}

function listenToSingleHousing(housingId, callback) {
    const housingRef = ref(db, `housings/${housingId}`);
    onValue(housingRef, (snapshot) => {
        if (snapshot.exists()) {
            callback({ id: housingId, ...snapshot.val() });
        } else {
            callback(null);
        }
    });
}

async function createBooking(user, bookingData) {
    const data = {
        userId: user.uid,
        userName: bookingData.userName || user.displayName || "مستخدم",
        userEmail: user.email,
        userPhone: bookingData.userPhone || "",
        userGovernorate: bookingData.userGovernorate || "",
        housingId: bookingData.housingId,
        housingTitle: bookingData.housingTitle,
        housingCity: bookingData.housingCity || "",
        housingImage: bookingData.housingImage || "",
        bedId: bookingData.bedId,
        bedLabel: bookingData.bedLabel,
        checkInDate: bookingData.checkInDate,
        checkOutDate: bookingData.checkOutDate,
        monthlyPrice: bookingData.monthlyPrice || 0,
        notes: bookingData.notes || "",
        status: "pending",
        createdAt: Date.now()
    };
    const newRef = push(ref(db, "bookings"));
    await set(newRef, data);
    return newRef.key;
}

// ملحوظة أمان/أداء مهمة:
// الدالتين دول كانوا بيسحبوا عقدة "bookings" كاملة (حجوزات كل المستخدمين) لكل متصفح
// وبعدين بيفلتروا في الجافاسكريبت. ده كان بيسبب بطء في تحميل الصفحة كل ما تكبر
// قاعدة البيانات، وكمان بيبعت لأي متصفح بيانات حجوزات مستخدمين تانيين (اسم، تليفون،
// محافظة) حتى لو الواجهة مش بتعرضها - أي حد يفتح Network tab في المتصفح يقدر يشوفها.
//
// الحل: استخدام query() + orderByChild("userId") + equalTo(userId) عشان فايربيز
// نفسه يرجّع بس الحجوزات بتاعة اليوزر ده، مش كل الجدول.
//
// ⚠️ الفلترة دي بتقلل البيانات المنقولة، لكن الحماية الحقيقية النهائية لازم تتظبط
// كمان من Firebase Realtime Database Rules (من لوحة تحكم Firebase، مش من الكود)
// بحيث تكون:
//   "bookings": {
//     ".indexOn": "userId",
//     "$bookingId": {
//       ".read": "auth != null && (data.child('userId').val() === auth.uid || root.child('admins').child(auth.uid).exists())"
//     }
//   }
// من غير الـ Rule ده، أي حد يعرف يبعت طلب مباشر لفايربيز (حتى لو مش من الموقع)
// يقدر يشوف كل الحجوزات بغض النظر عن الكود بتاعنا.

function listenToUserBookings(userId, callback) {
    const bookingsQuery = query(ref(db, "bookings"), orderByChild("userId"), equalTo(userId));
    onValue(bookingsQuery, (snapshot) => {
        const data = snapshot.val();
        const list = data 
            ? Object.entries(data)
                .map(([id, val]) => ({ id, ...val }))
                .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
            : [];
        callback(list);
    });
}

function listenToLatestBooking(userId, callback) {
    const bookingsQuery = query(ref(db, "bookings"), orderByChild("userId"), equalTo(userId));
    onValue(bookingsQuery, (snapshot) => {
        const data = snapshot.val();
        if (!data) return callback(null);
        const userBookings = Object.entries(data)
            .map(([id, val]) => ({ id, ...val }))
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        callback(userBookings[0] || null);
    });
}

async function toggleFavorite(userId, housingId) {
    const favRef = ref(db, `favorites/${userId}/${housingId}`);
    const snapshot = await get(favRef);
    if (snapshot.exists()) {
        await remove(favRef);
        return false;
    } else {
        await set(favRef, { addedAt: Date.now() });
        return true;
    }
}

function listenToFavorites(userId, callback) {
    const favRef = ref(db, `favorites/${userId}`);
    onValue(favRef, (snapshot) => {
        const data = snapshot.val() || {};
        callback(Object.keys(data));
    });
}

function listenToSections(callback) {
    const sectionsRef = ref(db, "sections");
    onValue(sectionsRef, (snapshot) => {
        const data = snapshot.val();
        const list = data ? Object.entries(data).map(([id, val]) => ({ id, ...val })) : [];
        callback(list);
    });
}

async function updateBedStatus(housingId, bedId, status) {
    const bedRef = ref(db, `housings/${housingId}/beds`);
    const snapshot = await get(bedRef);
    if (snapshot.exists()) {
        const beds = snapshot.val();
        const updatedBeds = beds.map(b => b.id === bedId ? { ...b, status } : b);
        await update(ref(db, `housings/${housingId}`), { beds: updatedBeds });
    }
}

export { 
    listenToHousings, 
    listenToSingleHousing, 
    createBooking, 
    listenToUserBookings, 
    listenToLatestBooking,
    toggleFavorite, 
    listenToFavorites,
    listenToSections, 
    updateBedStatus
};
