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
 * Renders a listing card for the public/buyer view.
 */
function renderListingCard(listing) {
    const imgSrc = listing.image_url ? `http://localhost:8000${listing.image_url}` : (listing.imageUrl || '');
    const imgHtml = imgSrc
        ? `<img src="${imgSrc}" alt="${listing.title}" class="card-img" onerror="this.style.display='none'">`
        : `<div class="card-img-placeholder">${CATEGORY_EMOJIS[listing.category] || '📦'}</div>`;

    const priceFormatted = Number(listing.price).toLocaleString('en-IN');
    const needsReadMore = listing.description.length > 90;
    const descHtml = needsReadMore
        ? `<div class="description-container" id="desc-container-${listing.id}">
             <p class="description-text truncated" id="desc-text-${listing.id}">${listing.description}</p>
             <button class="read-more-btn" onclick="toggleDescription('${listing.id}', event)" id="read-more-${listing.id}">Read More</button>
           </div>`
        : `<p style="font-size:0.82rem; color:var(--text-muted); margin-bottom:0.8rem; line-height:1.5;">${listing.description}</p>`;

    const isSold = listing.status === 'sold';

    return `
        <div class="card" data-category="${listing.category}" data-id="${listing.id}" style="border: 1px solid var(--border); border-radius: 16px; overflow: hidden; background: var(--surface); box-shadow: 0 4px 12px rgba(0,0,0,0.05); display: flex; flex-direction: column; transition: transform 0.3s ease, box-shadow 0.3s ease;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 12px 24px rgba(0,0,0,0.1)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.05)'">
            <div style="position: relative;">
                ${imgHtml}
                <div style="position: absolute; top: 12px; left: 12px;">
                    <span style="background: rgba(255,255,255,0.95); color: #0f172a; font-weight: 800; font-size: 0.75rem; padding: 0.4rem 0.8rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); letter-spacing: 0.03em;">${listing.condition.toUpperCase()}</span>
                </div>
                <div style="position: absolute; top: 12px; right: 12px;">
                    ${isSold
            ? `<span style="background: rgba(239, 68, 68, 0.95); color: white; font-weight: 800; font-size: 0.75rem; padding: 0.4rem 0.8rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); letter-spacing: 0.03em;">SOLD</span>`
            : `<span style="background: rgba(16, 185, 129, 0.95); color: white; font-weight: 800; font-size: 0.75rem; padding: 0.4rem 0.8rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); letter-spacing: 0.03em;">AVAILABLE</span>`
        }
                </div>
            </div>
            <div class="card-content" style="padding: 1.25rem; display: flex; flex-direction: column; flex: 1;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.5rem;">
                    <h3 class="card-title" style="margin: 0; font-size: 1.15rem; font-weight: 800; line-height: 1.3; color: var(--text-primary); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${listing.title}</h3>
                </div>
                <div style="display: flex; align-items: baseline; gap: 0.5rem; margin-bottom: 0.75rem;">
                    <p class="card-price" style="margin: 0; font-size: 1.6rem; font-weight: 900; background: linear-gradient(135deg, var(--primary), var(--accent-cyan)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">৳${priceFormatted}</p>
                </div>
                
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.75rem; align-items: center;">
                    <span style="font-size: 0.75rem; background: rgba(99,102,241,0.08); color: var(--primary); font-weight: 700; padding: 0.35rem 0.6rem; border-radius: 6px; border: 1px solid rgba(99,102,241,0.2); white-space: nowrap;">${CATEGORY_EMOJIS[listing.category] || '📦'} ${listing.category}</span>
                    ${listing.sellerTotalReviews > 0
            ? `<span style="font-size: 0.75rem; background: rgba(245,158,11,0.08); color: #d97706; font-weight: 700; padding: 0.35rem 0.6rem; border-radius: 6px; border: 1px solid rgba(245,158,11,0.2); white-space: nowrap;">⭐ ${listing.sellerRating.toFixed(1)} (${listing.sellerTotalReviews})</span>`
            : `<span style="font-size: 0.75rem; background: var(--bg-body); color: var(--text-muted); font-weight: 600; padding: 0.35rem 0.6rem; border-radius: 6px; border: 1px solid var(--border); white-space: nowrap;">⭐ New Seller</span>`
        }
                </div>
                
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.4rem; font-weight: 600;">
                    👤 Seller: <a href="index.html?seller=${listing.seller_id}" onclick="event.stopPropagation();" style="color: var(--primary); text-decoration: none; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.textDecoration='underline'; this.style.color='var(--accent-cyan)'" onmouseout="this.style.textDecoration='none'; this.style.color='var(--primary)'">${listing.sellerName}</a>
                </div>
                
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 1rem; display: flex; align-items: center; gap: 0.4rem; font-weight: 500;">
                    🕒 Listed: ${formatListingDate(listing.created_at)}
                </div>
                
                <div style="margin-bottom: 1.25rem; flex: 1;">
                    ${descHtml}
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-top: auto;">
                    ${isSold
            ? `<button style="background: var(--bg-body); color: var(--text-muted); border: 1px solid var(--border); border-radius: 10px; width: 100%; font-weight: 800; padding: 0.75rem; font-size: 0.85rem; cursor: not-allowed; transition: all 0.2s;" disabled>SOLD OUT</button>`
            : `<button style="background: linear-gradient(135deg, var(--primary), var(--accent-cyan)); color: white; border: none; border-radius: 10px; width: 100%; font-weight: 800; padding: 0.75rem; font-size: 0.85rem; cursor: pointer; box-shadow: 0 4px 12px rgba(99,102,241,0.3); transition: all 0.2s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(99,102,241,0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(99,102,241,0.3)'" onclick="handleBuyClick('${listing.id}')" id="buyBtn-${listing.id}">Buy with Escrow</button>`
        }
                    <button style="background: transparent; color: var(--primary); border: 2px solid var(--primary); border-radius: 10px; text-align: center; font-weight: 800; width: 100%; padding: 0.65rem; font-size: 0.85rem; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='var(--primary)'; this.style.color='white'" onmouseout="this.style.background='transparent'; this.style.color='var(--primary)'" onclick="handleMessageClick('${listing.id}', '${listing.seller_id}')" id="msgBtn-${listing.id}">Message</button>
                </div>
                <button style="width: 100%; padding: 0.5rem; border-radius: 8px; text-align: center; font-weight: 600; font-size: 0.8rem; border: none; background: transparent; color: var(--text-muted); margin-top: 0.5rem; cursor: pointer; transition: color 0.2s;" onmouseover="this.style.color='var(--text-primary)'" onmouseout="this.style.color='var(--text-muted)'" onclick="openReviewModal('${listing.id}')" id="revBtn-${listing.id}">⭐️ Leave a Review</button>
            </div>
        </div>`;
}

