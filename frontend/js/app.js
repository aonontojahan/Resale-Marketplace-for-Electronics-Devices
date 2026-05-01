// =============================================================
//  ReSale Marketplace — app.js
//  Handles: Auth, Nav, Listings (localStorage), Role Views, Modal
// =============================================================

// ─── Session Management ─────────────────────────────────────

function getUser() {
    const userJson = localStorage.getItem('resale_user');
    return userJson ? JSON.parse(userJson) : null;
}

function logoutUser() {
    localStorage.removeItem('resale_user');
    window.location.href = 'index.html';
}

// ─── Category Icon Map ────────────────────────────────────────

const CATEGORY_EMOJIS = {
    phone: '📱',
    laptop: '💻',
    camera: '📷',
    tablet: '📟',
    other: '🔧'
};

const STATUS_CONFIG = {
    pending: { label: '⏳ Pending Review', cls: 'badge-pending' },
    approved: { label: '✅ Approved', cls: 'badge-approved' },
    rejected: { label: '❌ Rejected', cls: 'badge-rejected' },
    sold: { label: '🤝 Sold', cls: 'badge-sold' }
};

// ─── Card Renderers ───────────────────────────────────────────

/**
 * Formats a database timestamp into a readable date and time.
 */
function formatListingDate(dateString) {
    if (!dateString) return 'Unknown Date';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';

    return date.toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

/**
 * Build a multi-image carousel HTML string for a product.
 * Falls back to a single image or placeholder if no images are available.
 */
function buildImageCarousel(product, carouselId) {
    const imgs = (product.image_urls && product.image_urls.length > 0)
        ? product.image_urls
        : (product.image_url ? [product.image_url] : []);

    if (imgs.length === 0) {
        return `<div class="card-img-placeholder">${CATEGORY_EMOJIS[product.category] || '📦'}</div>`;
    }
    if (imgs.length === 1) {
        return `<img src="http://localhost:8000${imgs[0]}" alt="${product.title}" class="card-img" onerror="this.style.display='none'">`;
    }

    // Multi-image carousel
    const slides = imgs.map((url, i) => `
        <div class="carousel-slide" style="display:${i === 0 ? 'block' : 'none'}; width:100%; height:100%;">
            <img src="http://localhost:8000${url}" alt="${product.title} - photo ${i + 1}" class="card-img" style="width:100%; height:100%; object-fit:cover;" onerror="this.style.display='none'">
        </div>`).join('');

    return `
        <div class="img-carousel" id="${carouselId}" style="position:relative; overflow:hidden;">
            ${slides}
            <button onclick="carouselPrev('${carouselId}',${imgs.length},event)" style="position:absolute;left:6px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.5);color:white;border:none;border-radius:50%;width:28px;height:28px;cursor:pointer;font-size:0.9rem;display:flex;align-items:center;justify-content:center;z-index:5;">‹</button>
            <button onclick="carouselNext('${carouselId}',${imgs.length},event)" style="position:absolute;right:6px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.5);color:white;border:none;border-radius:50%;width:28px;height:28px;cursor:pointer;font-size:0.9rem;display:flex;align-items:center;justify-content:center;z-index:5;">›</button>
            <div style="position:absolute;bottom:6px;left:50%;transform:translateX(-50%);display:flex;gap:4px;z-index:5;">
                ${imgs.map((_, i) => `<span class="carousel-dot" id="dot-${carouselId}-${i}" style="width:6px;height:6px;border-radius:50%;background:${i === 0 ? 'white' : 'rgba(255,255,255,0.5)'};cursor:pointer;" onclick="carouselGoto('${carouselId}',${imgs.length},${i},event)"></span>`).join('')}
            </div>
        </div>`;
}

/** Navigate carousel backward */
function carouselPrev(id, total, event) {
    if (event) event.stopPropagation();
    _carouselMove(id, total, -1);
}
/** Navigate carousel forward */
function carouselNext(id, total, event) {
    if (event) event.stopPropagation();
    _carouselMove(id, total, +1);
}
/** Jump to specific slide */
function carouselGoto(id, total, idx, event) {
    if (event) event.stopPropagation();
    const el = document.getElementById(id);
    if (!el) return;
    const slides = el.querySelectorAll('.carousel-slide');
    slides.forEach((s, i) => s.style.display = i === idx ? 'block' : 'none');
    for (let i = 0; i < total; i++) {
        const dot = document.getElementById(`dot-${id}-${i}`);
        if (dot) dot.style.background = i === idx ? 'white' : 'rgba(255,255,255,0.5)';
    }
    el.dataset.current = idx;
}
function _carouselMove(id, total, dir) {
    const el = document.getElementById(id);
    if (!el) return;
    const current = parseInt(el.dataset.current || '0');
    const next = (current + dir + total) % total;
    carouselGoto(id, total, next, null);
}
window.carouselPrev = carouselPrev;
window.carouselNext = carouselNext;
window.carouselGoto = carouselGoto;

/**
 * Renders a product card for the public/buyer view.
 */
function renderProductCard(product) {
    const carouselId = `carousel-${product.id}`;
    const imgHtml = buildImageCarousel(product, carouselId);

    const priceFormatted = Number(product.price).toLocaleString('en-IN');
    const needsReadMore = product.description.length > 90;
    const descHtml = needsReadMore
        ? `<div class="description-container" id="desc-container-${product.id}">
             <p class="description-text truncated" id="desc-text-${product.id}">${product.description}</p>
             <button class="read-more-btn" onclick="toggleDescription('${product.id}', event)" id="read-more-${product.id}">Read More</button>
           </div>`
        : `<p style="font-size:0.82rem; color:var(--text-muted); margin-bottom:0.8rem; line-height:1.5;">${product.description}</p>`;

    const isSold = product.status === 'sold';

    return `
        <div class="card" data-category="${product.category}" data-id="${product.id}" style="border: 1px solid var(--border); border-radius: 16px; overflow: hidden; background: var(--surface); box-shadow: 0 4px 12px rgba(0,0,0,0.05); display: flex; flex-direction: column; transition: transform 0.3s ease, box-shadow 0.3s ease;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 12px 24px rgba(0,0,0,0.1)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.05)'">
            <div style="position: relative;">
                ${imgHtml}
                <div style="position: absolute; top: 12px; left: 12px;">
                    <span style="background: rgba(255,255,255,0.95); color: #0f172a; font-weight: 800; font-size: 0.75rem; padding: 0.4rem 0.8rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); letter-spacing: 0.03em;">${product.condition.toUpperCase()}</span>
                </div>
                <div style="position: absolute; top: 12px; right: 12px;">
                    ${product.is_disputed
            ? `<span style="background: #f43f5e; color: white; font-weight: 800; font-size: 0.75rem; padding: 0.4rem 0.8rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); letter-spacing: 0.03em;">🚨 DISPUTED</span>`
            : (product.status === 'sold' || product.inventory_quantity <= 0)
                ? `<span style="background: rgba(239, 68, 68, 0.95); color: white; font-weight: 800; font-size: 0.75rem; padding: 0.4rem 0.8rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); letter-spacing: 0.03em;">SOLD</span>`
                : `<span style="background: rgba(16, 185, 129, 0.95); color: white; font-weight: 800; font-size: 0.75rem; padding: 0.4rem 0.8rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); letter-spacing: 0.03em;">AVAILABLE</span>`
        }
                </div>
            </div>
            <div class="card-content" style="padding: 1.25rem; display: flex; flex-direction: column; flex: 1;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.5rem;">
                    <h3 class="card-title" style="margin: 0; font-size: 1.15rem; font-weight: 800; line-height: 1.3; color: var(--text-primary); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${product.title}</h3>
                </div>
                <div style="display: flex; align-items: baseline; gap: 0.5rem; margin-bottom: 0.75rem;">
                    <p class="card-price" style="margin: 0; font-size: 1.6rem; font-weight: 900; background: linear-gradient(135deg, var(--primary), var(--accent-cyan)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Tk.${priceFormatted}</p>
                </div>
                <div style="display: flex; gap: 0.4rem; flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; -ms-overflow-style: none; margin-bottom: 0.75rem; align-items: center;">
                    <span style="font-size: 0.72rem; background: rgba(99,102,241,0.08); color: var(--primary); font-weight: 700; padding: 0.35rem 0.4rem; border-radius: 6px; border: 1px solid rgba(99,102,241,0.2); white-space: nowrap;">${CATEGORY_EMOJIS[product.category] || '📦'} ${product.category}</span>
                    <span style="font-size: 0.72rem; background: rgba(16,185,129,0.08); color: #10b981; font-weight: 700; padding: 0.35rem 0.4rem; border-radius: 6px; border: 1px solid rgba(16,185,129,0.2); white-space: nowrap;">Stock: ${product.inventory_quantity || 1}</span>
                    ${product.sellerTotalReviews > 0
            ? `<span style="font-size: 0.72rem; background: rgba(245,158,11,0.08); color: #d97706; font-weight: 700; padding: 0.35rem 0.4rem; border-radius: 6px; border: 1px solid rgba(245,158,11,0.2); white-space: nowrap;">⭐ ${product.sellerRating.toFixed(1)} (${product.sellerTotalReviews})</span>`
            : `<span style="font-size: 0.72rem; background: var(--bg-body); color: var(--text-muted); font-weight: 600; padding: 0.35rem 0.4rem; border-radius: 6px; border: 1px solid var(--border); white-space: nowrap;">⭐ New Seller</span>`
        }
                </div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.4rem; font-weight: 600;">
                    👤 Seller: <a href="index.html?seller=${product.seller_id}" onclick="event.stopPropagation();" style="color: var(--primary); text-decoration: none; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.textDecoration='underline'; this.style.color='var(--accent-cyan)'" onmouseout="this.style.textDecoration='none'; this.style.color='var(--primary)'">${product.sellerName}</a>
                </div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 1rem; display: flex; align-items: center; gap: 0.4rem; font-weight: 500;">
                    🕒 Posted: ${formatListingDate(product.created_at)}
                </div>
                <div style="margin-bottom: 1.25rem; flex: 1;">
                    ${descHtml}
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-top: auto;">
                    ${(product.status === 'sold' || product.inventory_quantity <= 0)
            ? `<button style="background: var(--bg-body); color: var(--text-muted); border: 1px solid var(--border); border-radius: 10px; width: 100%; font-weight: 800; padding: 0.75rem; font-size: 0.85rem; cursor: not-allowed; transition: all 0.2s;" disabled>SOLD OUT</button>`
            : `<button style="background: linear-gradient(135deg, var(--primary), var(--accent-cyan)); color: white; border: none; border-radius: 10px; width: 100%; font-weight: 800; padding: 0.75rem; font-size: 0.85rem; cursor: pointer; box-shadow: 0 4px 12px rgba(99,102,241,0.3); transition: all 0.2s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(99,102,241,0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(99,102,241,0.3)'" onclick="handleBuyClick('${product.id}')" id="buyBtn-${product.id}">Buy with Escrow</button>`
        }
                    <button style="background: transparent; color: var(--primary); border: 2px solid var(--primary); border-radius: 10px; text-align: center; font-weight: 800; width: 100%; padding: 0.65rem; font-size: 0.85rem; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='var(--primary)'; this.style.color='white'" onmouseout="this.style.background='transparent'; this.style.color='var(--primary)'" onclick="handleMessageClick('${product.id}', '${product.seller_id}')" id="msgBtn-${product.id}">Message</button>
                </div>

            </div>
        </div>`;
}

/**
 * Renders a product card in the seller's dashboard (with status + delete).
 */
function renderSellerCard(product) {
    const carouselId = `sel-carousel-${product.id}`;
    const imgHtml = buildImageCarousel(product, carouselId);

    const priceFormatted = Number(product.price).toLocaleString('en-IN');
    const statusCfg = STATUS_CONFIG[product.status] || STATUS_CONFIG['pending'];

    const needsReadMore = product.description.length > 60;
    const descHtml = needsReadMore
        ? `<div class="description-container" id="desc-container-${product.id}">
             <p class="description-text truncated" id="desc-text-${product.id}" style="font-size: 0.8rem;">${product.description}</p>
             <button class="read-more-btn" onclick="toggleDescription('${product.id}', event)" id="read-more-${product.id}">Read More</button>
           </div>`
        : `<p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.5rem; line-height:1.4;">${product.description}</p>`;

    return `
        <div class="card" data-category="${product.category}" data-id="${product.id}" data-status="${product.status}" style="border: 1px solid var(--border); border-radius: 16px; overflow: hidden; background: var(--surface); box-shadow: 0 4px 12px rgba(0,0,0,0.05); display: flex; flex-direction: column; transition: transform 0.3s ease, box-shadow 0.3s ease;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 12px 24px rgba(0,0,0,0.1)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.05)'">
            <div style="position: relative;">
                ${imgHtml}
                <div style="position: absolute; top: 12px; left: 12px;">
                    <span style="background: rgba(255,255,255,0.95); color: #0f172a; font-weight: 800; font-size: 0.75rem; padding: 0.4rem 0.8rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); letter-spacing: 0.03em;">${product.condition.toUpperCase()}</span>
                </div>
                <div style="position: absolute; top: 12px; right: 12px;">
                    ${product.is_disputed
            ? `<span class="listing-status-badge badge-rejected" style="margin: 0; box-shadow: 0 4px 6px rgba(0,0,0,0.1); color:white; background:#ef4444;">🚨 DISPUTED</span>`
            : (product.status === 'sold' || product.inventory_quantity <= 0)
                ? `<span class="listing-status-badge badge-sold" style="margin: 0; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">🤝 SOLD</span>`
                : `<span class="listing-status-badge badge-approved" style="margin: 0; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">✅ AVAILABLE</span>`
        }
                </div>
            </div>
            <div class="card-content">
                <h4 class="card-title" style="font-size:1.05rem; margin: 0.5rem 0; line-height: 1.3;">${product.title}</h4>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <p class="card-price" style="font-size:1.05rem; margin-bottom: 0;">Tk.${priceFormatted}</p>
                    <span style="font-size: 0.75rem; background: rgba(16,185,129,0.1); color: #10b981; font-weight: bold; padding: 0.25rem 0.6rem; border-radius: 4px; border: 1px solid rgba(16,185,129,0.2); white-space: nowrap;">Qty: ${product.inventory_quantity || 1}</span>
                </div>
                <div style="margin-top: 0.4rem;">
                    <small style="font-size: 0.7rem; color: var(--text-muted); display: block;">🕒 Uploaded: ${formatListingDate(product.created_at)}</small>
                </div>
                <div style="margin-top: 0.5rem;">
                    ${descHtml}
                </div>
                <div style="margin-top:auto; display:flex; gap:0.5rem;">
                    ${product.status === 'approved' && product.inventory_quantity > 0
            ? `<button class="btn-primary" style="flex:1; padding:0.4rem; font-size:0.8rem; background:linear-gradient(135deg,#10b981,#059669); border:none; border-radius:8px; color:white; font-weight:700; cursor:pointer;" onclick="markProductAsSold('${product.id}')">🤝 Mark as Sold</button>`
            : product.status === 'sold'
                ? `<button style="flex:1; padding:0.4rem; font-size:0.8rem; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.2); border-radius:8px; color:#ef4444; font-weight:700; cursor:not-allowed;" disabled>🤝 Sold</button>`
                : ''
        }
                    <button class="btn-outline" style="flex:1; padding:0.4rem; font-size:0.8rem;" onclick="deleteMyProduct('${product.id}')">🗑 Delete</button>
                </div>
            </div>
        </div>`;
}

/**
 * Renders an admin product card with Approve/Reject actions.
 */
function renderAdminCard(product) {
    const carouselId = `adm-carousel-${product.id}`;
    const imgHtml = buildImageCarousel(product, carouselId);

    const priceFormatted = Number(product.price).toLocaleString('en-IN');
    const statusCfg = STATUS_CONFIG[product.status] || STATUS_CONFIG['pending'];

    const actionBtns = product.status === 'pending' ? `
        <button class="btn-primary admin-btn-approve" onclick="adminAction('${product.id}','approved')" id="approve-${product.id}">✅ Approve</button>
        <button class="btn-outline admin-btn-reject" onclick="adminAction('${product.id}','rejected')" id="reject-${product.id}">❌ Reject</button>
    ` : `
        <button class="btn-outline admin-btn-reset" onclick="adminAction('${product.id}','pending')" id="reset-${product.id}">↩ Reset to Pending</button>
    `;

    return `
        <div class="admin-listing-card" data-status="${product.status}" data-id="${product.id}">
            <div class="admin-card-img">
                ${imgHtml}
            </div>
            <div class="admin-card-content">
                <div class="admin-card-header">
                    <div class="admin-card-info">
                        ${product.is_disputed
            ? `<span class="listing-status-badge badge-rejected" style="color:white; background:#ef4444;">🚨 DISPUTED</span>`
            : (product.status === 'sold' || product.inventory_quantity <= 0)
                ? `<span class="listing-status-badge badge-sold">🤝 SOLD</span>`
                : `<span class="listing-status-badge ${statusCfg.cls}">${statusCfg.label.toUpperCase()}</span>`
        }
                        <h4 class="admin-card-title">${product.title}</h4>
                        <p class="admin-card-price">Tk.${priceFormatted}</p>
                    </div>
                    <div class="admin-card-badges">
                        <span class="badge badge-condition" style="background: rgba(16,185,129,0.1); color: #10b981; border: 1px solid rgba(16,185,129,0.2);">Qty: ${product.inventory_quantity || 1}</span>
                        <span class="badge badge-condition">${product.condition}</span>
                        <div class="admin-card-category">${CATEGORY_EMOJIS[product.category] || '📦'} ${product.category}</div>
                    </div>
                </div>
                <p class="admin-card-desc">${product.description}</p>
                <div class="admin-card-footer">
                    <div class="admin-card-seller">
                        👤 Seller: <strong>${product.sellerName}</strong>
                        <span class="admin-card-date">🕒 ${formatListingDate(product.created_at)}</span>
                    </div>
                    <div class="admin-card-actions">
                        ${actionBtns}
                    </div>
                </div>
            </div>
        </div>`;
}

// ─── Page Renderers ───────────────────────────────────────────

/**
 * Renders public listings on index.html
 */
window.currentPublicPage = 1;
async function renderPublicListings(category = 'all', page = 1) {
    if (page === 1) window.currentPublicPage = 1;
    const grid = document.getElementById('listingsGrid');
    const emptyEl = document.getElementById('listingsEmpty');
    if (!grid) return;

    if (page === 1) {
        grid.innerHTML = '<p style="text-align:center; padding: 2rem;">Loading...</p>';
        const existingBtn = document.getElementById('loadMorePublicBtn');
        if (existingBtn) existingBtn.remove();
    }

    try {
        const options = {
            status: 'approved',
            category: category,
            page: page,
            limit: 10
        };
        if (window.currentSearchQuery) options.search_query = window.currentSearchQuery;
        const response = await window.api.getProducts(options);

        if (page === 1) grid.innerHTML = '';
        let listings = response.items || [];

        if (listings.length === 0 && page === 1) {
            grid.innerHTML = '';
            if (emptyEl) emptyEl.style.display = 'flex';
        } else {
            if (emptyEl) emptyEl.style.display = 'none';
            grid.insertAdjacentHTML('beforeend', listings.map(renderProductCard).join(''));
        }

        let loadMoreBtn = document.getElementById('loadMorePublicBtn');
        if (response.has_more) {
            if (!loadMoreBtn) {
                const btnHtml = `<div id="loadMorePublicBtn" style="text-align:center; width:100%; margin-top:2rem; grid-column: 1 / -1;"><button class="btn-outline" style="padding:0.75rem 2rem;" onclick="renderPublicListings('${category}', ${page + 1})">Load More</button></div>`;
                grid.insertAdjacentHTML('beforeend', btnHtml);
            } else {
                grid.appendChild(loadMoreBtn); // Move to bottom
                loadMoreBtn.querySelector('button').onclick = () => renderPublicListings(category, page + 1);
            }
        } else if (loadMoreBtn) {
            loadMoreBtn.remove();
        }

        const filterContainer = document.getElementById('listingsFilter');
        if (filterContainer) {
            const filterBtns = filterContainer.querySelectorAll('.filter-btn');
            filterBtns.forEach(btn => btn.style.display = 'inline-flex');
        }
    } catch (err) {
        console.error("Error loading public listings:", err);
    }
}

/**
 * Renders a seller's public store page when visiting index.html?seller=ID
 */
async function renderSellerStore(sellerId, category = 'all') {
    const grid = document.getElementById('listingsGrid');
    const emptyEl = document.getElementById('listingsEmpty');
    const storeHeader = document.getElementById('sellerStoreHeader');
    if (!grid) return;

    grid.innerHTML = '<p style="text-align:center; padding: 2rem; color: var(--text-muted);">Loading seller store...</p>';

    // Hide marketing sections when viewing a seller store
    document.querySelectorAll('.hero, .about-section, .escrow-overview-section, .safety-tips-section').forEach(el => {
        el.style.display = 'none';
    });

    try {
        const response = await window.api.getProducts({
            status: 'approved',
            seller_id: sellerId,
            category: category
        });

        let listings = response.items || response || [];
        if (Array.isArray(listings)) {
            listings = listings.filter(l => l.status === 'approved');
        }
        listings = listings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        // Get seller info from any listing
        const sellerName = listings.length > 0 ? listings[0].sellerName : 'Seller';
        const sellerInitials = sellerName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

        // Render the store header
        if (storeHeader) {
            storeHeader.style.display = 'block';
            storeHeader.innerHTML = `
                <div style="background: linear-gradient(135deg, rgba(99,102,241,0.08), rgba(34,211,238,0.05)); border: 1px solid rgba(99,102,241,0.15); border-radius: 20px; padding: 2rem; margin-bottom: 2rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1.5rem;">
                    <div style="display: flex; align-items: center; gap: 1.5rem;">
                        <div style="width: 72px; height: 72px; border-radius: 50%; background: linear-gradient(135deg, var(--primary), var(--accent-cyan)); color: white; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 1.6rem; box-shadow: 0 8px 24px rgba(99,102,241,0.3); flex-shrink: 0;">
                            ${sellerInitials}
                        </div>
                        <div>
                            <h2 style="margin: 0; font-size: 1.6rem; font-weight: 900; color: var(--text-primary); letter-spacing: -0.02em;">${sellerName}<span style="color: var(--text-muted); font-weight: 500; font-size: 0.9rem;">'s Store</span></h2>
                            <div style="display: flex; align-items: center; gap: 1rem; margin-top: 0.5rem; flex-wrap: wrap;">
                                <span style="font-size: 0.85rem; background: rgba(16,185,129,0.1); color: #10b981; font-weight: 700; padding: 0.3rem 0.8rem; border-radius: 20px; border: 1px solid rgba(16,185,129,0.2);">✅ Verified Seller</span>
                                <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">${listings.length} Product${listings.length !== 1 ? 's' : ''} Listed</span>
                            </div>
                        </div>
                    </div>
                    <a href="index.html" style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.6rem 1.2rem; background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; color: var(--text-secondary); text-decoration: none; font-weight: 700; font-size: 0.85rem; transition: all 0.2s;" onmouseover="this.style.borderColor='var(--primary)'; this.style.color='var(--primary)'" onmouseout="this.style.borderColor='var(--border)'; this.style.color='var(--text-secondary)'">
                        ← Back to All Products
                    </a>
                </div>
            `;
        }

        // Update the page title
        const listingsTitle = document.querySelector('.listings-header .section-title');
        if (listingsTitle) {
            listingsTitle.innerHTML = `<span class="text-gradient">${sellerName}</span>'s Products`;
        }

        grid.innerHTML = '';
        if (listings.length === 0) {
            if (emptyEl) {
                emptyEl.style.display = 'flex';
                const emptyTitle = emptyEl.querySelector('h3');
                const emptyDesc = emptyEl.querySelector('p');
                if (emptyTitle) emptyTitle.innerText = 'No Products Found';
                if (emptyDesc) emptyDesc.innerText = category !== 'all'
                    ? 'This seller has no products in this category.'
                    : 'This seller hasn\'t listed any products yet.';
            }
        } else {
            if (emptyEl) emptyEl.style.display = 'none';
            grid.innerHTML = listings.map(renderProductCard).join('');
        }
    } catch (err) {
        console.error('Error loading seller store:', err);
        grid.innerHTML = '<p style="text-align:center; color:red; padding:2rem;">Failed to load seller store.</p>';
    }
}
window.renderSellerStore = renderSellerStore;

/**
 * Renders seller's own listings on profile.html
 */
window.currentSellerPage = 1;
async function renderSellerListings(statusFilter = 'all', page = 1) {
    if (page === 1) window.currentSellerPage = 1;
    const grid = document.getElementById('sellerListingsGrid');
    const emptyEl = document.getElementById('sellerEmpty');
    if (!grid) return;

    const user = getUser();
    if (page === 1) {
        grid.innerHTML = '<p style="text-align:center; padding: 2rem;">Loading...</p>';
        const existingBtn = document.getElementById('loadMoreSellerBtn');
        if (existingBtn) existingBtn.remove();
    }

    try {
        const response = await window.api.getProducts({
            seller_id: user.id,
            status: statusFilter,
            page: page,
            limit: 10
        });

        if (page === 1) grid.innerHTML = '';
        let listings = response.items || [];

        if (listings.length === 0 && page === 1) {
            grid.innerHTML = '';
            if (emptyEl) emptyEl.style.display = 'flex';
        } else {
            if (emptyEl) emptyEl.style.display = 'none';
            grid.insertAdjacentHTML('beforeend', listings.map(renderSellerCard).join(''));
        }

        let loadMoreBtn = document.getElementById('loadMoreSellerBtn');
        if (response.has_more) {
            if (!loadMoreBtn) {
                const btnHtml = `<div id="loadMoreSellerBtn" style="text-align:center; width:100%; margin-top:2rem; grid-column: 1 / -1;"><button class="btn-outline" style="padding:0.75rem 2rem;" onclick="renderSellerListings('${statusFilter}', ${page + 1})">Load More</button></div>`;
                grid.insertAdjacentHTML('beforeend', btnHtml);
            } else {
                grid.appendChild(loadMoreBtn);
                loadMoreBtn.querySelector('button').onclick = () => renderSellerListings(statusFilter, page + 1);
            }
        } else if (loadMoreBtn) {
            loadMoreBtn.remove();
        }
    } catch (err) {
        console.error("Error loading seller listings:", err);
    }
}

/**
 * Renders buyer browse view on profile.html
 */
window.currentBuyerPage = 1;
async function renderBuyerListings(category = 'all', page = 1) {
    if (page === 1) window.currentBuyerPage = 1;
    const grid = document.getElementById('buyerListingsGrid');
    const emptyEl = document.getElementById('buyerEmpty');
    if (!grid) return;

    if (page === 1) {
        grid.innerHTML = '<p style="text-align:center; padding: 2rem;">Loading...</p>';
        const existingBtn = document.getElementById('loadMoreBuyerBtn');
        if (existingBtn) existingBtn.remove();
    }

    try {
        const options = {
            status: 'approved',
            category: category,
            page: page,
            limit: 10
        };
        if (window.currentSearchQuery) options.search_query = window.currentSearchQuery;
        const response = await window.api.getProducts(options);

        if (page === 1) grid.innerHTML = '';
        let listings = response.items || [];

        if (listings.length === 0 && page === 1) {
            grid.innerHTML = '';
            if (emptyEl) emptyEl.style.display = 'flex';
        } else {
            if (emptyEl) emptyEl.style.display = 'none';
            grid.insertAdjacentHTML('beforeend', listings.map(renderProductCard).join(''));
        }

        let loadMoreBtn = document.getElementById('loadMoreBuyerBtn');
        if (response.has_more) {
            if (!loadMoreBtn) {
                const btnHtml = `<div id="loadMoreBuyerBtn" style="text-align:center; width:100%; margin-top:2rem; grid-column: 1 / -1;"><button class="btn-outline" style="padding:0.75rem 2rem;" onclick="renderBuyerListings('${category}', ${page + 1})">Load More</button></div>`;
                grid.insertAdjacentHTML('beforeend', btnHtml);
            } else {
                grid.appendChild(loadMoreBtn);
                loadMoreBtn.querySelector('button').onclick = () => renderBuyerListings(category, page + 1);
            }
        } else if (loadMoreBtn) {
            loadMoreBtn.remove();
        }

        const filterContainer = document.getElementById('buyerFilter');
        if (filterContainer) {
            const filterBtns = filterContainer.querySelectorAll('.filter-btn');
            filterBtns.forEach(btn => btn.style.display = 'inline-flex');
        }
    } catch (err) {
        console.error("Error loading buyer listings:", err);
    }
}

window.currentAdminInlineStatus = 'pending';

/**
 * Renders admin listing panel directly below the grid
 */
window.currentAdminPage = 1;
async function renderAdminListings(statusFilter = 'all', page = 1) {
    if (page === 1) window.currentAdminPage = 1;
    if (statusFilter !== window.currentAdminInlineStatus) {
        window.currentAdminInlineStatus = statusFilter;
    }

    const container = document.getElementById('adminListingsContainer');
    const emptyEl = document.getElementById('adminEmpty');
    const catFilterEl = document.getElementById('adminCategoryFilter');

    if (!container) return;

    if (page === 1 && catFilterEl && statusFilter === 'approved') {
        catFilterEl.style.display = 'flex';
    } else if (page === 1 && catFilterEl) {
        catFilterEl.style.display = 'none';
        catFilterEl.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        const allBtn = catFilterEl.querySelector('.filter-btn[data-category="all"]');
        if (allBtn) allBtn.classList.add('active');
    }

    const activeCat = catFilterEl ? catFilterEl.querySelector('.filter-btn.active') : null;
    const categoryFilter = (statusFilter === 'approved' && activeCat) ? activeCat.dataset.category : 'all';

    if (page === 1) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:2rem;">Loading...</p>';
    }

    try {
        const response = await window.api.getProducts({
            status: statusFilter,
            category: categoryFilter,
            page: page,
            limit: 10
        });

        if (page === 1) container.innerHTML = '';
        if (emptyEl) emptyEl.style.display = 'none';

        let listings = response.items || [];

        let listContainer = container.querySelector('.admin-listings-list');
        if (!listContainer) {
            listContainer = document.createElement('div');
            listContainer.className = 'admin-listings-list';
            container.appendChild(listContainer);
        }

        if (listings.length === 0 && page === 1) {
            listContainer.remove();
            if (emptyEl) {
                emptyEl.style.display = 'flex';
                const emptyTitle = document.getElementById('adminEmptyTitle');
                const emptyDesc = document.getElementById('adminEmptyDesc');
                if (emptyTitle) emptyTitle.innerText = 'No Products Found';
                if (emptyDesc) emptyDesc.innerText = 'Select a category from the statistics cards above to view products.';
            }
        } else {
            listContainer.insertAdjacentHTML('beforeend', listings.map(renderAdminCard).join(''));
        }

        let loadMoreBtn = document.getElementById('loadMoreAdminBtn');
        if (response.has_more) {
            if (!loadMoreBtn) {
                const btnHtml = `<div id="loadMoreAdminBtn" style="text-align:center; width:100%; margin-top:2rem;"><button class="btn-outline" style="padding:0.75rem 2rem;" onclick="renderAdminListings('${statusFilter}', ${page + 1})">Load More</button></div>`;
                container.insertAdjacentHTML('beforeend', btnHtml);
            } else {
                container.appendChild(loadMoreBtn);
                loadMoreBtn.querySelector('button').onclick = () => renderAdminListings(statusFilter, page + 1);
            }
        } else if (loadMoreBtn) {
            loadMoreBtn.remove();
        }
    } catch (err) {
        console.error("Error loading admin listings:", err);
    }
}

