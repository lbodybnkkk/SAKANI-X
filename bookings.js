// bookings.js
import { auth, db, ref, onValue } from "./firebase-config.js";
import { showToast, onAuthStateChanged } from "./auth.js";

let allBookings = [];

onAuthStateChanged(auth, (user) => {
    if (!user) {
        document.getElementById("bookingsList").innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-lock"></i>
                <h3>سجّل دخولك لعرض حجوزاتك</h3>
                <p>تصفح الوحدات واحجز سريرك الآن</p>
                <button class="btn-submit-luxury" onclick="window.location.href='index.html'" 
                        style="margin-top:20px; width:auto; padding:12px 32px;">
                    العودة للرئيسية
                </button>
            </div>`;
        return;
    }

    onValue(ref(db, "bookings"), (snapshot) => {
        const data = snapshot.val() || {};
        allBookings = Object.entries(data)
            .filter(([_, v]) => v.userId === user.uid)
            .map(([id, v]) => ({ id, ...v }))
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        renderBookings(allBookings);
    });
});

function renderBookings(bookings) {
    const container = document.getElementById("bookingsList");
    
    if (bookings.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-calendar-xmark"></i>
                <h3>لا توجد حجوزات بعد</h3>
                <p>تصفح الوحدات واحجز سريرك الآن</p>
                <button class="btn-submit-luxury" onclick="window.location.href='index.html'" 
                        style="margin-top:20px; width:auto; padding:12px 32px;">
                    تصفح الوحدات
                </button>
            </div>`;
        return;
    }

    container.innerHTML = bookings.map(b => renderBookingCard(b)).join('');
}

function renderBookingCard(b) {
    const statusMap = {
        pending: { label: "⏳ قيد المراجعة", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.12)", border: "rgba(245, 158, 11, 0.3)" },
        approved: { label: "✅ مؤكد ومفعّل", color: "#10b981", bg: "rgba(16, 185, 129, 0.12)", border: "rgba(16, 185, 129, 0.3)" },
        rejected: { label: "❌ مرفوض", color: "#ef4444", bg: "rgba(239, 68, 68, 0.12)", border: "rgba(239, 68, 68, 0.3)" }
    };
    const s = statusMap[b.status] || statusMap.pending;
    const createdDate = b.createdAt ? new Date(b.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

    return `
    <div class="booking-card" style="border-right: 4px solid ${s.color};">
        <div class="booking-card-header">
            <div>
                <span class="booking-badge" style="background:${s.bg}; color:${s.color}; border:1px solid ${s.border};">
                    ${s.label}
                </span>
            </div>
            <span class="booking-id">#${b.id.slice(-6).toUpperCase()}</span>
        </div>
        
        <h3 class="booking-title">${b.housingTitle || 'وحدة سكنية'}</h3>
        
        <div class="booking-meta">
            <div class="meta-item">
                <i class="fa-solid fa-bed"></i>
                <span>${b.bedLabel || 'سرير'}</span>
            </div>
            <div class="meta-item">
                <i class="fa-solid fa-calendar-check"></i>
                <span>الاستلام: ${b.checkInDate || '—'}</span>
            </div>
            <div class="meta-item">
                <i class="fa-solid fa-calendar-xmark"></i>
                <span>المغادرة: ${b.checkOutDate || '—'}</span>
            </div>
            <div class="meta-item">
                <i class="fa-solid fa-clock"></i>
                <span>حُجز: ${createdDate}</span>
            </div>
        </div>

        ${b.notes ? `<div class="booking-notes"><i class="fa-solid fa-note-sticky"></i> ${b.notes}</div>` : ''}

        <div class="booking-actions">
            ${b.status === 'approved' 
                ? `<a href="https://wa.me/201000000000?text=استفسار عن حجز ${b.id.slice(-6)}" target="_blank" class="btn-mini btn-success">
                    <i class="fa-brands fa-whatsapp"></i> تواصل مع المالك
                   </a>`
                : b.status === 'pending'
                ? `<span class="btn-mini btn-pending-info"><i class="fa-solid fa-hourglass-half"></i> بانتظار المراجعة</span>`
                : `<button class="btn-mini btn-danger-outline" onclick="deleteBooking('${b.id}')">
                    <i class="fa-solid fa-trash"></i> إزالة
                   </button>`
            }
        </div>
    </div>`;
}

async function deleteBooking(id) {
    if (!confirm("هل أنت متأكد من إزالة هذا الحجز؟")) return;
    try {
        const { remove } = await import("./firebase-config.js");
        await remove(ref(db, `bookings/${id}`));
        showToast("تم حذف الحجز", "info");
    } catch (err) {
        showToast("فشل الحذف", "error");
    }
}

function filterBookings(status, btn) {
    document.querySelectorAll(".filter-chips .chip").forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    const filtered = status === 'all' ? allBookings : allBookings.filter(b => b.status === status);
    renderBookings(filtered);
}

window.filterBookings = filterBookings;
window.deleteBooking = deleteBooking;