/**
 * Renders a listing card in the seller's dashboard (with status + edit/delete).
 */
function renderSellerCard(listing) {
    const imgSrc = listing.image_url ? `http://localhost:8000${listing.image_url}` : (listing.imageUrl || '');
    const imgHtml = imgSrc
        ? `<img src="${imgSrc}" alt="${listing.title}" class="card-img" style="aspect-ratio:16/9;" onerror="this.style.display='none'">`
        : `<div class="card-img-placeholder">${CATEGORY_EMOJIS[listing.category] || '📦'}</div>`;

    const priceFormatted = Number(listing.price).toLocaleString('en-IN');
    const status = STATUS_CONFIG[listing.status] || STATUS_CONFIG['pending'];

    const needsReadMore = listing.description.length > 60;
    const descHtml = needsReadMore
        ? `<div class="description-container" id="desc-container-${listing.id}">
             <p class="description-text truncated" id="desc-text-${listing.id}" style="font-size: 0.8rem;">${listing.description}</p>
             <button class="read-more-btn" onclick="toggleDescription('${listing.id}', event)" id="read-more-${listing.id}">Read More</button>
           </div>`
        : `<p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.5rem; line-height:1.4;">${listing.description}</p>`;

    return `
        <div class="card" data-category="${listing.category}" data-id="${listing.id}" data-status="${listing.status}">
            ${imgHtml}
            <div class="card-content">
                <span class="listing-status-badge ${status.cls}">${status.label}</span>
                <h4 class="card-title" style="font-size:0.95rem; margin-top:0.5rem;">${listing.title}</h4>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <p class="card-price" style="font-size:1rem; margin-bottom: 0;">৳${priceFormatted}</p>
                    <small style="font-size: 0.7rem; color: var(--text-muted); text-align: right;">🕒 ${formatListingDate(listing.created_at)}</small>
                </div>
                <div style="margin-top: 0.5rem;">
                    ${descHtml}
                </div>
                <div style="margin-top:auto; display:flex; gap:0.5rem;">
                    ${listing.status === 'approved'
            ? `<button class="btn-primary" style="flex:1; padding:0.4rem; font-size:0.8rem; background:linear-gradient(135deg,#10b981,#059669); border:none; border-radius:8px; color:white; font-weight:700; cursor:pointer;">🤝 Mark as Sold</button>`
            : listing.status === 'sold'
                ? `<button style="flex:1; padding:0.4rem; font-size:0.8rem; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.2); border-radius:8px; color:#ef4444; font-weight:700; cursor:not-allowed;" disabled>🤝 Sold</button>`
                : ''
        }
                    <button class="btn-outline" style="flex:1; padding:0.4rem; font-size:0.8rem;" onclick="deleteMyListing('${listing.id}')">🗑 Delete</button>
                </div>
            </div>
        </div>`;
}