/**
 * Loads and renders statistics for the admin dashboard.
 */
async function loadAdminStats() {
    try {
        const stats = await window.api.request('/stats');

        const usersEl = document.getElementById('adminStatPendingSellers');
        const buyersEl = document.getElementById('adminStatBuyers');
        const sellersEl = document.getElementById('adminStatSellers');
        const approvedEl = document.getElementById('adminStatApproved');
        const pendingEl = document.getElementById('adminStatPending');
        const rejectedEl = document.getElementById('adminStatRejected');
        const disputesStatEl = document.getElementById('adminStatDisputes');

        if (usersEl) usersEl.innerText = stats.pending_sellers || 0;
        if (buyersEl) buyersEl.innerText = stats.total_buyers || 0;
        if (sellersEl) sellersEl.innerText = stats.total_sellers || 0;
        if (approvedEl) approvedEl.innerText = stats.approved_listings || 0;
        if (pendingEl) pendingEl.innerText = stats.pending_listings || 0;
        if (rejectedEl) rejectedEl.innerText = stats.rejected_listings || 0;

        // Fetch dispute count
        const disputes = await window.api.request('/admin/disputes', 'GET');
        if (disputesStatEl) disputesStatEl.innerText = disputes.length || 0;

        // Populate Platform Revenue
        const revenueEl = document.getElementById('adminStatRevenue');
        if (revenueEl) revenueEl.innerText = `Tk.${(stats.platform_revenue || 0).toLocaleString('en-IN')}`;
    } catch (error) {
        console.error("Failed to load admin stats:", error);
    }
}

// ─── Action Handlers ──────────────────────────────────────────

async function adminAction(id, newStatus) {
    await window.api.updateProductStatus(id, newStatus);

    // Check if we are in a seller-specific view
    if (window.currentAdminInlineStatus && window.currentAdminInlineStatus.startsWith('seller_products_')) {
        const data = window.currentSellerViewData;
        if (data) {
            renderSellerProductsForAdmin(data.id, data.name, data.prevRole);
        }
    } else if (window.currentAdminInlineStatus) {
        renderAdminListings(window.currentAdminInlineStatus);
    }

    loadAdminStats();
}

