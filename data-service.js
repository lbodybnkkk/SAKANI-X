// data-service.js
import { 
    db, ref, push, set, onValue, update, remove, 
    get, child, query, orderByChild, equalTo 
} from "./firebase-config.js";

// ========== السكنات ==========
function listenToHousings(callback) {
    const housingsRef = ref(db, "housings");
    onValue(housingsRef, (snapshot) => {
        const data = snapshot.val();
        const list = data ? Object.entries(data).map(([id, val]) => ({ id, ...val })) : [];
        callback(list);
    });
}

// ========== جلب سكن واحد ==========
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

// ========== إنشاء حجز ==========
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

// ========== استماع لحجوزات المستخدم ==========
function listenToUserBookings(userId, callback) {
    const bookingsRef = ref(db, "bookings");
    onValue(bookingsRef, (snapshot) => {
        const data = snapshot.val();
        const list = data 
            ? Object.entries(data)
                .filter(([_, v]) => v.userId === userId)
                .map(([id, val]) => ({ id, ...val }))
                .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
            : [];
        callback(list);
    });
}

// ========== استماع لآخر حجز للمستخدم ==========
function listenToLatestBooking(userId, callback) {
    const bookingsRef = ref(db, "bookings");
    onValue(bookingsRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return callback(null);
        const userBookings = Object.entries(data)
            .filter(([_, v]) => v.userId === userId)
            .map(([id, val]) => ({ id, ...val }))
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        callback(userBookings[0] || null);
    });
}

// ========== المفضلة ==========
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

// ⭐⭐⭐ هذه الدالة كانت مفقودة — والآن موجودة ⭐⭐⭐
function listenToFavorites(userId, callback) {
    const favRef = ref(db, `favorites/${userId}`);
    onValue(favRef, (snapshot) => {
        const data = snapshot.val() || {};
        callback(Object.keys(data));
    });
}

// ========== الأقسام ==========
function listenToSections(callback) {
    const sectionsRef = ref(db, "sections");
    onValue(sectionsRef, (snapshot) => {
        const data = snapshot.val();
        const list = data ? Object.entries(data).map(([id, val]) => ({ id, ...val })) : [];
        callback(list);
    });
}

// ========== تحديث حالة السرير ==========
async function updateBedStatus(housingId, bedId, status) {
    const bedRef = ref(db, `housings/${housingId}/beds`);
    const snapshot = await get(bedRef);
    if (snapshot.exists()) {
        const beds = snapshot.val();
        const updatedBeds = beds.map(b => b.id === bedId ? { ...b, status } : b);
        await update(ref(db, `housings/${housingId}`), { beds: updatedBeds });
    }
}

// ========== التصدير ⭐⭐⭐ تأكد من وجود كل الأسماء ⭐⭐⭐
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
