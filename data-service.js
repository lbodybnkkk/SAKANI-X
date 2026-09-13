// data-service.js
import { db, ref, push, set, onValue, update, remove, get, child, query, orderByChild, equalTo } from "./firebase-config.js";

// ========== السكنات ==========
function listenToHousings(callback) {
    const housingsRef = ref(db, "housings");
    onValue(housingsRef, (snapshot) => {
        const data = snapshot.val();
        const list = data ? Object.entries(data).map(([id, val]) => ({ id, ...val })) : [];
        callback(list);
    });
}

// ========== الحجز ==========
async function createBooking(user, housingId, housingTitle, bedId, bedLabel, moveInDate, notes) {
    const bookingData = {
        userId: user.uid,
        userName: user.displayName || "مستخدم",
        userEmail: user.email,
        userPhone: "",
        housingId,
        housingTitle,
        bedId,
        bedLabel,
        moveInDate,
        notes: notes || "",
        status: "pending",
        createdAt: Date.now()
    };
    const newRef = push(ref(db, "bookings"));
    await set(newRef, bookingData);
    return newRef.key;
}

function listenToUserBookings(userId, callback) {
    const bookingsRef = ref(db, "bookings");
    onValue(bookingsRef, (snapshot) => {
        const data = snapshot.val();
        const list = data 
            ? Object.entries(data)
                .filter(([_, v]) => v.userId === userId)
                .map(([id, val]) => ({ id, ...val }))
            : [];
        callback(list);
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

function listenToFavorites(userId, callback) {
    const favRef = ref(db, `favorites/${userId}`);
    onValue(favRef, (snapshot) => {
        const data = snapshot.val() || {};
        callback(Object.keys(data));
    });
}

export { 
    listenToHousings, createBooking, listenToUserBookings,
    toggleFavorite, listenToFavorites 
};