async function deleteMyProduct(id) {
    if (!confirm('Are you sure you want to delete this product?')) return;
    await window.api.deleteProduct(id);
    const activeTab = document.querySelector('#sellerStatusTabs .status-tab.active');
    const filter = activeTab ? activeTab.dataset.status : 'all';
    renderSellerListings(filter);
}


function handleBuyClick(id) {
    const user = getUser();
    if (!user) {
        alert('Please log in as a Buyer to purchase this item.');
        window.location.href = 'login.html';
        return;
    }
    if (user.role === 'seller') {
        alert('Sellers cannot buy items. Switch to a Buyer account.');
        return;
    }
    window.location.href = `wallet.html?action=buy&listing=${id}`;
}

function handleMessageClick(id, sellerId) {
    console.log("handleMessageClick:", { id, sellerId });
    const user = getUser();
    if (!user) {
        alert('Please log in to message sellers.');
        window.location.href = 'login.html';
        return;
    }
    if (user.role === 'seller') {
        alert('Sellers cannot negotiate with other sellers. Switch to a Buyer account.');
        return;
    }

    if (!sellerId || sellerId === 'undefined') {
        alert("Error: Product has no seller information. Please contact support.");
        return;
    }

    // Create or retrieve existing chat session via API
    window.api.createChat(id, user.id, sellerId)
        .then(session => {
            window.location.href = `chat.html?session=${session.id}`;
        })
        .catch(err => {
            alert("Could not initialize chat session: " + err.message);
        });
}

// ─── Admin Users Inline Listing ──────────────────────────────────

async function renderAdminUsers(role) {
    if (role !== window.currentAdminInlineStatus) {
        window.currentAdminInlineStatus = role;
    }

    // Safeguard to prevent rendering full user list for 'Total Users'
    if (role === 'users') {
        const container = document.getElementById('adminListingsContainer');
        if (container) container.innerHTML = '';
        return;
    }

    const container = document.getElementById('adminListingsContainer');
    const emptyEl = document.getElementById('adminEmpty');
    const catFilterEl = document.getElementById('adminCategoryFilter');

    if (!container) return;

    if (catFilterEl) catFilterEl.style.display = 'none';

    container.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:2rem;">Loading...</p>';
    if (emptyEl) emptyEl.style.display = 'none';

    try {
        const fetchRole = role === 'buyers' ? 'buyer' : role === 'sellers' ? 'seller' : role === 'pending_sellers' ? 'seller' : null;
        let users = await window.api.getUsers(fetchRole);

        if (role === 'pending_sellers') {
            users = users.filter(u => u.account_status === 'pending_verification');
        }

        if (users.length === 0) {
            container.innerHTML = '';
            if (emptyEl) {
                emptyEl.style.display = 'flex';
                const emptyTitle = document.getElementById('adminEmptyTitle');
                const emptyDesc = document.getElementById('adminEmptyDesc');
                if (emptyTitle) emptyTitle.innerText = 'No Users Found';
                if (emptyDesc) emptyDesc.innerText = 'There are no users to display for this category.';
            }
            return;
        }

        container.innerHTML = `<div style="display: flex; flex-direction: column; gap: 1rem; max-width: 800px; margin: 0 auto; width: 100%;">` + users.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(u => {
            const isPending = u.account_status === 'pending_verification';
            const isBanned = u.account_status === 'banned';

            let statusBadge = '';
            if (isPending) statusBadge = `<span style="font-size: 0.75rem; padding: 0.2rem 0.6rem; border-radius: 20px; background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.2); color: #3b82f6; font-weight: 600;">NEW SELLER (PENDING)</span>`;
            else if (isBanned) statusBadge = `<span style="font-size: 0.75rem; padding: 0.2rem 0.6rem; border-radius: 20px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); color: #ef4444; font-weight: 600;">BANNED</span>`;

            // Verification Section for Admins
            let verificationSection = '';
            if (isPending && u.role === 'seller') {
                verificationSection = `
                <div style="margin-top: 1rem; padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px;">
                    <div style="margin-top: 0.75rem; font-size: 0.85rem; color: var(--text-muted); background: rgba(0,0,0,0.2); padding: 0.75rem; border-radius: 6px;">
                        <p style="margin:0;"><strong>🆔 NID Number:</strong> ${u.nid_number || 'Not Provided'}</p>
                    </div>
                    <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
                        <button class="btn-primary" style="background:linear-gradient(135deg,#10b981,#059669); flex:1;" onclick="applyVerification('${u.id}', 'approve_seller')">✅ Approve Account</button>
                        <button class="btn-outline" style="border-color:#ef4444; color:#ef4444; flex:1;" onclick="applyVerification('${u.id}', 'permanent_ban')">❌ Reject & Ban</button>
                    </div>
                </div>`;
            }

            return `
            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; transition: transform 0.2s ease;" onmouseover="this.style.transform='translateY(-2px)';" onmouseout="this.style.transform='translateY(0)';">
                <div style="display: flex; align-items: flex-start; gap: 1.5rem;">
                    <div style="width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, var(--accent-cyan), var(--accent-blue)); color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1.5rem; flex-shrink: 0; box-shadow: 0 4px 6px rgba(0,0,0,0.2);">
                        ${u.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                    </div>
                    <div style="flex: 1;">
                        <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom: 0.25rem;">
                            ${u.role === 'seller' ?
                    `<h4 style="margin: 0; font-size: 1.15rem; color: var(--accent-cyan); cursor: pointer; text-decoration: none;" 
                                    onclick="renderSellerProductsForAdmin(${u.id}, '${u.full_name.replace(/'/g, "\\'")}', '${role}')"
                                    onmouseover="this.style.textDecoration='underline'" 
                                    onmouseout="this.style.textDecoration='none'"
                                    title="View this seller's products">
                                    ${u.full_name}
                                 </h4>` :
                    `<h4 style="margin: 0; font-size: 1.15rem; color: var(--text-primary);">${u.full_name}</h4>`
                }
                            <span style="font-size: 0.75rem; padding: 0.2rem 0.6rem; border-radius: 20px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--text-muted); text-transform:uppercase; font-weight: 600;">${u.role}</span>
                            ${statusBadge}
                        </div>
                        <p style="margin: 0; font-size: 0.95rem; color: var(--text-muted); margin-bottom: 0.5rem;">📧 <a href="mailto:${u.email}" style="color: var(--accent-cyan); text-decoration:none;">${u.email}</a> &nbsp;|&nbsp; 📱 ${u.phone_number || 'No Phone'}</p>
                        
                        ${!isPending && u.role !== 'buyer' ? `
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <select id="action-select-${u.id}" class="form-input" style="padding: 0.4rem 0.75rem; font-size: 0.85rem; width: auto; background: var(--bg-body); border-color: var(--border);">
                                <option value="">-- Select Action --</option>
                                <option value="ban_listings_7_days">🚫 Ban from listing (7 days)</option>
                                <option value="suspend_15_days">⏳ Suspend Account (15 days)</option>
                                <option value="permanent_ban">❌ Permanent Ban</option>
                                <option value="remove_restrictions">✅ Remove Restrictions</option>
                            </select>
                            <button class="btn-primary" style="padding: 0.4rem 1rem; font-size: 0.85rem;" onclick="takeAdminUserAction(${u.id})">Apply</button>
                        </div>
                        ` : ''}
                    </div>
                    <div style="text-align: right; background: rgba(255,255,255,0.02); padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); align-self: flex-start;">
                        <p style="margin: 0; font-size: 0.8rem; color: var(--text-muted); text-transform:uppercase; letter-spacing:0.05em;">Joined</p>
                        <p style="margin: 0; font-size: 1rem; font-weight: 600; color: var(--text-secondary);">${new Date(u.created_at).toLocaleDateString('en-GB')}</p>
                    </div>
                </div>
                ${verificationSection}
            </div>
            `;
        }).join('') + `</div>`;
    } catch (err) {
        container.innerHTML = `<p style="text-align:center; color:red; padding:2rem;">Error loading users: ${err.message}</p>`;
    }
}

/**
 * Renders products for a specific seller (Admin View)
 */
async function renderSellerProductsForAdmin(sellerId, sellerName, previousRole = 'sellers', page = 1) {
    if (page === 1) {
        window.currentAdminInlineStatus = `seller_products_${sellerId}`;
        window.currentSellerViewData = { id: sellerId, name: sellerName, prevRole: previousRole };
    }

    const container = document.getElementById('adminListingsContainer');
    const emptyEl = document.getElementById('adminEmpty');
    const catFilterEl = document.getElementById('adminCategoryFilter');

    if (!container) return;
    if (catFilterEl) catFilterEl.style.display = 'none';

    if (page === 1) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:2rem;">Loading seller products...</p>';
        const existingBtn = document.getElementById('loadMoreAdminSellerBtn');
        if (existingBtn) existingBtn.remove();
    }

    try {
        const response = await window.api.getProducts({
            seller_id: sellerId,
            page: page,
            limit: 10
        });

        if (emptyEl) emptyEl.style.display = 'none';

        let listings = response.items || [];
        const totalCount = response.total || 0;

        const backBtnHtml = `
            <div id="sellerViewHeader" style="margin-bottom: 2.5rem; display: flex; align-items: center; justify-content: space-between; background: var(--surface); padding: 1.75rem; border-radius: 20px; border: 1px solid var(--border); border-left: 6px solid var(--primary); box-shadow: var(--shadow-sm); transition: all 0.3s ease;">
                <div style="display: flex; align-items: center; gap: 1.5rem;">
                    <div style="width: 56px; height: 56px; background: rgba(99, 102, 241, 0.08); color: var(--primary); border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 1.6rem; border: 1px solid rgba(99, 102, 241, 0.15);">
                        🏪
                    </div>
                    <div>
                        <h3 style="margin: 0; font-size: 1.6rem; font-weight: 900; color: var(--secondary); letter-spacing: -0.03em;">Products by <span class="text-gradient">${sellerName}</span></h3>
                        <p style="margin: 0.25rem 0 0; font-size: 0.95rem; color: var(--text-muted); font-weight: 500;">Managing and reviewing live listings for this verified seller</p>
                    </div>
                </div>
                <div style="text-align: right;">
                    <span style="display: inline-block; padding: 0.6rem 1.4rem; border-radius: 99px; background: rgba(99, 102, 241, 0.08); color: var(--primary); font-weight: 800; font-size: 0.85rem; letter-spacing: 0.06em; border: 1px solid rgba(99, 102, 241, 0.15); box-shadow: 0 2px 4px rgba(99, 102, 241, 0.05);">${totalCount} TOTAL POSTS</span>
                </div>
            </div>
        `;

        if (page === 1) container.innerHTML = backBtnHtml;

        let listContainer = container.querySelector('.admin-listings-list');
        if (!listContainer) {
            listContainer = document.createElement('div');
            listContainer.className = 'admin-listings-list';
            container.appendChild(listContainer);
        }

        if (listings.length === 0 && page === 1) {
            listContainer.remove();
            if (emptyEl) {
                emptyEl.style.display = 'flex';
                const emptyTitle = document.getElementById('adminEmptyTitle');
                const emptyDesc = document.getElementById('adminEmptyDesc');
                if (emptyTitle) emptyTitle.innerText = 'No Products Found';
                if (emptyDesc) emptyDesc.innerText = `${sellerName} hasn't posted any products yet.`;
            }
        } else {
            listContainer.insertAdjacentHTML('beforeend', listings.map(renderAdminCard).join(''));
        }

        let loadMoreBtn = document.getElementById('loadMoreAdminSellerBtn');
        if (response.has_more) {
            if (!loadMoreBtn) {
                const btnHtml = `<div id="loadMoreAdminSellerBtn" style="text-align:center; width:100%; margin-top:2rem;"><button class="btn-outline" style="padding:0.75rem 2rem;" onclick="renderSellerProductsForAdmin(${sellerId}, '${sellerName.replace(/'/g, "\\'")}', '${previousRole}', ${page + 1})">Load More</button></div>`;
                container.insertAdjacentHTML('beforeend', btnHtml);
            } else {
                container.appendChild(loadMoreBtn);
                loadMoreBtn.querySelector('button').onclick = () => renderSellerProductsForAdmin(sellerId, sellerName, previousRole, page + 1);
            }
        } else if (loadMoreBtn) {
            loadMoreBtn.remove();
        }
    } catch (err) {
        if (page === 1) container.innerHTML = `<p style="text-align:center; color:red; padding:2rem;">Error: ${err.message}</p>`;
        else console.error(err);
    }
}


async function applyVerification(userId, action) {
    try {
        await window.api.adminUserAction(userId, action);
        showToast(action === 'approve_seller' ? '✅ Seller approved!' : '❌ Seller rejected.');
        renderAdminUsers('pending_sellers');
        loadAdminStats();
    } catch (err) {
        alert("Failed: " + err.message);
    }
}

window.applyVerification = applyVerification;

async function takeAdminUserAction(userId) {
    const select = document.getElementById(`action-select-${userId}`);
    if (!select || !select.value) {
        alert("Please select an action first.");
        return;
    }

    const action = select.value;
    if (action === 'permanent_ban' && !confirm("Are you sure you want to permanently ban this user? Their account will be closed and all their products will be permanently deleted.")) {
        return;
    }

    try {
        await window.api.adminUserAction(userId, action);
        alert("Action applied successfully!");
        if (window.currentAdminInlineStatus) {
            renderAdminUsers(window.currentAdminInlineStatus);
        }
        loadAdminStats();
    } catch (err) {
        alert("Failed to apply action: " + err.message);
    }
}

// ─── Navigation ───────────────────────────────────────────────

function updateNav() {
    const nav = document.querySelector('nav');
    if (!nav) return;

    const logoEl = document.querySelector('.logo');
    if (logoEl) logoEl.innerText = 'ReSale.';

    const user = getUser();
    const currentPath = window.location.pathname;

    if (user) {
        const role = user.role || 'buyer';
        let navHtml = '';

        const searchBar = document.getElementById('globalSearchBar');
        if (role === 'admin') {
            if (searchBar) searchBar.parentElement.style.display = 'none';
            navHtml += `
                <a href="profile.html" class="${currentPath.includes('profile') ? 'active' : ''}">Admin Panel</a>
            `;
        } else if (role === 'seller') {
            if (searchBar) searchBar.parentElement.style.display = 'none';
            navHtml += `
                <a href="profile.html" class="${currentPath.includes('profile') ? 'active' : ''}">My Products</a>
            `;
        } else {
            // Buyer
            if (searchBar) searchBar.parentElement.style.display = 'block';
            navHtml += `
                <a href="index.html" class="${currentPath.includes('index') || currentPath === '/' ? 'active' : ''}">Browse</a>
            `;
        }


        navHtml += `
            <a href="profile.html" class="nav-user-container">
                <div class="nav-user">
                    <span class="nav-username">${user.full_name.split(' ')[0]}</span>
                    <div class="nav-avatar">${user.initials}</div>
                </div>
            </a>
        `;
        nav.innerHTML = navHtml;

        // Dynamic Footer and Empty State Updates
        const emptyBtn = document.getElementById('emptySignupBtn');
        if (emptyBtn) {
            if (role === 'seller') {
                emptyBtn.href = 'profile.html';
                emptyBtn.innerText = 'Go to Dashboard to Upload Product →';
            } else {
                emptyBtn.style.display = 'none';
            }
        }

        // Update Footer dynamically
        updateFooter();

        // Initial unread count update
        if (role !== 'admin') {
            updateGlobalUnreadCount();
        }
    } else {
        const searchBar = document.getElementById('globalSearchBar');
        if (searchBar) searchBar.parentElement.style.display = 'block';
        nav.innerHTML = `
            <a href="index.html#about">About Us</a>
            <a href="index.html#escrow">How It Works</a>
            <a href="login.html" class="${window.location.pathname.includes('login') ? 'active' : ''}">Login</a>
            <a href="signup.html" class="${window.location.pathname.includes('signup') ? 'active' : ''}">Sign Up</a>
        `;
    }
}

// ─── Auth ─────────────────────────────────────────────────────

async function loginUser(email, password, role) {
    try {
        const response = await window.api.request('/auth/login', 'POST', { email, password });
        const user = await window.api.getMe(response.access_token);

        if (user.role !== role) {
            alert(`Access denied. Your account is registered as "${user.role}", not "${role}". Please select the correct role.`);
            return;
        }

        const userData = {
            ...user,
            initials: user.full_name.split(' ').map(n => n[0]).join('').toUpperCase(),
            token: response.access_token
        };
        localStorage.setItem('resale_user', JSON.stringify(userData));
        window.location.href = 'profile.html';
    } catch (error) {
        alert('Login failed: ' + error.message);
    }
}