/**
 * Renders an admin review card with Approve/Reject actions.
 */
function renderAdminCard(listing) {
    const imgSrc = listing.image_url ? `http://localhost:8000${listing.image_url}` : (listing.imageUrl || '');
    const imgHtml = imgSrc
        ? `<img src="${imgSrc}" alt="${listing.title}" class="admin-card-img-el" onerror="this.parentElement.querySelector('.card-img-placeholder') && (this.style.display='none')">`
        : `<div class="admin-card-img-placeholder">${CATEGORY_EMOJIS[listing.category] || '📦'}</div>`;

    const priceFormatted = Number(listing.price).toLocaleString('en-IN');
    const status = STATUS_CONFIG[listing.status] || STATUS_CONFIG['pending'];

    const actionBtns = listing.status === 'pending' ? `
        <button class="btn-primary admin-btn-approve" onclick="adminAction('${listing.id}','approved')" id="approve-${listing.id}">✅ Approve</button>
        <button class="btn-outline admin-btn-reject" onclick="adminAction('${listing.id}','rejected')" id="reject-${listing.id}">❌ Reject</button>
    ` : `
        <button class="btn-outline admin-btn-reset" onclick="adminAction('${listing.id}','pending')" id="reset-${listing.id}">↩ Reset to Pending</button>
    `;

    return `
        <div class="admin-listing-card" data-status="${listing.status}" data-id="${listing.id}">
            <div class="admin-card-img">
                ${imgHtml}
            </div>
            <div class="admin-card-content">
                <div class="admin-card-header">
                    <div class="admin-card-info">
                        <span class="listing-status-badge ${status.cls}">${status.label}</span>
                        <h4 class="admin-card-title">${listing.title}</h4>
                        <p class="admin-card-price">৳${priceFormatted}</p>
                    </div>
                    <div class="admin-card-badges">
                        <span class="badge badge-condition">${listing.condition}</span>
                        <div class="admin-card-category">${CATEGORY_EMOJIS[listing.category] || '📦'} ${listing.category}</div>
                    </div>
                </div>
                <p class="admin-card-desc">${listing.description}</p>
                <div class="admin-card-footer">
                    <div class="admin-card-seller">
                        👤 Seller: <strong>${listing.sellerName}</strong> 
                        <span class="admin-card-date">🕒 ${formatListingDate(listing.created_at)}</span>
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
        const response = await window.api.getListings(options);

        if (page === 1) grid.innerHTML = '';
        let listings = response.items || [];

        if (listings.length === 0 && page === 1) {
            grid.innerHTML = '';
            if (emptyEl) emptyEl.style.display = 'flex';
        } else {
            if (emptyEl) emptyEl.style.display = 'none';
            grid.insertAdjacentHTML('beforeend', listings.map(renderListingCard).join(''));
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
        const response = await window.api.getListings({
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
            grid.innerHTML = listings.map(renderListingCard).join('');
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
        const response = await window.api.getListings({
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
        const response = await window.api.getListings(options);

        if (page === 1) grid.innerHTML = '';
        let listings = response.items || [];

        if (listings.length === 0 && page === 1) {
            grid.innerHTML = '';
            if (emptyEl) emptyEl.style.display = 'flex';
        } else {
            if (emptyEl) emptyEl.style.display = 'none';
            grid.insertAdjacentHTML('beforeend', listings.map(renderListingCard).join(''));
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
        const response = await window.api.getListings({
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

        if (usersEl) usersEl.innerText = stats.pending_sellers || 0;
        if (buyersEl) buyersEl.innerText = stats.total_buyers || 0;
        if (sellersEl) sellersEl.innerText = stats.total_sellers || 0;
        if (approvedEl) approvedEl.innerText = stats.approved_listings || 0;
        if (pendingEl) pendingEl.innerText = stats.pending_listings || 0;
        if (rejectedEl) rejectedEl.innerText = stats.rejected_listings || 0;
    } catch (error) {
        console.error("Failed to load admin stats:", error);
    }
}

// ─── Action Handlers ──────────────────────────────────────────

async function adminAction(id, newStatus) {
    await window.api.updateListingStatus(id, newStatus);

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

async function deleteMyListing(id) {
    if (!confirm('Are you sure you want to delete this product?')) return;
    await window.api.deleteListing(id);
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
        const response = await window.api.getListings({
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

async function signupUser(name, phone, email, password, role) {
    const signupData = {
        full_name: name,
        phone_number: phone,
        email: email,
        password: password,
        role: role
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
        if (role === 'admin') {
            if (walletMenu) walletMenu.style.display = 'none';
            if (chatMenu) chatMenu.style.display = 'none';
        } else {
            if (walletMenu) walletMenu.style.display = 'flex';
            if (chatMenu) chatMenu.style.display = 'flex';
        }

        // Show the correct view
        if (role === 'seller' && sellerView) {
            sellerView.style.display = 'block';
            renderSellerListings('all');

            // Seller status tabs
            const tabs = document.querySelectorAll('#sellerStatusTabs .status-tab');
            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    tabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    renderSellerListings(tab.dataset.status);
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
                // Token is sent via Authorization header, NOT in FormData

                const fileInput = document.getElementById('listingImages');
                if (fileInput && fileInput.files.length > 0) {
                    formData.append('image', fileInput.files[0]);
                }

                try {
                    await window.api.createListing(formData, user.token);
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
                    alert('Error adding product: ' + err.message);
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
            signupUser(name, phone, email, pass, role);
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
    if (window.location.pathname.includes('wallet.html') && user) {
        const walletGrid = document.querySelector('.wallet-grid');
        const transactionsList = document.querySelector('.recent-transactions');

        let availableBalance = 0;
        let escrowBalance = 0;

        if (walletGrid && transactionsList) {
            if (user.role === 'buyer') {
                walletGrid.innerHTML = `
                  <div class="wallet-card available">
                    <h3>Deposit Balance</h3>
                    <p class="balance">৳${availableBalance.toLocaleString()}</p>
                    <div style="margin-top: 2rem;">
                      <button class="btn-primary" style="width: 100%; border-radius: 8px;">Add Funds</button>
                    </div>
                  </div>
                  <div class="wallet-card escrow">
                    <h3>In Escrow</h3>
                    <p class="balance">৳${escrowBalance.toLocaleString()}</p>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 1rem;">Funds locked for pending purchases until you confirm receipt.</p>
                  </div>
                `;
                transactionsList.innerHTML = `
                  <div class="transactions-header">Recent Transactions</div>
                  <div class="listings-empty" style="padding: 2rem; border: none; background: transparent;">
                    <div class="empty-icon">💸</div>
                    <h3>No Transactions Yet</h3>
                    <p>Your transaction history will appear here.</p>
                  </div>
                `;
            } else if (user.role === 'seller') {
                walletGrid.innerHTML = `
                  <div class="wallet-card available">
                    <h3>Available Balance</h3>
                    <p class="balance">৳${availableBalance.toLocaleString()}</p>
                    <div style="margin-top: 2rem;">
                      <button class="btn-primary" style="width: 100%; border-radius: 8px;">Withdraw Funds</button>
                    </div>
                  </div>
                  <div class="wallet-card escrow">
                    <h3>Escrow Balance</h3>
                    <p class="balance">৳${escrowBalance.toLocaleString()}</p>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 1rem;">These funds are held securely until the buyer confirms receipt of the item.</p>
                  </div>
                `;
                transactionsList.innerHTML = `
                  <div class="transactions-header">Recent Transactions</div>
                  <div class="listings-empty" style="padding: 2rem; border: none; background: transparent;">
                    <div class="empty-icon">💸</div>
                    <h3>No Transactions Yet</h3>
                    <p>Your transaction history will appear here.</p>
                  </div>
                `;
            }
        }
    }

    if (window.location.pathname.includes('chat.html') && user) {
        const chatBox = document.getElementById('chatBox');
        const sidebar = document.querySelector('.chat-sidebar');
        const chatHeader = document.querySelector('.chat-header');
        const chatForm = document.getElementById('chatForm');
        let currentSocket = null;
        let activeSessionId = new URLSearchParams(window.location.search).get('session');

        function appendMessage(msg) {
            if (!chatBox) return;
            const div = document.createElement('div');
            const isMe = msg.sender_id === user.id;
            div.className = `message ${isMe ? 'user' : 'seller'}`;
            div.innerText = msg.text;
            chatBox.appendChild(div);
        }

        function initActiveChat(chat) {
            const otherParty = user.role === 'buyer' ? chat.seller : chat.buyer;
            if (chatHeader) {
                chatHeader.innerHTML = `
                  <div style="width: 40px; height: 40px; background: #e2e8f0; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; color: var(--primary);">
                    ${otherParty.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </div>
                  <div>
                    <p style="font-weight: 600;">${otherParty.full_name}</p>
                    <p style="font-size: 0.75rem; color: #10b981;">● Online</p>
                  </div>
                `;
            }

            const bannerContainer = document.getElementById('chatListingBanner');
            if (bannerContainer && chat.listing_title) {
                const imgSrc = chat.listing_image_url ? `http://localhost:8000${chat.listing_image_url}` : '';
                const imgHtml = imgSrc ? `<img src="${imgSrc}" style="width: 48px; height: 48px; object-fit: cover; border-radius: 8px;">` : `<div style="width: 48px; height: 48px; background: #e2e8f0; border-radius: 8px; display:flex; align-items:center; justify-content:center;">📦</div>`;
                const buyBtnHtml = user.role === 'buyer'
                    ? `<button class="btn-primary" style="padding: 0.5rem 1rem; font-size: 0.85rem;" onclick="handleBuyClick('${chat.listing_id}')">🛒 Buy with Escrow</button>`
                    : '';
                bannerContainer.innerHTML = `
                    <div style="display:flex; align-items:center; gap: 1rem;">
                        ${imgHtml}
                        <div>
                            <div style="font-weight: 600; font-size: 0.95rem;">${chat.listing_title}</div>
                            <div style="color: var(--primary); font-weight: 700;">৳${Number(chat.listing_price).toLocaleString('en-IN')}</div>
                        </div>
                    </div>
                    ${buyBtnHtml}
                `;
                bannerContainer.style.display = 'flex';
            }

            if (chatBox) chatBox.innerHTML = '';
            window.api.getChatMessages(chat.id).then(messages => {
                messages.forEach(msg => appendMessage(msg));
                if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
            });

            if (currentSocket) { currentSocket.close(); currentSocket = null; }
            const wsUrl = `ws://localhost:8000/ws/chat/${chat.id}?token=${user.token}`;
            currentSocket = new WebSocket(wsUrl);

            currentSocket.onmessage = (event) => {
                const msg = JSON.parse(event.data);
                if (msg.session_id.toString() === activeSessionId) {
                    appendMessage(msg);
                    if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
                    window.api.markChatRead(msg.session_id, user.id).catch(err => console.error(err));
                    // Re-sort sidebar so this chat floats to the top
                    renderSidebarList();
                } else {
                    updateGlobalUnreadCount();
                    refreshChatSidebar();
                }
            };

            if (chatForm) {
                const newForm = chatForm.cloneNode(true);
                chatForm.parentNode.replaceChild(newForm, chatForm);
                const newChatInput = newForm.querySelector('#chatInput');
                newForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const text = newChatInput.value.trim();
                    if (!text || !currentSocket) return;
                    currentSocket.send(text);
                    newChatInput.value = '';
                    // Re-sort sidebar so sender's chat floats to top
                    setTimeout(() => renderSidebarList(), 300);
                });
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
                        <div style="font-size:0.75rem; color:var(--text-secondary); margin:0.15rem 0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${chat.listing_title || 'Enquiry'}</div>
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
                        <div style="font-size:0.75rem; color:var(--text-secondary); margin:0.15rem 0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${chat.listing_title || 'Enquiry'}</div>
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
window.deleteMyListing = deleteMyListing;
window.handleBuyClick = handleBuyClick;
window.logoutUser = logoutUser;
window.handleChatDelete = handleChatDelete;
window.toggleDescription = toggleDescription;

