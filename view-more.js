import { auth } from "./firebase-config.js";
import { listenToHousings, listenToSections, listenToFavorites, toggleFavorite } from "./data-service.js";
import { showToast, onAuthStateChanged } from "./auth.js";

let allHousings = [];
let currentUser = null;
let userFavorites = [];
let activeFilter = "all";
let currentSectionId = null;

onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        listenToFavorites(user.uid, (favs) => {
            userFavorites = favs;
            renderViewMore();
        });
    } else {
        userFavorites = [];
        renderViewMore();
    }
});

document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    currentSectionId = params.get("category");

    listenToHousings((housings) => {
        allHousings = housings.map(h => ({
            id: h.id,
            title: h.title,
            location: h.address || h.city,
            city: h.city,
            price: h.price,
            gender: h.gender?.includes("طالبات") ? "girls" : h.gender?.includes("طلاب") ? "boys" : "all",
            isLuxury: h.price > 2000,
            image: h.images?.[0] || "https://via.placeholder.com/600x400?text=SAKANI-X",
            amenities: h.amenities || [],
            description: h.description || "",
            phone: h.phone,
            beds: h.beds || [],
            section: h.section || ""
        }));

        if (currentSectionId) {
            listenToSections((sections) => {
                const section = sections.find(s => s.id === currentSectionId);
                if (section) {
                    document.getElementById("pageTitle").innerText = section.name;
                }
            });
        }

        renderViewMore();
    });
});

function renderViewMore() {
    const container = document.getElementById("viewMoreContainer");
    if (!container) return;

    let filtered = allHousings;
    
    // فلترة حسب القسم
    if (currentSectionId) {
        filtered = filtered.filter(h => h.section === currentSectionId);
    }

    // فلترة حسب البحث
    const query = document.getElementById("searchInput")?.value.toLowerCase() || "";
    if (query) {
        filtered = filtered.filter(p => 
            p.title?.toLowerCase().includes(query) || 
            p.location?.toLowerCase().includes(query)
        );
    }

    // فلترة حسب الجنس
    if (activeFilter === "luxury") {
        filtered = filtered.filter(p => p.isLuxury);
    } else if (activeFilter !== "all") {
        filtered = filtered.filter(p => p.gender === activeFilter);
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="text-center py-16 px-4 text-slate-400 col-span-full">
                <i class="fa-solid fa-building text-5xl mb-4 opacity-30"></i>
                <h3 class="text-lg font-bold text-slate-900 mb-1">لا توجد وحدات مطابقة</h3>
                <p class="text-sm">جرّب فلتر مختلف أو ابحث بكلمة أخرى</p>
            </div>`;
        return;
    }

    container.innerHTML = filtered.map(item => {
        const isFav = userFavorites.includes(item.id);
        const genderClass = item.gender === 'girls' ? 'bg-pink-500/80' : item.gender === 'boys' ? 'bg-blue-500/80' : 'bg-slate-500/80';
        const genderLabel = item.gender === 'girls' ? 'سكن طالبات' : item.gender === 'boys' ? 'سكن طلاب' : 'عائلات / موظفين';
        const totalBeds = item.beds.length;
        const availableBeds = item.beds.filter(b => b.status === 'available').length;

        return `
        <a href="details.html?id=${item.id}" class="block bg-white rounded-2xl overflow-hidden shadow-lg border border-slate-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div class="relative h-48 overflow-hidden">
                <img src="${item.image}" alt="${item.title}" class="w-full h-full object-cover transition-transform duration-500 hover:scale-105" onerror="this.src='https://via.placeholder.com/600x400?text=SAKANI-X'">
                <div class="absolute top-3 right-3 left-3 flex justify-between items-center">
                    <span class="text-white text-xs font-bold px-3 py-1 rounded-full backdrop-blur-sm ${genderClass}">${genderLabel}</span>
                    <button class="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center shadow-md transition-transform active:scale-90 ${isFav ? 'text-red-500' : 'text-slate-700'}" 
                            onclick="event.preventDefault(); event.stopPropagation(); window.handleFavToggle('${item.id}', this);">
                        <i class="fa-${isFav ? 'solid' : 'regular'} fa-heart"></i>
                    </button>
                </div>
            </div>
            <div class="p-4">
                <div class="text-lg font-extrabold text-amber-600 mb-1">${item.price?.toLocaleString()} ج.م <span class="text-xs text-slate-400 font-medium">/ شهرياً</span></div>
                <h3 class="text-base font-bold text-slate-900 mb-2">${item.title}</h3>
                <div class="flex items-center gap-2 text-sm text-slate-500 mb-3">
                    <i class="fa-solid fa-location-dot text-amber-500"></i>
                    <span>${item.location}</span>
                </div>
                <div class="flex items-center justify-between pt-3 border-t border-dashed border-slate-200">
                    <span class="text-xs font-bold ${availableBeds > 0 ? 'text-emerald-600' : 'text-red-500'}">
                        <i class="fa-solid fa-bed"></i> متبقي ${availableBeds} من أصل ${totalBeds} سرير
                    </span>
                </div>
            </div>
        </a>`;
    }).join('');
}

function filterViewMore() {
    renderViewMore();
}

function setViewMoreFilter(type, btnElement) {
    activeFilter = type;
    document.querySelectorAll('.chip').forEach(c => {
        c.classList.remove('bg-slate-900', 'text-white', 'border-slate-900');
        c.classList.add('bg-white', 'text-slate-500', 'border-slate-200');
    });
    btnElement.classList.remove('bg-white', 'text-slate-500', 'border-slate-200');
    btnElement.classList.add('bg-slate-900', 'text-white', 'border-slate-900');
    renderViewMore();
}

// كان الزرار ده بينادي على window.handleFavToggle اللي معرّفة بس في app.js،
// وصفحة "عرض المزيد" مش بتحمّل app.js خالص، فالزرار كان بيعمل لا حاجة نهائيًا.
// دلوقتي بقى عنده تنفيذ خاص بيه في نفس الملف.
async function handleFavToggle(housingId, btnEl) {
    if (!currentUser) {
        showToast("سجّل دخولك أولاً لإضافة المفضلة", "info");
        setTimeout(() => window.location.href = "index.html", 1200);
        return;
    }
    const isNowFav = await toggleFavorite(currentUser.uid, housingId);
    btnEl.classList.toggle('text-red-500', isNowFav);
    btnEl.classList.toggle('text-slate-700', !isNowFav);
    btnEl.querySelector('i').className = `fa-${isNowFav ? 'solid' : 'regular'} fa-heart`;
    showToast(isNowFav ? "تمت الإضافة للمفضلة" : "تمت الإزالة من المفضلة", "success");
}

window.filterViewMore = filterViewMore;
window.setViewMoreFilter = setViewMoreFilter;
window.handleFavToggle = handleFavToggle;