async function signupUser(name, phone, email, password, role, address_region, address_city, address_area, address_full) {
    const signupData = {
        full_name: name,
        phone_number: phone,
        email: email,
        password: password,
        role: role,
        address_region: address_region,
        address_city: address_city,
        address_area: address_area,
        address_full: address_full
    };

    try {
        await window.api.signup(signupData);
        if (role === 'seller') {
            alert('🎉 Sign-up successful! Your account is now pending admin approval. You can login once verified.');
            window.location.href = 'login.html';
        } else {
            await loginUser(email, password, role);
        }
    } catch (error) {
        console.error("Signup Error:", error);
        const errorMsg = error.detail ? (Array.isArray(error.detail) ? error.detail.map(d => d.msg).join(', ') : error.detail) : error.message;
        alert('Signup failed: ' + errorMsg);
    }
}

// ─── Modal Helpers ────────────────────────────────────────────

function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// ─── DOMContentLoaded ─────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    updateNav();
    updateFooter();

    const user = getUser();

    // ── App-view mode on index.html (hide marketing for logged-in users)
    if (user) {
        document.body.classList.add('app-view');
    }

    // ──────────────────────────────────────────────────────────
    //  INDEX.HTML — Public Listings + Filter
    // ──────────────────────────────────────────────────────────
    const globalSearch = document.getElementById('globalSearchBar');
    let searchTimeout;
    if (globalSearch) {
        globalSearch.addEventListener('keyup', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                window.currentSearchQuery = e.target.value;
                if (document.getElementById('buyerListingsGrid')) {
                    const activeCat = document.querySelector('#buyerFilter .filter-btn.active');
                    renderBuyerListings(activeCat ? activeCat.dataset.category : 'all');
                } else if (document.getElementById('listingsGrid')) {
                    const activeCat = document.querySelector('#listingsFilter .filter-btn.active');
                    renderPublicListings(activeCat ? activeCat.dataset.category : 'all');
                }
            }, 300);
        });
    }

    const listingsGrid = document.getElementById('listingsGrid');
    if (listingsGrid) {
        // Check if we're viewing a specific seller's store
        const urlParams = new URLSearchParams(window.location.search);
        const sellerIdParam = urlParams.get('seller');
        if (sellerIdParam) {
            renderSellerStore(parseInt(sellerIdParam));
        } else {
            renderPublicListings('all');
        }

        // Filter buttons
        const filterBtns = document.querySelectorAll('#listingsFilter .filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const sp = new URLSearchParams(window.location.search).get('seller');
                if (sp) {
                    renderSellerStore(parseInt(sp), btn.dataset.category);
                } else {
                    renderPublicListings(btn.dataset.category);
                }
            });
        });
    }

    // ──────────────────────────────────────────────────────────
    //  INDEX.HTML — Live Stats from Backend (/stats)
    // ──────────────────────────────────────────────────────────
    const statTotalUsers = document.getElementById('statTotalUsers');
    const statSellers = document.getElementById('statSellers');
    const statSatisfaction = document.getElementById('statSatisfaction');
    const statAvgSale = document.getElementById('statAvgSale');
    const statUserBreakdown = document.getElementById('statUserBreakdown');

    if (statTotalUsers) {
        loadLiveStats();
    }

    // ──────────────────────────────────────────────────────────
    //  PROFILE.HTML — Role-Based Views
    // ──────────────────────────────────────────────────────────
    const sellerView = document.getElementById('sellerView');
    const buyerView = document.getElementById('buyerView');
    const adminView = document.getElementById('adminView');

    if (sellerView || buyerView || adminView) {
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        const role = user.role || 'buyer';

        // Fill profile sidebar
        const userNameEl = document.getElementById('userName');
        const userEmailEl = document.getElementById('userEmail');
        const userInitialsEl = document.getElementById('userInitials');
        const userRoleBadgeEl = document.getElementById('userRoleBadge');

        if (userNameEl) userNameEl.innerText = user.full_name;
        if (userEmailEl) userEmailEl.innerText = user.email;
        if (userInitialsEl) userInitialsEl.innerText = user.initials;
        if (userRoleBadgeEl) {
            userRoleBadgeEl.innerHTML = `<span class="badge-role badge-${role}">${role}</span>`;
        }

        // Hide wallet/messages for admin
        const walletMenu = document.querySelector('.profile-menu-item[href="wallet.html"]');
        const chatMenu = document.querySelector('.profile-menu-item[href="chat.html"]');
        const platformWalletMenu = document.getElementById('menuPlatformWallet');
        
        if (role === 'admin') {
            if (walletMenu) walletMenu.style.display = 'none';
            if (chatMenu) chatMenu.style.display = 'none';
            if (platformWalletMenu) platformWalletMenu.style.display = 'block';
        } else {
            if (walletMenu) walletMenu.style.display = 'flex';
            if (chatMenu) chatMenu.style.display = 'flex';
            if (platformWalletMenu) platformWalletMenu.style.display = 'none';
        }

        // Show the correct view
        if (role === 'seller' && sellerView) {
            sellerView.style.display = 'block';
            renderSellerListings('all');

            // Seller status tabs
            const tabs = document.querySelectorAll('#sellerStatusTabs .status-tab');
            const listingsGrid = document.getElementById('sellerListingsGrid');
            const reviewsContainer = document.getElementById('sellerReviewsContainer');
            const emptyState = document.getElementById('sellerEmpty');

            tabs.forEach(tab => {
                tab.addEventListener('click', async () => {
                    tabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    
                    const status = tab.dataset.status;
                    if (status === 'reviews') {
                        if (listingsGrid) listingsGrid.style.display = 'none';
                        if (emptyState) emptyState.style.display = 'none';
                        if (reviewsContainer) {
                            reviewsContainer.style.display = 'block';
                            renderSellerReviews();
                        }
                    } else {
                        if (reviewsContainer) reviewsContainer.style.display = 'none';
                        if (listingsGrid) listingsGrid.style.display = 'grid';
                        renderSellerListings(status);
                    }
                });
            });

            // Open listing modal
            const openBtn = document.getElementById('openListingModalBtn');
            if (openBtn) openBtn.addEventListener('click', () => openModal('listingModal'));

        } else if (role === 'buyer' && buyerView) {
            buyerView.style.display = 'block';
            renderBuyerListings('all');

            // Buyer category filter
            const filterBtns = document.querySelectorAll('#buyerFilter .filter-btn');
            filterBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    filterBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    renderBuyerListings(btn.dataset.category);
                });
            });

        } else if (role === 'admin' && adminView) {
            adminView.style.display = 'block';
            renderAdminListings('pending');
            loadAdminStats();

            // Admin category filter
            const adminCatBtns = document.querySelectorAll('#adminCategoryFilter .filter-btn');
            adminCatBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    adminCatBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    if (window.currentAdminInlineStatus) {
                        renderAdminListings(window.currentAdminInlineStatus);
                    }
                });
            });

            // Handle Dashboard vs Platform Wallet switching
            const menuListings = document.getElementById('menuListings');
            const platformWalletView = document.getElementById('platformWalletView');
            
            if (menuListings && platformWalletMenu) {
                menuListings.addEventListener('click', (e) => {
                    e.preventDefault();
                    menuListings.classList.add('active');
                    platformWalletMenu.classList.remove('active');
                    adminView.style.display = 'block';
                    platformWalletView.style.display = 'none';
                });
                
                platformWalletMenu.addEventListener('click', (e) => {
                    e.preventDefault();
                    platformWalletMenu.classList.add('active');
                    menuListings.classList.remove('active');
                    adminView.style.display = 'none';
                    platformWalletView.style.display = 'block';
                    renderPlatformWallet();
                });
            }
        }
    }

    // ──────────────────────────────────────────────────────────
    //  LISTING MODAL — Create New Listing
    // ──────────────────────────────────────────────────────────
    const listingModal = document.getElementById('listingModal');
    let pendingImageUrls = [];
    if (listingModal) {
        // Close buttons
        const closeBtns = [
            document.getElementById('closeListingModal'),
            document.getElementById('cancelListingBtn')
        ];
        closeBtns.forEach(btn => {
            if (btn) btn.addEventListener('click', () => closeModal('listingModal'));
        });

        // Click outside to close
        listingModal.addEventListener('click', (e) => {
            if (e.target === listingModal) closeModal('listingModal');
        });

        // User List Modal Handle
        const userListCloseBtns = [
            document.getElementById('closeUserListModal'),
            document.getElementById('closeUserListBtn')
        ];
        userListCloseBtns.forEach(btn => {
            if (btn) btn.addEventListener('click', () => closeModal('userListModal'));
        });

        const userListModal = document.getElementById('userListModal');
        if (userListModal) {
            userListModal.addEventListener('click', (e) => {
                if (e.target === userListModal) closeModal('userListModal');
            });
        }

        // File upload handling
        const imagesInput = document.getElementById('listingImages');
        const previewContainer = document.getElementById('imagePreviewContainer');
        if (imagesInput && previewContainer) {
            imagesInput.addEventListener('change', (e) => {
                const files = Array.from(e.target.files).slice(0, 5); // Max 5 limit
                pendingImageUrls = [];
                previewContainer.innerHTML = '';

                files.forEach(file => {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        const base64 = ev.target.result;
                        pendingImageUrls.push(base64);

                        const imgWrapper = document.createElement('div');
                        imgWrapper.style.cssText = 'width: 60px; height: 60px; position: relative; border-radius: 4px; overflow: hidden; border: 1px solid var(--border);';

                        const img = document.createElement('img');
                        img.src = base64;
                        img.className = 'card-img';
                        img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';

                        imgWrapper.appendChild(img);
                        previewContainer.appendChild(imgWrapper);
                    };
                    reader.readAsDataURL(file);
                });
            });
        }


        const form = document.getElementById('createListingForm');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const user = getUser();
                if (!user) return;

                const formData = new FormData();
                formData.append('title', document.getElementById('listingTitle').value.trim());
                formData.append('category', document.getElementById('listingCategory').value);
                formData.append('price', document.getElementById('listingPrice').value);
                formData.append('condition', document.getElementById('listingCondition').value);
                formData.append('description', document.getElementById('listingDesc').value.trim());

                const qtyInput = document.getElementById('listingQuantity');
                formData.append('inventory_quantity', qtyInput ? qtyInput.value : 1);

                // Token is sent via Authorization header, NOT in FormData

                // Append ALL selected images (up to 5) with key 'images'
                const fileInput = document.getElementById('listingImages');
                if (fileInput && fileInput.files.length > 0) {
                    const files = Array.from(fileInput.files).slice(0, 5);
                    files.forEach(file => formData.append('images', file));
                }

                const submitBtn = document.getElementById('submitListingBtn');
                if (submitBtn) { submitBtn.disabled = true; submitBtn.innerText = 'Uploading...'; }

                try {
                    await window.api.createProduct(formData, user.token);
                    form.reset();
                    if (previewContainer) previewContainer.innerHTML = '';
                    pendingImageUrls = [];
                    closeModal('listingModal');

                    showToast('🎉 Product submitted! Awaiting admin approval.');
                    await renderSellerListings('all');

                    const tabs = document.querySelectorAll('#sellerStatusTabs .status-tab');
                    tabs.forEach(t => t.classList.remove('active'));
                    const allTab = document.getElementById('sellerTabAll');
                    if (allTab) allTab.classList.add('active');
                } catch (err) {
                    alert('Error uploading product: ' + err.message);
                } finally {
                    if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = 'Submit for Review →'; }
                }
            });
        }

    }

    // ──────────────────────────────────────────────────────────
    //  LOGIN & SIGNUP FORMS
    // ──────────────────────────────────────────────────────────
    // ── Role Selector Toggle (Signup/Login) ──────────────────────────
    const roleSelector = document.getElementById('roleSelector');
    if (roleSelector) {
        const tabs = roleSelector.querySelectorAll('.role-tab');
        const roleInput = document.getElementById('selectedRole');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const role = tab.dataset.role;
                if (roleInput) roleInput.value = role;
            });
        });
    }

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const pass = document.getElementById('password').value;
            const role = document.getElementById('selectedRole').value;
            loginUser(email, pass, role);
        });
    }

    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('name').value;
            const phone = document.getElementById('phone').value;
            const email = document.getElementById('email').value;
            const pass = document.getElementById('password').value;
            const role = document.getElementById('selectedRole').value;

            const address_region = document.getElementById('address_region') ? document.getElementById('address_region').value : null;
            const address_city = document.getElementById('address_city') ? document.getElementById('address_city').value : null;
            const address_area = document.getElementById('address_area') ? document.getElementById('address_area').value : null;
            const address_full = document.getElementById('address_full') ? document.getElementById('address_full').value : null;

            signupUser(name, phone, email, pass, role, address_region, address_city, address_area, address_full);
        });
    }

    // ──────────────────────────────────────────────────────────
    //  SEARCH BAR
    // ──────────────────────────────────────────────────────────
    const searchBar = document.getElementById('mainSearchBar') || document.querySelector('.search-bar');
    if (searchBar) {
        searchBar.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = searchBar.value.toLowerCase().trim();
                if (!query) return;
                // Filter live listings
                const grid = document.getElementById('listingsGrid');
                if (grid) {
                    window.api.getListings().then(allListings => {
                        const listings = allListings
                            .filter(l =>
                                l.status === 'approved' &&
                                (l.title.toLowerCase().includes(query) || l.description.toLowerCase().includes(query))
                            )
                            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                        if (listings.length === 0) {
                            grid.innerHTML = '';
                            const emptyEl = document.getElementById('listingsEmpty');
                            if (emptyEl) emptyEl.style.display = 'flex';
                        } else {
                            const emptyEl = document.getElementById('listingsEmpty');
                            if (emptyEl) emptyEl.style.display = 'none';
                            grid.innerHTML = listings.map(renderListingCard).join('');
                        }
                    });
                }
            }
        });
    }

    // ──────────────────────────────────────────────────────────
    //  WALLET & CHAT DYMANIC CONTENT
    // ──────────────────────────────────────────────────────────


    if (window.location.pathname.includes('chat.html') && user) {
        const chatBox = document.getElementById('chatBox');
        const sidebar = document.querySelector('.chat-sidebar');
        const chatHeader = document.querySelector('.chat-header');
        const chatForm = document.getElementById('chatForm');
        window.currentChatSocket = null;
        let activeSessionId = new URLSearchParams(window.location.search).get('session');

        function appendMessage(msg) {
            if (!chatBox) return;
            const div = document.createElement('div');
            // Use == for type-agnostic comparison or cast both to String
            const isMe = String(msg.sender_id) === String(user.id);

            // Senior Engineer Logic: Smart Dynamic Cards
            if (msg.text && msg.text.startsWith("📢 OFFER MADE:")) {
                div.className = "message-system offer-card-container";
                div.style.cssText = "align-self: center; width: 85%; margin: 1.5rem 0;";

                const priceMatch = msg.text.match(/Tk.([\d,]+)/);
                const priceLabel = priceMatch ? priceMatch[1] : 'N/A';

                div.innerHTML = `
                    <div class="offer-card" style="background: white; border: 1.5px solid var(--primary); padding: 1.25rem; border-radius: 16px; box-shadow: 0 10px 15px -3px rgba(99,102,241,0.1); border-left: 6px solid var(--primary);">
                        <div style="font-weight: 800; color: var(--primary); margin-bottom: 0.75rem; display: flex; align-items: center; justify-content: between;">
                            <span style="display:flex; align-items:center; gap:0.5rem;"><span style="font-size: 1.4rem;">🤝</span> Negotiation Offer</span>
                            <span style="font-size:0.7rem; background: #e0e7ff; padding: 2px 8px; border-radius:10px; margin-left:auto;">ACTIVE</span>
                        </div>
                        <div style="font-size: 0.95rem; color: #334155; margin-bottom: 1.25rem; line-height: 1.5;">
                            A new offer of <strong style="color:var(--primary); font-size:1.1rem;">Tk.${priceLabel}</strong> was placed for this product.
                        </div>
                        ${user.role === 'seller' ? `
                        <div class="offer-actions" style="display: flex; gap: 0.75rem;">
                            <button class="btn-primary" style="flex:1.5; padding: 0.7rem; font-weight:700; border-radius:10px;" onclick="handleCardAccept(this, '${activeSessionId}')">Accept Offer</button>
                            <button class="btn-secondary" style="flex:1; padding: 0.7rem; border-radius:10px;" onclick="handleCardReject(this, '${activeSessionId}')">Decline</button>
                        </div>` : ''}
                    </div>
                `;
            } else if (msg.text.startsWith("✅ OFFER ACCEPTED:")) {
                div.className = "message-system";
                div.style.cssText = "align-self: center; width: 85%; margin: 1rem 0;";
                const priceMatch = msg.text.match(/Tk.([\d,]+)/);
                const priceLabel = priceMatch ? priceMatch[1] : 'N/A';

                div.innerHTML = `
                    <div style="background: #ecfdf5; border: 1.5px solid #10b981; padding: 1.25rem; border-radius: 16px; border-left: 6px solid #10b981; box-shadow: 0 10px 15px -3px rgba(16,185,129,0.1);">
                        <div style="font-weight: 800; color: #10b981; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
                            <span style="font-size: 1.4rem;">🎉</span> Price Agreed!
                        </div>
                        <div style="font-size: 0.95rem; color: #064e3b; margin-bottom: 1.25rem;">
                            Seller accepted <strong>Tk.${priceLabel}</strong>. You can now finish the purchase.
                        </div>
                        ${user.role === 'buyer' ? `
                        <button class="btn-primary" style="width:100%; background: #10b981; border: none; padding: 0.8rem; color: white; font-weight: 800; border-radius: 10px; cursor: pointer; transition: transform 0.2s;" onmousedown="this.style.transform='scale(0.98)'" onmouseup="this.style.transform='scale(1)'" onclick="handleProceedToCheckout('${activeSessionId}')">Complete Purchase Now</button>
                        ` : `<div style="font-size: 0.85rem; color: #059669; font-weight: 700; background: #d1fae5; padding: 0.5rem; text-align:center; border-radius:8px;">Ready for Buyer Payment</div>`}
                    </div>
                `;
            } else if (msg.text.startsWith("💰 PAYMENT COMPLETED:")) {
                div.className = "message-system";
                div.style.cssText = "align-self: center; width: 85%; margin: 1rem 0;";

                div.innerHTML = `
                    <div style="background: #f0f9ff; border: 1.5px solid #0ea5e9; padding: 1.25rem; border-radius: 16px; border-left: 6px solid #0ea5e9; box-shadow: 0 10px 15px -3px rgba(14,165,233,0.1);">
                        <div style="font-weight: 800; color: #0ea5e9; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
                            <span style="font-size: 1.4rem;">🔐</span> Held in Escrow
                        </div>
                        <div style="font-size: 0.95rem; color: #0c4a6e; margin-bottom: 1.25rem;">
                            The payment is now safely held in Escrow. Once you receive and check the product, please release the funds to the seller.
                        </div>
                        ${user.role === 'buyer' ? `
                        <div style="font-size: 0.85rem; color: #0ea5e9; font-weight: 700; background: #e0f2fe; padding: 0.5rem; text-align:center; border-radius:8px;">Payment Secured in Escrow</div>
                        ` : `<div style="font-size: 0.85rem; color: #0ea5e9; font-weight: 700; background: #e0f2fe; padding: 0.5rem; text-align:center; border-radius:8px;">Buyer has Paid</div>`}
                    </div>
                `;
            } else if (msg.text.startsWith("📢 ORDER ALERT:")) {
                div.className = "message-system";
                div.style.cssText = "align-self: center; width: 85%; margin: 1rem 0;";

                div.innerHTML = `
                    <div style="background: #fffbeb; border: 1.5px solid #f59e0b; padding: 1.25rem; border-radius: 16px; border-left: 6px solid #f59e0b; box-shadow: 0 10px 15px -3px rgba(245,158,11,0.1);">
                        <div style="font-weight: 800; color: #d97706; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
                            <span style="font-size: 1.4rem;">📢</span> Action Required: Ship Item
                        </div>
                        <div style="font-size: 0.95rem; color: #92400e; margin-bottom: 1.25rem;">
                            The buyer has made the payment. Please prepare the item and update the shipping status.
                        </div>
                        ${user.role === 'seller' ? `
                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                            <button style="flex:1; background: #f59e0b; color: white; padding: 0.6rem; border-radius: 8px; font-weight: 700; border: none; cursor: pointer;" onclick="handleMarkProcessing('${activeSessionId}')">Mark Processing</button>
                        </div>
                        ` : `<div style="font-size: 0.85rem; color: #d97706; font-weight: 700; background: #fef3c7; padding: 0.5rem; text-align:center; border-radius:8px;">Waiting for Seller to Ship</div>`}
                    </div>
                `;
            } else if (msg.text.startsWith("⚙️ ORDER PROCESSING:")) {
                div.className = "message-system";
                div.style.cssText = "align-self: center; width: 85%; margin: 1rem 0;";
                div.innerHTML = `
                    <div style="background: #fdf4ff; border: 1.5px solid #d946ef; padding: 1.25rem; border-radius: 16px; border-left: 6px solid #d946ef;">
                        <div style="font-weight: 800; color: #c026d3; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
                            <span style="font-size: 1.4rem;">⚙️</span> Order Processing
                        </div>
                        <div style="font-size: 0.9rem; color: #86198f;">
                            The seller is currently preparing the item for shipment.
                        </div>
                        ${user.role === 'seller' ? `
                        <div style="margin-top: 1rem;">
                            <button style="width:100%; background: #d946ef; color: white; padding: 0.6rem; border-radius: 8px; font-weight: 700; border: none; cursor: pointer;" onclick="handleMarkShipped('${activeSessionId}')">Mark as Shipped</button>
                        </div>
                        ` : ''}
                    </div>
                `;
            } else if (msg.text.startsWith("🚚 ORDER SHIPPED:")) {
                div.className = "message-system";
                div.style.cssText = "align-self: center; width: 85%; margin: 1rem 0;";

                // Parse tracking data from the message
                const data = {};
                msg.text.split('\n').forEach(line => {
                    if (line.includes(': ')) {
                        const [k, v] = line.split(': ');
                        data[k.trim()] = v.trim();
                    }
                });

                div.innerHTML = `
                    <div style="background: white; border: 1px solid #e2e8f0; padding: 1.5rem; border-radius: 20px; border-top: 6px solid #6366f1; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05);">
                        <div style="font-weight: 800; color: #1e293b; margin-bottom: 1rem; display: flex; align-items: center; justify-content: space-between;">
                            <span style="display: flex; align-items: center; gap: 0.5rem;"><span style="font-size: 1.4rem;">🚚</span> Order Dispatched</span>
                            <span style="font-size: 0.65rem; background: #eef2ff; color: #6366f1; padding: 4px 10px; border-radius: 20px; text-transform: uppercase;">In Transit</span>
                        </div>
                        <div style="font-size: 0.85rem; color: #475569; display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; padding: 1rem; background: #f8fafc; border-radius: 12px; margin-bottom: 1.25rem;">
                            <div>
                                <p style="margin: 0; color: #94a3b8; font-size: 0.7rem; font-weight: 700; text-transform: uppercase;">Courier</p>
                                <p style="margin: 0.2rem 0 0 0; font-weight: 700; color: #1e293b;">${data['Courier'] || 'N/A'}</p>
                            </div>
                            <div>
                                <p style="margin: 0; color: #94a3b8; font-size: 0.7rem; font-weight: 700; text-transform: uppercase;">Tracking ID</p>
                                <p style="margin: 0.2rem 0 0 0; font-weight: 700; color: #1e293b; font-family: monospace;">${data['Tracking'] || 'N/A'}</p>
                            </div>
                            <div style="grid-column: span 2;">
                                <p style="margin: 0; color: #94a3b8; font-size: 0.7rem; font-weight: 700; text-transform: uppercase;">Dispatch Date</p>
                                <p style="margin: 0.2rem 0 0 0; font-weight: 700; color: #1e293b;">${data['Date'] || 'N/A'}</p>
                            </div>
                        </div>
                        
                        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                            <button style="background: #1e293b; color: white; border: none; padding: 0.75rem; border-radius: 10px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem; transition: all 0.2s;" onmouseover="this.style.background='#334155'" onmouseout="this.style.background='#1e293b'" onclick="handleDownloadReceipt('${activeSessionId}', ${JSON.stringify(data).replace(/"/g, '&quot;')})">
                                📥 Download Official Receipt
                            </button>
                            
                            ${user.role === 'seller' ? `
                            <button style="background: #6366f1; color: white; padding: 0.75rem; border-radius: 10px; font-weight: 700; border: none; cursor: pointer; box-shadow: 0 4px 6px -1px rgba(99,102,241,0.2);" onclick="handleMarkDelivered('${activeSessionId}')">
                                Mark as Delivered
                            </button>
                            ` : ''}
                        </div>
                    </div>
                `;
            } else if (msg.text.startsWith("📦 ORDER DELIVERED:")) {
                div.className = "message-system";
                div.style.cssText = "align-self: center; width: 85%; margin: 1rem 0;";
                div.innerHTML = `
                    <div style="background: #f0fdf4; border: 1.5px solid #22c55e; padding: 1.25rem; border-radius: 16px; border-left: 6px solid #22c55e;">
                        <div style="font-weight: 800; color: #16a34a; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
                            <span style="font-size: 1.4rem;">📦</span> Order Delivered
                        </div>
                        <div style="font-size: 0.9rem; color: #14532d; margin-bottom: 1rem;">
                            The seller has marked the order as delivered. Please check the product and release payment.
                        </div>
                        ${user.role === 'buyer' ? `
                        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                            <button class="btn-primary" style="width:100%; background: #22c55e; border: none; padding: 0.8rem; color: white; font-weight: 800; border-radius: 10px; cursor: pointer;" onclick="handleReleaseFunds('${activeSessionId}')">Confirm Receipt & Release Funds</button>
                            <button class="btn-secondary" style="width:100%; background: transparent; border: 1.5px solid #ef4444; padding: 0.6rem; color: #ef4444; font-weight: 700; border-radius: 10px; cursor: pointer;" onclick="handleReportIssue('${activeSessionId}')">⚠ Report a Problem</button>
                        </div>
                        ` : `<div style="font-size: 0.85rem; color: #16a34a; font-weight: 700; background: #d1fae5; padding: 0.5rem; text-align:center; border-radius:8px;">Waiting for Buyer Confirmation</div>`}
                    </div>
                `;
            } else if (msg.text.startsWith("⚠️ DISPUTE RAISED:")) {
                div.className = "message-system";
                div.style.cssText = "align-self: center; width: 85%; margin: 1rem 0;";
                const rawReason = msg.text.replace("⚠️ DISPUTE RAISED:", "").trim();
                const displayReason = rawReason || "No specific reason provided.";
                
                div.innerHTML = `
                    <div style="background: white; border: 1px solid #fee2e2; padding: 1.5rem; border-radius: 20px; border-top: 6px solid #ef4444; box-shadow: 0 10px 15px -3px rgba(239, 68, 68, 0.05);">
                        <div style="font-weight: 800; color: #1e293b; margin-bottom: 1rem; display: flex; align-items: center; justify-content: space-between;">
                            <span style="display: flex; align-items: center; gap: 0.5rem;"><span style="font-size: 1.4rem;">🚨</span> Dispute Raised</span>
                            <span style="font-size: 0.65rem; background: #fee2e2; color: #ef4444; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; font-weight: 800;">Frozen</span>
                        </div>
                        
                        <div style="background: #fff1f2; border-radius: 12px; padding: 1rem; margin-bottom: 1rem; border-left: 4px solid #f43f5e;">
                            <p style="margin: 0 0 0.4rem 0; color: #94a3b8; font-size: 0.7rem; font-weight: 700; text-transform: uppercase;">Stated Reason</p>
                            <p style="margin: 0; font-size: 0.95rem; color: #881337; font-weight: 600; line-height: 1.4;">"${displayReason}"</p>
                        </div>

                        <div style="font-size: 0.8rem; color: #64748b; text-align: center; font-style: italic;">
                            Funds are locked in Escrow. An administrator will review this case shortly.
                        </div>
                    </div>
                `;
            } else if (msg.text.startsWith("[REVIEW_PROMPT]:")) {
                div.className = "message-system";
                div.style.cssText = "align-self: center; width: 90%; margin: 1.5rem 0;";
                const parts = msg.text.split(':');
                const productId = parts[1];
                const productTitle = parts.slice(2).join(':');

                if (user.role === 'buyer') {
                    div.innerHTML = `
                        <div class="review-prompt-card" style="background: white; border: 1.5px solid #f59e0b; padding: 1.5rem; border-radius: 20px; border-top: 6px solid #f59e0b; box-shadow: 0 10px 15px -3px rgba(245,158,11,0.1);">
                            <div style="font-weight: 800; color: #1e293b; margin-bottom: 1rem; display: flex; align-items: center; justify-content: space-between;">
                                <span style="display: flex; align-items: center; gap: 0.5rem;"><span style="font-size: 1.4rem;">⭐️</span> Leave a Review</span>
                                <span style="font-size: 0.65rem; background: #fef3c7; color: #d97706; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; font-weight: 800;">Action Required</span>
                            </div>
                            <div style="font-size: 0.95rem; color: #334155; margin-bottom: 1.25rem; line-height: 1.5;">
                                The transaction for <strong>${productTitle}</strong> is complete. Please take a moment to rate the seller.
                            </div>
                            <div id="chatReviewForm-${productId}" style="display: flex; flex-direction: column; gap: 1rem;">
                                <div>
                                    <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #92400e; margin-bottom: 0.4rem; text-transform: uppercase;">Rating</label>
                                    <div class="star-rating" style="display: flex; gap: 0.5rem; font-size: 1.8rem; cursor: pointer; color: #f59e0b;">
                                        <span onclick="setChatStar(1, '${productId}')" id="star-${productId}-1">☆</span>
                                        <span onclick="setChatStar(2, '${productId}')" id="star-${productId}-2">☆</span>
                                        <span onclick="setChatStar(3, '${productId}')" id="star-${productId}-3">☆</span>
                                        <span onclick="setChatStar(4, '${productId}')" id="star-${productId}-4">☆</span>
                                        <span onclick="setChatStar(5, '${productId}')" id="star-${productId}-5">☆</span>
                                    </div>
                                    <input type="hidden" id="chatRatingInput-${productId}" value="0">
                                </div>
                                <div>
                                    <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #92400e; margin-bottom: 0.4rem; text-transform: uppercase;">Comment</label>
                                    <textarea id="chatComment-${productId}" style="width: 100%; border-radius: 10px; border: 1.5px solid #fde68a; padding: 0.75rem; font-size: 0.9rem; resize: vertical; background: #fffbeb;" rows="2" placeholder="How was your experience?"></textarea>
                                </div>
                                <button class="btn-primary" style="background: #f59e0b; border: none; padding: 0.8rem; border-radius: 10px; color: white; font-weight: 800; cursor: pointer; box-shadow: 0 4px 6px rgba(245,158,11,0.2);" onclick="handleChatReviewSubmit('${productId}', '${activeSessionId}', this)">Submit Review</button>
                            </div>
                        </div>
                    `;
                } else {
                    div.innerHTML = `
                        <div style="background: #f8fafc; border: 1px dashed #cbd5e1; padding: 1rem; border-radius: 12px; text-align: center; color: #64748b; font-size: 0.85rem;">
                            Waiting for buyer feedback for <strong>${productTitle}</strong>
                        </div>
                    `;
                }
            } else if (msg.text.startsWith("✅ FUNDS RELEASED:")) {
                div.className = "message-system";
                div.style.cssText = "align-self: center; width: 85%; margin: 1.5rem 0;";
                const details = msg.text.replace("✅ FUNDS RELEASED:", "").trim();
                div.innerHTML = `
                    <div style="background: white; border: 1px solid #d1fae5; padding: 1.5rem; border-radius: 20px; border-top: 6px solid #10b981; box-shadow: 0 10px 15px -3px rgba(16, 185, 129, 0.05);">
                        <div style="font-weight: 800; color: #1e293b; margin-bottom: 1rem; display: flex; align-items: center; justify-content: space-between;">
                            <span style="display: flex; align-items: center; gap: 0.5rem;"><span style="font-size: 1.4rem;">💰</span> Funds Released</span>
                            <span style="font-size: 0.65rem; background: #d1fae5; color: #059669; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; font-weight: 800;">Completed</span>
                        </div>
                        <div style="background: #f0fdf4; border-radius: 12px; padding: 1.25rem; text-align: center;">
                            <p style="margin: 0; font-size: 1rem; color: #166534; font-weight: 700; line-height: 1.4;">${details}</p>
                        </div>
                        
                        <div style="margin-top: 1rem; font-size: 0.8rem; color: #64748b; text-align: center; font-style: italic;">
                            Transaction successful. Thank you for using ReSale!
                        </div>
                    </div>
                `;
            } else if (msg.text.startsWith("⚖️ ADMIN RESOLUTION:")) {
                div.className = "message-system";
                div.style.cssText = "align-self: center; width: 85%; margin: 1.5rem 0;";
                const resDetails = msg.text.replace("⚖️ ADMIN RESOLUTION:", "").trim();
                
                div.innerHTML = `
                    <div style="background: white; border: 1px solid #e2e8f0; padding: 1.5rem; border-radius: 20px; border-top: 6px solid #0f172a; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05);">
                        <div style="font-weight: 800; color: #1e293b; margin-bottom: 1rem; display: flex; align-items: center; justify-content: space-between;">
                            <span style="display: flex; align-items: center; gap: 0.5rem;"><span style="font-size: 1.4rem;">⚖️</span> Admin Verdict</span>
                            <span style="font-size: 0.65rem; background: #f1f5f9; color: #475569; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; font-weight: 800;">Resolved</span>
                        </div>
                        
                        <div style="background: #f8fafc; border-radius: 12px; padding: 1.25rem; text-align: center; border: 1px dashed #cbd5e1; margin-bottom: 1rem;">
                            <p style="margin: 0; font-size: 1rem; color: #1e293b; font-weight: 700; line-height: 1.5;">${resDetails}</p>
                        </div>

                        <div style="font-size: 0.8rem; color: #64748b; text-align: center;">
                            This decision is final and has been applied to both wallets.
                        </div>
                    </div>
                `;
            } else if (msg.text.startsWith("🌟 REVIEW SUBMITTED:")) {
                div.className = "message-system";
                div.style.cssText = "align-self: center; width: 85%; margin: 1.5rem 0;";
                
                // Parse out the rating and comment from the text
                const lines = msg.text.split('\n');
                const ratingLine = lines[1] || "Rating: ⭐⭐⭐⭐⭐";
                const commentLine = lines.slice(2).join('\n').replace('Comment: ', '');

                div.innerHTML = `
                    <div style="background: white; border: 1px solid #fde68a; padding: 1.5rem; border-radius: 20px; border-top: 6px solid #fbbf24; box-shadow: 0 10px 15px -3px rgba(251, 191, 36, 0.1);">
                        <div style="font-weight: 800; color: #1e293b; margin-bottom: 1rem; display: flex; align-items: center; justify-content: space-between;">
                            <span style="display: flex; align-items: center; gap: 0.5rem;"><span style="font-size: 1.4rem;">🌟</span> Feedback Received</span>
                            <span style="font-size: 0.65rem; background: #fef3c7; color: #b45309; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; font-weight: 800;">Verified Purchase</span>
                        </div>
                        
                        <div style="text-align: center; margin-bottom: 1rem;">
                            <div style="font-size: 1.25rem; margin-bottom: 0.5rem;">${ratingLine.replace('Rating: ', '')}</div>
                            <div style="font-style: italic; color: #475569; font-size: 0.95rem; line-height: 1.5; padding: 0 0.5rem;">
                                "${commentLine || 'No comment provided.'}"
                            </div>
                        </div>

                        <div style="border-top: 1px solid #fef3c7; pt-0.75rem; margin-top: 1rem; font-size: 0.75rem; color: #94a3b8; text-align: center;">
                            This review is now visible on the seller's public profile.
                        </div>
                    </div>
                `;
            } else if (msg.text.startsWith("❌ OFFER REJECTED:")) {
                div.className = "message-system";
                div.style.cssText = "align-self: center; width: 85%; margin: 1rem 0;";
                div.innerHTML = `
                    <div style="background: #fef2f2; border: 1.5px solid #ef4444; padding: 1rem; border-radius: 12px; color: #991b1b; text-align: center; font-size: 0.9rem;">
                        <strong>Offer Declined:</strong> The seller did not accept this price.
                    </div>
                `;
            } else {
                div.className = `message ${isMe ? 'user' : 'seller'}`;
                div.innerText = msg.text;
            }
            chatBox.appendChild(div);
        }

        function initActiveChat(chat) {
            if (!chat) return;
            activeSessionId = chat.id.toString();
            window.currentChatProductId = chat.product_id;
            console.log(`[Chat] Initializing session: ${activeSessionId}`);

            const otherParty = user.role === 'buyer' ? chat.seller : chat.buyer;
            if (chatHeader) {
                chatHeader.innerHTML = `
                  <div style="width: 42px; height: 42px; background: #eef2ff; border-radius: 50%; border: 2px solid #6366f1; display: flex; align-items: center; justify-content: center; font-weight: 800; color: #6366f1;">
                    ${otherParty.full_name ? otherParty.full_name.split(' ').map(n => n[0]).join('').toUpperCase() : '?'}
                  </div>
                  <div>
                    <p style="font-weight: 700; color: #1e293b; margin: 0;">${otherParty.full_name}</p>
                    <p style="font-size: 0.7rem; color: #10b981; margin: 0; display:flex; align-items:center; gap:2px;">
                       <span style="width:6px; height:6px; background:#10b981; border-radius:50%"></span> Online
                    </p>
                  </div>
                `;
            }

            const bannerContainer = document.getElementById('chatListingBanner');
            if (bannerContainer) {
                const productTitle = chat.product_title || 'Product Discussion';
                const productPrice = chat.product_price || '0';
                const imgSrc = chat.product_image_url ? `http://localhost:8000${chat.product_image_url}` : '';
                const imgHtml = imgSrc ? `<img src="${imgSrc}" style="width: 44px; height: 44px; object-fit: cover; border-radius: 8px;">` : `<div style="width: 44px; height: 44px; background: #e2e8f0; border-radius: 8px; display:flex; align-items:center; justify-content:center;">📦</div>`;

                bannerContainer.innerHTML = `
                    <div style="display:flex; align-items:center; gap: 1rem; flex: 1;">
                        ${imgHtml}
                        <div>
                            <div style="font-weight: 600; font-size: 0.9rem; line-height: 1.2;">${productTitle}</div>
                            <div style="color: var(--primary); font-weight: 700; font-size: 1rem;">Tk.${Number(productPrice).toLocaleString('en-IN')}</div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        ${user.role === 'buyer' ? `<button class="btn-secondary" style="padding: 0.55rem 1rem; font-size: 0.85rem;" onclick="openOfferModal('${chat.id}', '${chat.product_id}')">🤝 Make Offer</button>` : ''}
                        ${user.role === 'buyer' ? `<button class="btn-primary" style="padding: 0.55rem 1rem; font-size: 0.85rem;" onclick="handleBuyClick('${chat.product_id}')">🛒 Buy Now</button>` : ''}
                    </div>
                `;
                bannerContainer.style.display = 'flex';
            }

            // --- LOAD MESSAGES ---
            if (chatBox) chatBox.innerHTML = '<div style="text-align:center; padding:1rem; color:#94a3b8;">Loading history...</div>';
            window.api.getChatMessages(chat.id).then(messages => {
                if (chatBox) chatBox.innerHTML = '';
                messages.forEach(msg => appendMessage(msg));
                setTimeout(() => { chatBox.scrollTop = chatBox.scrollHeight; }, 100);
            });

            // --- SOCKET MANAGEMENT ---
            if (window.currentChatSocket) {
                console.log("[Chat] Closing existing socket...");
                window.currentChatSocket.close();
            }

            const wsUrl = `ws://localhost:8000/ws/chat/${chat.id}?token=${user.token}`;
            window.currentChatSocket = new WebSocket(wsUrl);

            window.currentChatSocket.onopen = () => console.log(`[Chat] Socket connected to ${chat.id}`);
            window.currentChatSocket.onerror = (e) => console.error("[Chat] WebSocket Error:", e);

            window.currentChatSocket.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    console.log("[Chat] Received message:", msg);

                    if (String(msg.session_id) === String(activeSessionId)) {
                        appendMessage(msg);
                        requestAnimationFrame(() => {
                            if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
                        });
                        window.api.markChatRead(msg.session_id, user.id).catch(() => { });
                        refreshChatSidebar();
                    } else {
                        updateGlobalUnreadCount();
                        refreshChatSidebar();
                    }
                } catch (err) {
                    console.error("[Chat] Parse Error:", err);
                }
            };

            // ONE-TIME FORM BINDING
            if (chatForm && !chatForm.dataset.listenerAttached) {
                chatForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const input = chatForm.querySelector('#chatInput');
                    const text = input.value.trim();
                    if (!text) return;

                    if (!window.currentChatSocket || window.currentChatSocket.readyState !== WebSocket.OPEN) {
                        alert("Connection lost. Please wait or refresh.");
                        return;
                    }

                    // --- OPTIMISTIC UI: Show instantly ---
                    // (We don't append locally because we trust the fast round-trip)
                    // If round-trip is failing, we'll see console errors
                    window.currentChatSocket.send(text);
                    input.value = '';
                });
                chatForm.dataset.listenerAttached = "true";
            }
        }

        async function refreshChatSidebar() {
            if (!sidebar) return;
            try {
                const chats = await window.api.getUserChats(user.id);
                sidebar.innerHTML = '';

                if (chats.length === 0) {
                    sidebar.innerHTML = '<div style="padding:1rem;color:var(--text-muted);">No active chats</div>';
                    return;
                }

                chats.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

                chats.forEach(chat => {
                    const isBuyer = user.role === 'buyer';
                    const otherParty = isBuyer ? chat.seller : chat.buyer;
                    const otherPartyName = otherParty.full_name;
                    const otherPartyRole = isBuyer ? 'SELLER' : 'BUYER';

                    const isActive = chat.id.toString() === activeSessionId;
                    const activeClass = isActive ? 'active' : '';
                    const unreadClass = (chat.unread_count > 0 && !isActive) ? 'unread' : '';
                    const unreadBadge = (chat.unread_count > 0 && !isActive)
                        ? `<span class="unread-badge-sidebar">${chat.unread_count}</span>`
                        : '';

                    const lastMsg = chat.messages && chat.messages.length > 0 ? chat.messages[chat.messages.length - 1] : null;
                    const lastMsgSnippet = lastMsg ? (lastMsg.text.length > 25 ? lastMsg.text.substring(0, 22) + '...' : lastMsg.text) : 'No messages yet';
                    const lastMsgTime = lastMsg ? new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

                    const item = document.createElement('div');
                    item.className = `chat-list-item ${activeClass} ${unreadClass}`.trim();
                    item.style.position = 'relative';
                    item.innerHTML = `
                      <div class="chat-info" style="flex:1; min-width:0;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <div style="display:flex; align-items:center; gap:0.5rem; min-width:0;">
                                <span style="font-weight:700; font-size:0.95rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:120px;">${otherPartyName}</span>
                                ${unreadBadge}
                            </div>
                            <span style="font-size:0.65rem; background:rgba(99,102,241,0.1); color:var(--primary); padding:0.1rem 0.4rem; border-radius:4px; font-weight:800;">${otherPartyRole}</span>
                        </div>
                        <div style="font-size:0.75rem; color:var(--text-secondary); margin:0.15rem 0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${chat.product_title || 'Enquiry'}</div>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.25rem;">
                            <span class="last-msg-snippet" style="font-size:0.8rem; color:var(--text-muted); font-style:italic; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${lastMsgSnippet}</span>
                            <span style="font-size:0.7rem; color:#94a3b8;">${lastMsgTime}</span>
                        </div>
                      </div>
                      <button class="chat-delete-btn" onclick="handleChatDelete(${chat.id}, event)" title="Delete" style="opacity:0.3;">&times;</button>
                    `;
                    item.onclick = (e) => {
                        if (!e.target.classList.contains('chat-delete-btn')) {
                            window.location.href = `chat.html?session=${chat.id}`;
                        }
                    };
                    sidebar.appendChild(item);
                });

                if (activeSessionId) {
                    const currentChat = chats.find(c => c.id.toString() === activeSessionId);
                    if (currentChat) {
                        initActiveChat(currentChat);
                        window.api.markChatRead(currentChat.id, user.id).catch(err => console.error(err));
                    }
                }
                updateGlobalUnreadCount();
            } catch (err) {
                console.error('Failed to load chat sidebar:', err);
                if (sidebar) sidebar.innerHTML = '<div style="padding:1rem;color:red;">Could not load chats.</div>';
            }
        }

        // Lightweight: Re-fetches and re-renders only the sidebar list, no chat re-init.
        async function renderSidebarList() {
            if (!sidebar) return;
            try {
                const chats = await window.api.getUserChats(user.id);
                if (!chats || chats.length === 0) return;
                sidebar.innerHTML = '';
                chats.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
                chats.forEach(chat => {
                    const isBuyer = user.role === 'buyer';
                    const otherParty = isBuyer ? chat.seller : chat.buyer;
                    const otherPartyName = otherParty.full_name;
                    const otherPartyRole = isBuyer ? 'SELLER' : 'BUYER';
                    const isActive = chat.id.toString() === activeSessionId;
                    const activeClass = isActive ? 'active' : '';
                    const unreadClass = (chat.unread_count > 0 && !isActive) ? 'unread' : '';
                    const unreadBadge = (chat.unread_count > 0 && !isActive)
                        ? `<span class="unread-badge-sidebar">${chat.unread_count}</span>` : '';
                    const lastMsg = chat.messages && chat.messages.length > 0 ? chat.messages[chat.messages.length - 1] : null;
                    const lastMsgSnippet = lastMsg ? (lastMsg.text.length > 25 ? lastMsg.text.substring(0, 22) + '...' : lastMsg.text) : 'No messages yet';
                    const lastMsgTime = lastMsg ? new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                    const item = document.createElement('div');
                    item.className = `chat-list-item ${activeClass} ${unreadClass}`.trim();
                    item.style.position = 'relative';
                    item.innerHTML = `
                      <div class="chat-info" style="flex:1; min-width:0;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <div style="display:flex; align-items:center; gap:0.5rem; min-width:0;">
                                <span style="font-weight:700; font-size:0.95rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:120px;">${otherPartyName}</span>
                                ${unreadBadge}
                            </div>
                            <span style="font-size:0.65rem; background:rgba(99,102,241,0.1); color:var(--primary); padding:0.1rem 0.4rem; border-radius:4px; font-weight:800;">${otherPartyRole}</span>
                        </div>
                        <div style="font-size:0.75rem; color:var(--text-secondary); margin:0.15rem 0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${chat.product_title || 'Enquiry'}</div>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.25rem;">
                            <span class="last-msg-snippet" style="font-size:0.8rem; color:var(--text-muted); font-style:italic; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${lastMsgSnippet}</span>
                            <span style="font-size:0.7rem; color:#94a3b8;">${lastMsgTime}</span>
                        </div>
                      </div>
                      <button class="chat-delete-btn" onclick="handleChatDelete(${chat.id}, event)" title="Delete" style="opacity:0.3;">&times;</button>
                    `;
                    item.onclick = (e) => {
                        if (!e.target.classList.contains('chat-delete-btn')) {
                            window.location.href = `chat.html?session=${chat.id}`;
                        }
                    };
                    sidebar.appendChild(item);
                });
                updateGlobalUnreadCount();
            } catch (err) {
                console.error('Failed to refresh sidebar order:', err);
            }
        }

        // Initial load
        refreshChatSidebar();
    }
});