/**
 * Updates the unread message badge on the sidebar Messages link.
 */
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

window.openReviewModal = function (listingId) {
    const user = getUser();
    if (!user) {
        alert("Please login to leave a review.");
        window.location.href = "login.html";
        return;
    }
    const modal = document.getElementById('reviewModal');
    if (!modal) return;

    document.getElementById('reviewListingId').value = listingId;
    document.getElementById('reviewRating').value = '';
    document.getElementById('reviewComment').value = '';

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
};

document.addEventListener('DOMContentLoaded', () => {
    const reviewForm = document.getElementById('reviewForm');
    if (reviewForm) {
        reviewForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('submitReviewBtn');
            const originalText = btn.innerText;
            btn.innerText = 'Submitting...';
            btn.disabled = true;

            try {
                const listingId = document.getElementById('reviewListingId').value;
                const rating = parseInt(document.getElementById('reviewRating').value);
                const comment = document.getElementById('reviewComment').value;

                await window.api.createReview({
                    listing_id: listingId,
                    rating: rating,
                    comment: comment
                });

                document.getElementById('reviewModal').classList.remove('active');
                document.body.style.overflow = '';
                alert("Thank you! Your review has been submitted. It will appear on the seller's profile shortly.");

            } catch (err) {
                alert("Failed to submit review: " + err.message);
            } finally {
                btn.innerText = originalText;
                btn.disabled = false;
            }
        });
    }
});
