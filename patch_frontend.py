import os

app_js_path = r"e:\PROJECTS\Resale-Marketplace-for-Electronics-Devices\frontend\js\app.js"

with open(app_js_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. renderPublicListings
orig_public = """async function renderPublicListings(category = 'all') {
    const grid = document.getElementById('listingsGrid');
    const emptyEl = document.getElementById('listingsEmpty');
    if (!grid) return;

    let allListings = await window.api.getListings();
    let listings = allListings.filter(l => l.status === 'approved');
    if (category !== 'all') listings = listings.filter(l => l.category === category);
    listings = listings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (listings.length === 0) {
        grid.innerHTML = '';
        if (emptyEl) emptyEl.style.display = 'flex';
    } else {
        if (emptyEl) emptyEl.style.display = 'none';
        grid.innerHTML = listings.map(renderListingCard).join('');
    }

    // Dynamic Filter Visibility
    const filterContainer = document.getElementById('listingsFilter');
    if (filterContainer) {
        const categoriesWithProducts = new Set(allListings.filter(l => l.status === 'approved').map(l => l.category));
        const filterBtns = filterContainer.querySelectorAll('.filter-btn');
        filterBtns.forEach(btn => {
            const cat = btn.dataset.category;
            if (cat === 'all' || categoriesWithProducts.has(cat)) {
                btn.style.display = 'inline-flex';
            } else {
                btn.style.display = 'none';
            }
        });
    }
}"""

new_public = """window.currentPublicPage = 1;
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
        const response = await window.api.getListings({
            status: 'approved',
            category: category,
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
    } catch(err) {
        console.error("Error loading public listings:", err);
    }
}"""

# 2. renderSellerListings
orig_seller = """async function renderSellerListings(statusFilter = 'all') {
    const grid = document.getElementById('sellerListingsGrid');
    const emptyEl = document.getElementById('sellerEmpty');
    if (!grid) return;

    const user = getUser();
    let allListings = await window.api.getListings();
    let listings = allListings.filter(l => l.seller_id === user.id || l.sellerEmail === user.email);
    if (statusFilter !== 'all') listings = listings.filter(l => l.status === statusFilter);
    listings = listings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (listings.length === 0) {
        grid.innerHTML = '';
        if (emptyEl) emptyEl.style.display = 'flex';
    } else {
        if (emptyEl) emptyEl.style.display = 'none';
        grid.innerHTML = listings.map(renderSellerCard).join('');
    }
}"""

new_seller = """window.currentSellerPage = 1;
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
    } catch(err) {
        console.error("Error loading seller listings:", err);
    }
}"""

# 3. renderBuyerListings
orig_buyer = """async function renderBuyerListings(category = 'all') {
    const grid = document.getElementById('buyerListingsGrid');
    const emptyEl = document.getElementById('buyerEmpty');
    if (!grid) return;

    let allListings = await window.api.getListings();
    let listings = allListings.filter(l => l.status === 'approved');
    if (category !== 'all') listings = listings.filter(l => l.category === category);
    listings = listings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (listings.length === 0) {
        grid.innerHTML = '';
        if (emptyEl) emptyEl.style.display = 'flex';
    } else {
        if (emptyEl) emptyEl.style.display = 'none';
        grid.innerHTML = listings.map(renderListingCard).join('');
    }

    // Dynamic Filter Visibility
    const filterContainer = document.getElementById('buyerFilter');
    if (filterContainer) {
        const categoriesWithProducts = new Set(allListings.filter(l => l.status === 'approved').map(l => l.category));
        const filterBtns = filterContainer.querySelectorAll('.filter-btn');
        filterBtns.forEach(btn => {
            const cat = btn.dataset.category;
            if (cat === 'all' || categoriesWithProducts.has(cat)) {
                btn.style.display = 'inline-flex';
            } else {
                btn.style.display = 'none';
            }
        });
    }
}"""

new_buyer = """window.currentBuyerPage = 1;
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
        const response = await window.api.getListings({
            status: 'approved',
            category: category,
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
    } catch(err) {
        console.error("Error loading buyer listings:", err);
    }
}"""

# 4. renderAdminListings
orig_admin = """async function renderAdminListings(statusFilter = 'all') {
    if (statusFilter !== window.currentAdminInlineStatus) {
        window.currentAdminInlineStatus = statusFilter;
    }
    
    const container = document.getElementById('adminListingsContainer');
    const emptyEl = document.getElementById('adminEmpty');
    const catFilterEl = document.getElementById('adminCategoryFilter');
    
    if (!container) return;

    // Show category filter only when viewing approved products
    if (catFilterEl && statusFilter === 'approved') {
        catFilterEl.style.display = 'flex';
    } else if (catFilterEl) {
        catFilterEl.style.display = 'none';
        catFilterEl.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        const allBtn = catFilterEl.querySelector('.filter-btn[data-category="all"]');
        if (allBtn) allBtn.classList.add('active');
    }

    // Get active category filter
    const activeCat = catFilterEl ? catFilterEl.querySelector('.filter-btn.active') : null;
    const categoryFilter = (statusFilter === 'approved' && activeCat) ? activeCat.dataset.category : 'all';

    container.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:2rem;">Loading...</p>';
    if (emptyEl) emptyEl.style.display = 'none';

    let listings = await window.api.getListings();
    if(!listings) listings = [];
    if (statusFilter !== 'all') listings = listings.filter(l => l.status === statusFilter);
    if (categoryFilter !== 'all') listings = listings.filter(l => l.category === categoryFilter);

    listings = listings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (listings.length === 0) {
        container.innerHTML = '';
        if (emptyEl) {
            emptyEl.style.display = 'flex';
            const emptyTitle = document.getElementById('adminEmptyTitle');
            const emptyDesc = document.getElementById('adminEmptyDesc');
            if (emptyTitle) emptyTitle.innerText = 'No Products Found';
            if (emptyDesc) emptyDesc.innerText = 'Select a category from the statistics cards above to view products.';
        }
    } else {
        if (emptyEl) emptyEl.style.display = 'none';
        container.innerHTML = `<div class="admin-listings-list">${listings.map(renderAdminCard).join('')}</div>`;
    }
}"""

new_admin = """window.currentAdminPage = 1;
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
    } catch(err) {
        console.error("Error loading admin listings:", err);
    }
}"""

content = content.replace(orig_public, new_public)
content = content.replace(orig_seller, new_seller)
content = content.replace(orig_buyer, new_buyer)
content = content.replace(orig_admin, new_admin)

with open(app_js_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Patch applied.")