// ─── Toast Notification ───────────────────────────────────────

function showToast(message) {
    const existing = document.getElementById('resaleToast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'resaleToast';
    toast.style.cssText = `
        position: fixed; bottom: 2rem; right: 2rem; z-index: 9999;
        background: linear-gradient(135deg, #0f172a, #1e293b);
        border: 1px solid #22d3ee44;
        color: #f1f5f9; padding: 1rem 1.5rem;
        border-radius: 12px; font-size: 0.95rem; font-weight: 500;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        animation: slideInToast 0.3s ease;
        max-width: 340px; line-height: 1.4;
    `;
    toast.innerText = message;
    document.body.appendChild(toast);

    const style = document.createElement('style');
    style.textContent = `@keyframes slideInToast { from { opacity:0; transform: translateY(20px);} to { opacity:1; transform:translateY(0);} }`;
    document.head.appendChild(style);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ─── Live Stats ──────────────────────────────────────────────────

async function loadLiveStats() {
    try {
        const stats = await window.api.request('/stats', 'GET');

        animateCount('statTotalUsers', stats.total_users, '+');
        animateCount('statSellers', stats.total_sellers, '');
        animateCount('statSatisfaction', stats.satisfaction_pct, '%');
        animateCount('statAvgSale', stats.avg_sale_hours, 'h');

        const breakdown = document.getElementById('statUserBreakdown');
        if (breakdown) {
            breakdown.innerText = `(${stats.total_buyers} Buyers, ${stats.total_sellers} Sellers)`;
        }
    } catch (error) {
        console.error("Failed to load live stats:", error);
        // Fallback to static numbers if backend is down
        document.getElementById('statTotalUsers').innerText = '5K+';
        document.getElementById('statSellers').innerText = '500+';
        document.getElementById('statSatisfaction').innerText = '99%';
        document.getElementById('statAvgSale').innerText = '24h';
    }
}

function animateCount(elementId, target, suffix = '') {
    const el = document.getElementById(elementId);
    if (!el) return;

    // If target is 0, just set it
    if (target === 0) {
        el.innerText = '0' + suffix;
        return;
    }

    const duration = 1500; // ms
    const steps = 30;
    const stepTime = duration / steps;
    const increment = target / steps;
    let current = 0;

    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            el.innerText = target + suffix;
            clearInterval(timer);
        } else {
            el.innerText = Math.floor(current) + suffix;
        }
    }, stepTime);
}

async function handleChatDelete(sessionId, event) {
    if (event) event.stopPropagation();
    if (!confirm('Are you sure you want to delete this conversation? This cannot be undone.')) return;

    try {
        await window.api.deleteChat(sessionId);
        // If we are currently viewing this chat, clear the URL and reload
        const params = new URLSearchParams(window.location.search);
        const activeSessionId = params.get('session');
        if (activeSessionId === sessionId.toString()) {
            window.location.href = 'chat.html';
        } else {
            window.location.reload();
        }
    } catch (err) {
        alert("Failed to delete chat: " + err.message);
    }
}

/**
 * Dynamically updates the footer based on user session.
 * Removes irrelevant marketing and guest links, adds dashboard links.
 */
function updateFooter() {
    const footer = document.querySelector('.site-footer');
    if (!footer) return;

    const user = getUser();
    const currentPath = window.location.pathname;
    const isIndex = currentPath.includes('index.html') || currentPath.endsWith('/');

    if (!user) {
        // For guests, ensure anchor links work from any page
        const footerLinks = footer.querySelectorAll('.footer-links a');
        footerLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href && href.startsWith('#') && !isIndex) {
                link.setAttribute('href', 'index.html' + href);
            }
        });
        return;
    }

    const role = user.role || 'buyer';

    // 1. Simplify Tagline
    const tagline = footer.querySelector('p');
    if (tagline && (tagline.innerText.includes('ultimate destination') || tagline.innerText.includes('trusted destination'))) {
        tagline.innerText = 'Your secure marketplace for pre-owned electronics. Reliable, transparent, and protected by Escrow.';
    }

    // 2. Update Footer Columns
    const footerGrid = footer.querySelector('.footer-grid');
    if (footerGrid) {
        const columns = Array.from(footerGrid.children);

        // Column 2: Dashboard Links
        if (columns[1]) {
            const title = columns[1].querySelector('.footer-title');
            const list = columns[1].querySelector('.footer-links');
            if (title) title.innerText = 'Quick Access';
            if (list) {
                list.innerHTML = `
                    <li><a href="profile.html">My Dashboard</a></li>
                `;
            }
        }

        // Column 3: Resources
        if (columns[2]) {
            const title = columns[2].querySelector('.footer-title');
            const list = columns[2].querySelector('.footer-links');
            if (title) title.innerText = 'Resources';
            if (list) {
                list.innerHTML = `
                    <li><a href="index.html#listings">Browse Products</a></li>
                `;
            }
        }

        // Column 4: Newsletter/Support Cleanup
        if (columns[3]) {
            const title = columns[3].querySelector('.footer-title') || columns[3].querySelector('h4');
            if (title && (title.innerText.toLowerCase().includes('newsletter') || title.innerText.toLowerCase().includes('asistance') || title.innerText.toLowerCase().includes('assistance'))) {
                title.innerText = 'Need Assistance?';
                columns[3].innerHTML = `
                    <h4 class="footer-title">Need Assistance?</h4>
                    <ul class="footer-links">
                        <li>
                            <a href="https://wa.me/8801723740704" target="_blank" style="display: flex; align-items: center; gap: 0.5rem; color: #25d366;">
                                <span style="font-size: 1.2rem;">💬</span> WhatsApp Support
                            </a>
                        </li>
                        <li style="margin-top: 0.5rem;">
                            <a href="https://mail.google.com/mail/?view=cm&to=aonontojahan@gmail.com&su=ReSale%20Support" target="_blank" style="display: flex; align-items: center; gap: 0.5rem; color: #ea4335;">
                                <span style="font-size: 1.2rem;">📧</span> Gmail Support
                            </a>
                        </li>
                        <li style="margin-top: 1rem; border-top: 1px solid #334155; padding-top: 1rem;">
                            <a href="https://mail.google.com/mail/?view=cm&to=aonontojahan@gmail.com&su=ReSale%20Issue%20Report" target="_blank" style="color: var(--accent-cyan); font-weight: 600;">Report an Issue</a>
                        </li>
                    </ul>
                `;
            }
        }
    }
}

/**
 * Toggles the description expansion.
 */
function toggleDescription(id, event) {
    if (event) event.stopPropagation();
    const text = document.getElementById(`desc-text-${id}`);
    const btn = document.getElementById(`read-more-${id}`);

    if (text && btn) {
        const isTruncated = text.classList.contains('truncated');
        if (isTruncated) {
            text.classList.remove('truncated');
            text.classList.add('expanded');
            btn.innerText = 'Read Less';
        } else {
            text.classList.remove('expanded');
            text.classList.add('truncated');
            btn.innerText = 'Read More';
        }
    }
}

// Expose globals needed by inline onclick attributes
window.renderAdminUsers = renderAdminUsers;
window.renderSellerProductsForAdmin = renderSellerProductsForAdmin;
window.takeAdminUserAction = takeAdminUserAction;
window.renderAdminListings = renderAdminListings;
window.adminAction = adminAction;
window.deleteMyProduct = deleteMyProduct;
window.handleBuyClick = handleBuyClick;
window.logoutUser = logoutUser;
window.handleChatDelete = handleChatDelete;

// ─── Negotiation Helper Functions ───────────────────────────

window.openOfferModal = function (sessionId, productId) {
    const modal = document.getElementById('offerModal');
    if (!modal) return alert("Offer modal not found.");
    modal.style.display = 'flex';
    document.getElementById('modalOfferInput').focus();

    document.getElementById('modalSubmitOffer').onclick = async () => {
        const input = document.getElementById('modalOfferInput');
        const price = parseInt(input.value);
        if (!price || price <= 0) return alert("Please enter a valid price.");

        try {
            await window.api.createOffer(sessionId, productId, price);
            modal.style.display = 'none';
            input.value = '';
            alert("Success! Your offer has been sent to the seller.");

            // Re-focus the chat input immediately
            const chatIn = document.getElementById('chatInput');
            if (chatIn) chatIn.focus();
        } catch (e) {
            alert("Failed: " + e.message);
        }
    };
};

window.handleCardAccept = async function (btn, sessionId) {
    if (btn) btn.closest('.offer-actions').innerHTML = '<div style="color:#10b981; font-weight:700; text-align:center; flex:1;">Accepting...</div>';
    await window.handleAcceptOffer(sessionId);
};

window.handleCardReject = async function (btn, sessionId) {
    if (btn) btn.closest('.offer-actions').innerHTML = '<div style="color:#ef4444; font-weight:700; text-align:center; flex:1;">Declining...</div>';
    await window.handleRejectOffer(sessionId);
};

window.handleAcceptOffer = async function (sessionId) {
    try {
        const offersResponses = await window.api.request(`/offers?session_id=${sessionId}`, 'GET');
        const pendingOffer = offersResponses.reverse().find(o => o.status === 'pending');
        if (!pendingOffer) return alert("No pending offer found.");

        await window.api.acceptOffer(pendingOffer.id);

        // Auto-send follow-up message
        if (window.currentChatSocket && window.currentChatSocket.readyState === WebSocket.OPEN) {
            window.currentChatSocket.send("Your offer price is accepted. Payment for buy this product");
        }
        alert("Offer accepted!");
    } catch (e) {
        alert("Failed: " + e.message);
    }
};

window.handleRejectOffer = async function (sessionId) {
    if (!confirm("Are you sure you want to decline this offer?")) return;
    try {
        const offersResponses = await window.api.request(`/offers?session_id=${sessionId}`, 'GET');
        const pendingOffer = offersResponses.reverse().find(o => o.status === 'pending');
        if (!pendingOffer) return alert("No pending offer found.");

        await window.api.rejectOffer(pendingOffer.id);

        // Auto-send follow-up message
        if (window.currentChatSocket && window.currentChatSocket.readyState === WebSocket.OPEN) {
            window.currentChatSocket.send("Offer a better price");
        }
        alert("Offer rejected.");
    } catch (e) {
        alert("Failed: " + e.message);
    }
};

window.handleProceedToCheckout = async function (sessionId) {
    try {
        const offersResponses = await window.api.request(`/offers?session_id=${sessionId}`, 'GET');
        const acceptedOffer = offersResponses.reverse().find(o => o.status === 'accepted');
        if (!acceptedOffer) return alert("No accepted offer found.");
        window.location.href = `wallet.html?action=buy&listing=${acceptedOffer.product_id}&offer=${acceptedOffer.id}`;
    } catch (e) {
        alert("Redirect failed: " + e.message);
    }
};

window.handleReleaseFunds = async function (sessionId) {
    try {
        const offersResponses = await window.api.request(`/offers?session_id=${sessionId}`, 'GET');
        const activeOffer = offersResponses.reverse().find(o => ['paid', 'processing', 'shipped', 'delivered'].includes(o.status));
        if (!activeOffer) return alert("No active paid offer found to release.");

        const modal = document.getElementById('releaseModal');
        const price = parseInt(activeOffer.offered_price, 10);
        document.getElementById('releaseItemPrice').innerText = `Tk. ${price.toLocaleString()}`;
        document.getElementById('releaseTotal').innerText = `Tk. ${(price + 150).toLocaleString()}`;
        
        modal.style.display = 'flex';

        document.getElementById('modalConfirmRelease').onclick = async () => {
            try {
                await window.api.request(`/escrow/release/${activeOffer.id}`, 'POST');
                modal.style.display = 'none';

                if (window.currentChatSocket && window.currentChatSocket.readyState === WebSocket.OPEN) {
                    window.currentChatSocket.send("Product received! I've released the payment. Thank you!");
                }

                alert("Success! Funds released to seller.");
                window.location.reload();
            } catch (e) {
                alert("Release failed: " + e.message);
            }
        };
    } catch (e) {
        alert("Could not load offer: " + e.message);
    }
};

window.handleReportIssue = async function (sessionId) {
    try {
        const chats = await window.api.getUserChats(getUser().id);
        const chat = chats.find(c => c.id.toString() === sessionId);
        if (!chat) return alert("Chat session not found.");

        const offersResponses = await window.api.request(`/offers?session_id=${sessionId}`, 'GET');
        const activeOffer = offersResponses.reverse().find(o => ['paid', 'processing', 'shipped', 'delivered'].includes(o.status));
        if (!activeOffer) return alert("No active payment found to dispute.");

        const modal = document.getElementById('disputeModal');
        document.getElementById('disputeProductName').innerText = chat.product_title;
        document.getElementById('disputeAmount').innerText = `Tk. ${parseInt(activeOffer.offered_price, 10)}`;
        document.getElementById('disputeReason').value = '';

        modal.style.display = 'flex';

        document.getElementById('modalSubmitDispute').onclick = async () => {
            const reason = document.getElementById('disputeReason').value;
            if (!reason || reason.length < 10) return alert("Please provide a detailed reason (min 10 characters).");

            try {
                await window.api.disputePayment(activeOffer.id, reason);
                modal.style.display = 'none';

                if (window.currentChatSocket && window.currentChatSocket.readyState === WebSocket.OPEN) {
                    window.currentChatSocket.send('Dispute raised!');
                }

                alert("Dispute raised. The funds are now frozen.");
                window.location.reload();
            } catch (e) {
                alert(e.message);
            }
        };
    } catch (e) {
        alert(e.message);
    }
};

window.handleMarkProcessing = async function (sessionId) {
    try {
        const offersResponses = await window.api.request(`/offers?session_id=${sessionId}`, 'GET');
        const activeOffer = offersResponses.reverse().find(o => o.status === 'paid');
        if (!activeOffer) return alert("No paid offer found.");

        await window.api.request(`/escrow/process/${activeOffer.id}`, 'POST');
        if (window.currentChatSocket && window.currentChatSocket.readyState === WebSocket.OPEN) {
            window.currentChatSocket.send('Processing order...');
        }
    } catch (e) {
        alert(e.message);
    }
};

window.handleMarkShipped = async function (sessionId) {
    try {
        const chats = await window.api.getUserChats(getUser().id);
        const chat = chats.find(c => c.id.toString() === sessionId);
        if (!chat) return alert("Chat session not found.");

        const offersResponses = await window.api.request(`/offers?session_id=${sessionId}`, 'GET');
        const activeOffer = offersResponses.reverse().find(o => o.status === 'processing');
        if (!activeOffer) return alert("Order must be PROCESSING to ship.");

        // Show modal and pre-fill
        const modal = document.getElementById('shippingModal');

        // Populate inputs
        document.getElementById('shipSellerName').value = chat.seller.full_name;
        document.getElementById('shipSellerPhone').value = chat.seller.phone;
        document.getElementById('shipProductName').value = chat.product_title;
        document.getElementById('shipProductPrice').value = `Tk.${Number(activeOffer.offered_price).toLocaleString('en-IN')}`;
        document.getElementById('shipProductQty').value = activeOffer.quantity || 1;

        document.getElementById('shipBuyerName').value = chat.buyer.full_name;
        document.getElementById('shipBuyerPhone').value = chat.buyer.phone;

        document.getElementById('shipDate').value = new Date().toISOString().split('T')[0];

        modal.style.display = 'flex';

        document.getElementById('modalSubmitShipping').onclick = async () => {
            const courier = document.getElementById('shipCourierName').value;
            const tracking = document.getElementById('shipTrackingNumber').value;
            const date = document.getElementById('shipDate').value;
            const sellerPhone = document.getElementById('shipSellerPhone').value;
            const buyerPhone = document.getElementById('shipBuyerPhone').value;

            if (!courier || !tracking || !date || !sellerPhone || !buyerPhone) return alert("Please fill all required fields including contact numbers.");

            try {
                const trackingStr = `Courier: ${courier}\nTracking: ${tracking}\nDate: ${date}\nSeller: ${chat.seller.full_name}\nPhone: ${sellerPhone}\nProduct: ${chat.product_title}\nPrice: ${activeOffer.offered_price}\nQuantity: ${activeOffer.quantity || 1}\nBuyer: ${chat.buyer.full_name}\nBuyerPhone: ${buyerPhone}\nOrderID: ${activeOffer.id}`;

                await window.api.request(`/escrow/ship/${activeOffer.id}?tracking_info=` + encodeURIComponent(trackingStr), 'POST');
                modal.style.display = 'none';

                if (window.currentChatSocket && window.currentChatSocket.readyState === WebSocket.OPEN) {
                    window.currentChatSocket.send('Item shipped!');
                }
            } catch (e) {
                alert(e.message);
            }
        };
    } catch (e) {
        alert(e.message);
    }
};

window.handleDownloadReceipt = function (sessionId, data) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Premium Background/Border
    doc.setDrawColor(99, 102, 241);
    doc.setLineWidth(1.5);
    doc.rect(5, 5, 200, 287);

    // Receipt Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.setTextColor(31, 41, 55);

    const title = "RESALE MARKETPLACE";
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.text(title, pageWidth / 2, 30, { align: "center" });

    doc.setDrawColor(226, 232, 240);
    doc.line(20, 38, 190, 38);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);

    const receiptId = (data['OrderID'] || '0').toString().padStart(5, '0');
    doc.text(`RECEIPT NO: RS-${receiptId}`, 20, 45);
    doc.text(`ISSUED DATE: ${new Date().toLocaleDateString().toUpperCase()}`, 145, 45);

    // Section 1: Transaction Parties
    doc.setFillColor(248, 250, 252);
    doc.rect(20, 55, 170, 45, 'F');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(31, 41, 55);
    doc.text("SELLER DETAILS", 25, 65);
    doc.text("BUYER DETAILS", 110, 65);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(`Name: ${data['Seller'] || 'N/A'}`, 25, 75);
    doc.text(`Phone: ${data['Phone'] || 'N/A'}`, 25, 82);

    doc.text(`Name: ${data['Buyer'] || 'N/A'}`, 110, 75);
    doc.text(`Phone: ${data['BuyerPhone'] || 'N/A'}`, 110, 82);

    // Section 2: Logistics
    doc.setFont("helvetica", "bold");
    doc.text("LOGISTICS INFORMATION", 20, 115);
    let y = 125;
    const shipDetails = [
        ["COURIER SERVICE:", data['Courier'] || 'N/A'],
        ["TRACKING ID / AWB:", data['Tracking'] || 'N/A'],
        ["DISPATCH DATE:", data['Date'] || 'N/A']
    ];

    shipDetails.forEach(([label, value]) => {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 116, 139);
        doc.text(label, 20, y);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(31, 41, 55);
        doc.text(value, 75, y);
        y += 8;
    });

    // Section 3: Table
    y += 10;
    doc.setFillColor(30, 41, 59);
    doc.rect(20, y, 170, 10, 'F');
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("DESCRIPTION", 25, y + 7);
    doc.text("QTY", 140, y + 7);
    doc.text("SUBTOTAL", 165, y + 7);

    y += 18;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(31, 41, 55);
    doc.text(data['Product'] || 'Electronic Device', 25, y);
    doc.text((data['Quantity'] || 1).toString(), 142, y);
    
    const rawPrice = (data['Price'] || '0').toString().replace(/^0+/, '');
    const priceInt = parseInt(rawPrice, 10);
    doc.text(`Tk. ${priceInt.toLocaleString()}`, 165, y);

    y += 12;
    doc.setDrawColor(226, 232, 240);
    doc.line(20, y, 190, y);

    y += 10;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text("DELIVERY CHARGE", 25, y);
    doc.text("1", 142, y);
    doc.text("Tk. 150", 165, y);

    y += 15;
    doc.setFillColor(248, 250, 252);
    doc.rect(130, y, 60, 12, 'F');
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(31, 41, 55);
    doc.text("TOTAL:", 135, y + 8);
    
    const totalAmount = priceInt + 150;
    doc.setTextColor(79, 70, 229);
    doc.text(`Tk. ${totalAmount.toLocaleString()}`, 155, y + 8);

    y = 265;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text("This is a system-generated receipt for the ReSale Escrow Transaction.", pageWidth / 2, y, { align: "center" });
    doc.text("Funds are held in escrow until buyer confirms delivery.", pageWidth / 2, y + 5, { align: "center" });
    
    doc.save(`ReSale_Receipt_RS-${receiptId}.pdf`);
};

window.handleMarkDelivered = async function (sessionId) {
    try {
        const offersResponses = await window.api.request(`/offers?session_id=${sessionId}`, 'GET');
        const activeOffer = offersResponses.reverse().find(o => o.status === 'shipped');
        if (!activeOffer) return alert("Order must be SHIPPED to be delivered.");

        await window.api.request(`/escrow/deliver/${activeOffer.id}`, 'POST');
        if (window.currentChatSocket && window.currentChatSocket.readyState === WebSocket.OPEN) {
            window.currentChatSocket.send('Item delivered!');
        }
    } catch (e) {
        alert(e.message);
    }
};
window.clearTransactionHistory = async function() {
    if (!confirm("Are you sure you want to permanently clear your transaction history? This cannot be undone.")) return;
    
    try {
        await window.api.request('/wallet/transactions/clear', 'DELETE');
        alert("History cleared successfully.");
        // Refresh the wallet view to show empty state
        if (typeof loadWalletData === 'function') {
            loadWalletData();
        } else {
            window.location.reload();
        }
    } catch (e) {
        alert("Failed to clear history: " + e.message);
    }
};

window.toggleDescription = toggleDescription;

// ─── CHAT REVIEW LOGIC ───────────────────────────────────────────────

window.setChatStar = function(rating, productId) {
    const input = document.getElementById(`chatRatingInput-${productId}`);
    if (input) input.value = rating;
    
    for (let i = 1; i <= 5; i++) {
        const star = document.getElementById(`star-${productId}-${i}`);
        if (star) {
            star.innerText = i <= rating ? '★' : '☆';
        }
    }
};

window.handleChatReviewSubmit = async function(productId, sessionId, btn) {
    const rating = parseInt(document.getElementById(`chatRatingInput-${productId}`).value);
    const comment = document.getElementById(`chatComment-${productId}`).value.trim();
    
    if (rating === 0) {
        alert("Please select a star rating first.");
        return;
    }
    
    const originalText = btn.innerText;
    btn.innerText = 'Submitting...';
    btn.disabled = true;
    
    try {
        await window.api.createReview({
            product_id: productId,
            rating: rating,
            comment: comment
        });
        
        // Update the card UI to show success
        const container = document.getElementById(`chatReviewForm-${productId}`);
        if (container) {
            container.innerHTML = `
                <div style="background: #ecfdf5; color: #065f46; padding: 1rem; border-radius: 12px; text-align: center; font-weight: 700; border: 1px solid #10b981;">
                    ✅ Thank you! Your review has been submitted.
                </div>
            `;
        }
        
        // Notify the seller via chat that a review was left (optional but nice)
        if (window.currentChatSocket && window.currentChatSocket.readyState === WebSocket.OPEN) {
            window.currentChatSocket.send(`⭐ Buyer left a ${rating}-star review: "${comment}"`);
        }

    } catch (err) {
        alert("Failed to submit review: " + err.message);
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

window.openReviewFromChat = function() {
    alert("Please look for the Review Card at the end of the chat history.");
};

/**
 * Updates the unread message badge on the sidebar Messages link.
 */
async function renderSellerReviews() {
    const container = document.getElementById('sellerReviewsContainer');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align:center; padding: 3rem; color: var(--text-muted);">Loading reviews...</div>';
    
    try {
        const user = getUser();
        // Use standard window.api.request for the new endpoint
        const reviews = await window.api.request(`/reviews/seller/${user.id}`, 'GET');
        
        if (!reviews || reviews.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding: 5rem 2rem; background: var(--bg-card); border: 1px dashed var(--border); border-radius: 20px;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">⭐</div>
                    <h3 style="color: var(--secondary);">No Reviews Yet</h3>
                    <p style="color: var(--text-muted); max-width: 300px; margin: 0.5rem auto;">Complete your first sale to start building your reputation!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                ${reviews.map(r => `
                    <div style="background: var(--bg-card); border: 1px solid var(--border); padding: 1.5rem; border-radius: 20px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); transition: transform 0.2s;" onmouseover="this.style.transform='translateY(-4px)'" onmouseout="this.style.transform='translateY(0)'">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                            <div style="display: flex; align-items: center; gap: 1rem;">
                                <div style="width: 45px; height: 45px; border-radius: 50%; background: linear-gradient(135deg, var(--primary), var(--accent-cyan)); color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.1rem;">
                                    ${r.buyer_name ? r.buyer_name.charAt(0) : 'B'}
                                </div>
                                <div>
                                    <h4 style="margin: 0; font-size: 1rem; color: var(--secondary); font-weight: 700;">${r.buyer_name || 'Anonymous Buyer'}</h4>
                                    <div style="color: #f59e0b; font-size: 0.9rem; margin-top: 0.1rem;">
                                        ${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}
                                        <span style="color: var(--text-muted); font-size: 0.75rem; margin-left: 0.5rem; font-weight: 500;">(${r.rating}/5)</span>
                                    </div>
                                </div>
                            </div>
                            <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;">${new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </div>
                        <div style="background: rgba(0,0,0,0.02); padding: 1rem; border-radius: 12px; border-left: 4px solid var(--primary);">
                            <p style="margin: 0; font-size: 0.95rem; color: var(--text-primary); line-height: 1.6; font-style: italic;">"${r.comment || 'No comment provided.'}"</p>
                        </div>
                        <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border); display: flex; align-items: center; gap: 0.5rem;">
                            <span style="font-size: 0.75rem; color: var(--text-muted);">Reviewed for:</span>
                            <span style="font-size: 0.75rem; font-weight: 700; color: var(--primary);">${r.product_title || 'Purchased Item'}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } catch (err) {
        console.error("Reviews load error:", err);
        container.innerHTML = `<div style="color: red; padding: 2rem; text-align: center;">Error loading reviews: ${err.message}</div>`;
    }
}
window.renderSellerReviews = renderSellerReviews;

async function updateGlobalUnreadCount() {
    const user = getUser();
    if (!user || user.role === 'admin') return;

    try {
        const chats = await window.api.getUserChats(user.id);
        const totalUnread = chats.reduce((sum, chat) => sum + (chat.unread_count || 0), 0);

        // Update sidebar badge on profile.html
        const sidebarBadge = document.getElementById('sidebarUnreadBadge');
        if (sidebarBadge) {
            if (totalUnread > 0) {
                sidebarBadge.innerText = totalUnread > 9 ? '9+' : totalUnread;
                sidebarBadge.style.display = 'flex';
            } else {
                sidebarBadge.style.display = 'none';
            }
        }
    } catch (err) {
        console.error("Unread count update failed:", err);
    }
}
window.updateGlobalUnreadCount = updateGlobalUnreadCount;

// ─── REVIEW LOGIC ───────────────────────────────────────────────

window.openReviewModal = function(productId) {
    alert("Reviews are now handled directly within the chat! Please check your message history for the transaction.");
};

window.markProductAsSold = async function (productId) {
    if (!confirm("Are you sure you want to mark this item as SOLD? This will set quantity to 0 and hide it from listings.")) return;
    try {
        await window.api.request(`/products/${productId}/status`, 'PATCH', { status: 'sold' });
        alert("Product marked as sold!");
        location.reload();
    } catch (err) {
        alert("Failed to update status: " + err.message);
    }
};
// ─── ADMIN DISPUTE HELPERS ───────────────────────────────────────

function setAdminInlineStatus(status, btn) {
    if (status === 'disputed') {
        renderAdminDisputes();
    } else {
        window.currentAdminInlineStatus = status;
        renderAdminListings(status);
        const catFilter = document.getElementById('adminCategoryFilter');
        if (catFilter) catFilter.style.display = (status === 'approved') ? 'flex' : 'none';
    }

    // Update active UI tab
    if (btn && btn.parentElement) {
        const btns = btn.parentElement.querySelectorAll('.filter-btn');
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
}
window.setAdminInlineStatus = setAdminInlineStatus;

async function renderAdminDisputes() {
    const container = document.getElementById('adminListingsContainer');
    const empty = document.getElementById('adminEmpty');
    const catFilter = document.getElementById('adminCategoryFilter');

    if (catFilter) catFilter.style.display = 'none';
    if (!container) return;

    container.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:3rem; color:var(--text-muted);">Opening Dispute Center...</div>';

    try {
        const disputes = await window.api.request('/admin/disputes', 'GET');
        container.innerHTML = '';

        if (!disputes || disputes.length === 0) {
            if (empty) {
                empty.style.display = 'block';
                const emptyTitle = document.getElementById('adminEmptyTitle');
                const emptyDesc = document.getElementById('adminEmptyDesc');
                if (emptyTitle) emptyTitle.innerText = "No Active Disputes";
                if (emptyDesc) emptyDesc.innerText = "All transactions are currently running smoothly.";
            }
            return;
        }

        if (empty) empty.style.display = 'none';

        const listDiv = document.createElement('div');
        listDiv.className = 'admin-listings-list';
        listDiv.style.display = "grid";
        listDiv.style.gridTemplateColumns = "repeat(auto-fill, minmax(280px, 1fr))";
        listDiv.style.gap = "1.5rem";

        disputes.forEach(d => {
            const card = document.createElement('div');
            card.className = 'product-card';
            card.style.cssText = "border: 1.5px solid #f43f5e; box-shadow: 0 10px 15px -3px rgba(244,63,94,0.1); display: flex; flex-direction: column;";

            // Image handling logic
            const imgSrc = d.product_image;
            let fullImgSrc = 'img/placeholder.png'; // Default to local placeholder

            if (imgSrc) {
                if (imgSrc.startsWith('http')) {
                    fullImgSrc = imgSrc;
                } else if (imgSrc.startsWith('/uploads/') || imgSrc.startsWith('uploads/')) {
                    const cleanPath = imgSrc.startsWith('/') ? imgSrc : '/' + imgSrc;
                    fullImgSrc = `http://localhost:8000${cleanPath}`;
                } else {
                    fullImgSrc = `http://localhost:8000/uploads/${imgSrc}`;
                }
            }

            card.innerHTML = `
                <div class="product-image" style="height: 180px; background: #f1f5f9; position: relative; overflow: hidden;">
                    <img src="${fullImgSrc}" alt="${d.product_title}" onerror="this.src='img/placeholder.png'" style="width: 100%; height: 100%; object-fit: cover; display: block;">
                    <span class="badge badge-condition" style="background:#f43f5e; color:white; border:none; top:10px; left:10px; font-weight:800; position: absolute; z-index: 1;">🚨 DISPUTED</span>
                </div>
                <div class="product-details" style="padding:1.25rem; flex: 1; display: flex; flex-direction: column;">
                    <h3 style="font-size:1.1rem; margin-bottom:0.5rem; color:var(--secondary); font-weight: 800;">${d.product_title}</h3>
                    
                    <div style="font-size:0.85rem; color:#475569; margin-bottom:1rem; display:flex; flex-direction:column; gap:0.4rem; background:#fff1f2; padding:1rem; border-radius:12px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span>👤 Buyer: <strong>${d.buyer_name}</strong></span>
                            <span style="font-size: 0.75rem; color: #e11d48; font-weight: 600;">📞 ${d.buyer_phone || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span>🏪 Seller: <strong>${d.seller_name}</strong></span>
                            <span style="font-size: 0.75rem; color: #e11d48; font-weight: 600;">📞 ${d.seller_phone || 'N/A'}</span>
                        </div>
                        <div style="margin-top: 0.5rem; pt-0.5rem; border-top: 1px dashed rgba(225,29,72,0.2); display: flex; justify-content: space-between; align-items: center;">
                            <span>💰 Total Amount:</span>
                            <strong style="color:#e11d48; font-size:1.1rem;">Tk.${(d.offered_price * d.quantity + 150).toLocaleString()}</strong>
                        </div>
                    </div>

                    <div style="margin-bottom: 1rem; background: #fff1f2; padding: 0.75rem; border-radius: 8px; border-left: 4px solid #f43f5e;">
                        <p style="margin: 0 0 0.25rem 0; font-size: 0.7rem; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Dispute Reason:</p>
                        <p style="margin: 0; font-size: 0.85rem; color: #881337; font-weight: 600; line-height: 1.4;">${d.dispute_reason || 'No reason provided.'}</p>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 0.6rem; margin-top: auto;">
                        <button class="btn-primary" style="background:#10b981; border:none; padding:0.8rem; font-size:0.9rem; font-weight:700; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.2);" onclick="handleDisputeVerdict(${d.id}, 'payout_seller')">✔ Payout Seller</button>
                        <button class="btn-secondary" style="color:#e11d48; border-color:#e11d48; padding:0.8rem; font-size:0.9rem; font-weight:700; background:white; border-radius: 10px;" onclick="handleDisputeVerdict(${d.id}, 'refund_buyer')">↩ Refund Buyer</button>
                    </div>
                </div>
            `;
            listDiv.appendChild(card);
        });
        container.appendChild(listDiv);

    } catch (err) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:3rem; color:#ef4444;">Failed to load Disputes: ${err.message}</div>`;
    }
}
window.renderAdminDisputes = renderAdminDisputes;

async function handleDisputeVerdict(offerId, verdict) {
    if (verdict === 'refund_buyer') {
        window.activeDisputeIdForRefund = offerId;
        const modal = document.getElementById('adminRefundModal');
        if (modal) {
            modal.style.display = 'flex';
        } else {
            // Fallback if modal not found
            if (!confirm("Are you sure you want to refund the buyer in full?")) return;
            submitRefundVerdict('refund_full');
        }
        return;
    }

    const actionText = verdict === 'payout_seller' ? 'Release funds to Seller?' : 'Process this action?';
    if (!confirm(`Are you sure you want to resolve this dispute? \n\nAction: ${actionText}`)) return;

    try {
        await window.api.request(`/admin/disputes/${offerId}/resolve?resolution=${verdict}`, 'POST');
        alert("Verdict recorded successfully! The transaction is now settled.");
        renderAdminDisputes();
        loadAdminStats();
    } catch (err) {
        alert("Failed to resolve dispute: " + err.message);
    }
}
window.handleDisputeVerdict = handleDisputeVerdict;

window.submitRefundVerdict = async function(resolution) {
    const offerId = window.activeDisputeIdForRefund;
    const modal = document.getElementById('adminRefundModal');
    
    try {
        await window.api.request(`/admin/disputes/${offerId}/resolve?resolution=${resolution}`, 'POST');
        if (modal) modal.style.display = 'none';
        alert("Verdict recorded successfully! The transaction is now settled.");
        renderAdminDisputes();
        loadAdminStats();
    } catch (err) {
        alert("Failed to resolve dispute: " + err.message);
    }
};

async function renderPlatformWallet() {
    const balanceEl = document.getElementById('platformWalletBalance');
    const listEl = document.getElementById('platformTransactionsList');
    if (!balanceEl || !listEl) return;

    try {
        // Fetch Admin's own data to get balance
        const adminData = await window.api.getMe();
        
        // Update balance
        balanceEl.innerText = `Tk. ${(adminData.wallet_balance || 0).toLocaleString('en-IN')}`;

        // Fetch wallet transactions for the ledger
        const txs = await window.api.getWalletTransactions();
        
        // Filter only platform revenue types or relevant types for the admin account
        const revenueTxs = txs.filter(t => t.transaction_type === 'platform_revenue' || t.transaction_type === 'withdrawal');

        if (revenueTxs.length === 0) {
            listEl.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem; text-align: center; padding: 2rem;">No revenue transactions found yet.</p>';
            return;
        }

        listEl.innerHTML = revenueTxs.map(t => {
            const isRevenue = t.amount > 0;
            const date = new Date(t.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
            return `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; border-bottom: 1px solid var(--border); transition: background 0.2s;" onmouseover="this.style.background='rgba(0,0,0,0.02)'" onmouseout="this.style.background='transparent'">
                    <div style="display: flex; gap: 1rem; align-items: center;">
                        <div style="width: 40px; height: 40px; border-radius: 10px; background: ${isRevenue ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}; color: ${isRevenue ? '#10b981' : '#ef4444'}; display: flex; align-items: center; justify-content: center; font-size: 1.1rem;">
                            ${isRevenue ? '💰' : '💸'}
                        </div>
                        <div>
                            <p style="margin: 0; font-weight: 700; color: var(--secondary); font-size: 0.95rem;">${t.description}</p>
                            <p style="margin: 0; font-size: 0.75rem; color: var(--text-muted); font-weight: 500;">${date}</p>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <p style="margin: 0; font-weight: 800; font-size: 1rem; color: ${isRevenue ? '#10b981' : '#ef4444'};">
                            ${isRevenue ? '+' : ''}Tk. ${Math.abs(t.amount).toLocaleString('en-IN')}
                        </p>
                        <span style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; color: var(--text-muted);">${t.transaction_type.replace('_', ' ')}</span>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error("Failed to render platform wallet:", err);
        listEl.innerHTML = `<p style="color: #ef4444; text-align: center; padding: 2rem;">Error: ${err.message}</p>`;
    }
}
window.renderPlatformWallet = renderPlatformWallet;


