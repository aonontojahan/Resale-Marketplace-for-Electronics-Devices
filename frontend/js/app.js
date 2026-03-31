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

// ─── Listings Storage (simulated DB) ─────────────────────────

function getListings() {
    const data = localStorage.getItem('resale_listings');
    return data ? JSON.parse(data) : [];
}

function saveListings(listings) {
    localStorage.setItem('resale_listings', JSON.stringify(listings));
}

function addListing(listing) {
    const listings = getListings();
    listings.push(listing);
    saveListings(listings);
}

function updateListingStatus(id, status) {
    const listings = getListings();
    const idx = listings.findIndex(l => l.id === id);
    if (idx !== -1) {
        listings[idx].status = status;
        saveListings(listings);
    }
}

function deleteListing(id) {
    const listings = getListings().filter(l => l.id !== id);
    saveListings(listings);
}

// ─── Category Icon Map ────────────────────────────────────────

const CATEGORY_ICONS = {
    phone: 'assets/iphone.png',
    laptop: 'assets/macbook.png',
    camera: 'assets/sony.png',
    tablet: 'assets/ipad.png',
    other: null
};

const CATEGORY_EMOJIS = {
    phone: '📱',
    laptop: '💻',
    camera: '📷',
    tablet: '📟',
    other: '🔧'
};

const STATUS_CONFIG = {
    pending:  { label: '⏳ Pending Review', cls: 'badge-pending' },
    approved: { label: '✅ Approved',        cls: 'badge-approved' },
    rejected: { label: '❌ Rejected',        cls: 'badge-rejected' }
};

// ─── Card Renderers ───────────────────────────────────────────

/**
 * Renders a listing card for the public/buyer view.
 */
function renderListingCard(listing) {
    const imgSrc = (listing.imageUrls && listing.imageUrls.length > 0) ? listing.imageUrls[0] : (listing.imageUrl || CATEGORY_ICONS[listing.category] || '');
    const imgHtml = imgSrc
        ? `<img src="${imgSrc}" alt="${listing.title}" class="card-img" onerror="this.style.display='none'">`
        : `<div class="card-img-placeholder">${CATEGORY_EMOJIS[listing.category] || '📦'}</div>`;

    const priceFormatted = Number(listing.price).toLocaleString('en-IN');

    return `
        <div class="card" data-category="${listing.category}" data-id="${listing.id}">
            ${imgHtml}
            <div class="card-content">
                <h3 class="card-title">${listing.title}</h3>
                <p class="card-price">৳${priceFormatted}</p>
                <p class="card-meta">
                    <span class="badge badge-condition">${listing.condition}</span>
                    <span class="badge badge-rating" style="background:rgba(59,130,246,0.15); color:#60a5fa; border-color:#60a5fa;">${CATEGORY_EMOJIS[listing.category] || '📦'} ${listing.category}</span>
                </p>
                <p style="font-size:0.82rem; color:var(--text-muted); margin-bottom:0.8rem; line-height:1.5;">${listing.description.substring(0, 90)}${listing.description.length > 90 ? '…' : ''}</p>
                <p style="font-size:0.78rem; color:var(--text-muted);">By: <strong style="color:var(--text-secondary);">${listing.sellerName}</strong></p>
                <div style="display:flex; gap:0.5rem; margin-top:1rem;">
                    <button class="btn-outline" style="flex:1; padding:0.6rem; font-size:0.85rem;" onclick="handleMessageClick('${listing.id}')" id="msgBtn-${listing.id}">💬 Message</button>
                    <button class="btn-primary" style="flex:1; padding:0.6rem; font-size:0.85rem;" onclick="handleBuyClick('${listing.id}')" id="buyBtn-${listing.id}">🛒 Buy</button>
                </div>
            </div>
        </div>`;
}

/**
 * Renders a listing card in the seller's dashboard (with status + edit/delete).
 */
function renderSellerCard(listing) {
    const imgSrc = (listing.imageUrls && listing.imageUrls.length > 0) ? listing.imageUrls[0] : (listing.imageUrl || CATEGORY_ICONS[listing.category] || '');
    const imgHtml = imgSrc
        ? `<img src="${imgSrc}" alt="${listing.title}" class="card-img" style="aspect-ratio:16/9;" onerror="this.style.display='none'">`
        : `<div class="card-img-placeholder">${CATEGORY_EMOJIS[listing.category] || '📦'}</div>`;

    const priceFormatted = Number(listing.price).toLocaleString('en-IN');
    const status = STATUS_CONFIG[listing.status] || STATUS_CONFIG['pending'];

    return `
        <div class="card" data-category="${listing.category}" data-id="${listing.id}" data-status="${listing.status}">
            ${imgHtml}
            <div class="card-content">
                <span class="listing-status-badge ${status.cls}">${status.label}</span>
                <h4 class="card-title" style="font-size:0.95rem; margin-top:0.5rem;">${listing.title}</h4>
                <p class="card-price" style="font-size:1rem;">৳${priceFormatted}</p>
                <div style="margin-top:1rem; display:flex; gap:0.5rem;">
                    <button class="btn-outline" style="flex:1; padding:0.4rem; font-size:0.8rem;" onclick="deleteMyListing('${listing.id}')">🗑 Delete</button>
                </div>
            </div>
        </div>`;
}

/**
 * Renders an admin review card with Approve/Reject actions.
 */
function renderAdminCard(listing) {
    const imgSrc = (listing.imageUrls && listing.imageUrls.length > 0) ? listing.imageUrls[0] : (listing.imageUrl || CATEGORY_ICONS[listing.category] || '');
    const imgHtml = imgSrc
        ? `<img src="${imgSrc}" alt="${listing.title}" class="card-img" style="aspect-ratio:16/9;" onerror="this.parentElement.querySelector('.card-img-placeholder') && (this.style.display='none')">`
        : `<div class="card-img-placeholder">${CATEGORY_EMOJIS[listing.category] || '📦'}</div>`;

    const priceFormatted = Number(listing.price).toLocaleString('en-IN');
    const status = STATUS_CONFIG[listing.status] || STATUS_CONFIG['pending'];

    const actionBtns = listing.status === 'pending' ? `
        <button class="btn-primary" style="flex:1; padding:0.45rem; font-size:0.82rem; background:linear-gradient(135deg,#10b981,#059669);" onclick="adminAction('${listing.id}','approved')" id="approve-${listing.id}">✅ Approve</button>
        <button class="btn-outline" style="flex:1; padding:0.45rem; font-size:0.82rem; color:#ef4444; border-color:#ef4444;" onclick="adminAction('${listing.id}','rejected')" id="reject-${listing.id}">❌ Reject</button>
    ` : `
        <button class="btn-outline" style="flex:1; padding:0.45rem; font-size:0.82rem; color:#94a3b8;" onclick="adminAction('${listing.id}','pending')" id="reset-${listing.id}">↩ Reset to Pending</button>
    `;

    return `
        <div class="admin-listing-card" data-status="${listing.status}" data-id="${listing.id}">
            <div class="admin-card-img">
                ${imgHtml}
            </div>
            <div class="admin-card-body">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:1rem;">
                    <div>
                        <span class="listing-status-badge ${status.cls}">${status.label}</span>
                        <h4 style="margin:0.4rem 0 0.2rem; font-size:1.05rem;">${listing.title}</h4>
                        <p style="color:var(--accent-cyan); font-weight:700; font-size:1.1rem; margin:0;">৳${priceFormatted}</p>
                    </div>
                    <div style="text-align:right; flex-shrink:0;">
                        <span class="badge badge-condition">${listing.condition}</span><br>
                        <small style="color:var(--text-muted);">${CATEGORY_EMOJIS[listing.category] || '📦'} ${listing.category}</small>
                    </div>
                </div>
                <p style="color:var(--text-muted); font-size:0.88rem; margin:0.75rem 0; line-height:1.55;">${listing.description}</p>
                <div style="display:flex; align-items:center; justify-content:space-between; gap:0.5rem; flex-wrap:wrap;">
                    <small style="color:var(--text-muted);">Seller: <strong style="color:var(--text-secondary);">${listing.sellerName}</strong> &nbsp;|&nbsp; ${new Date(listing.createdAt).toLocaleDateString('en-GB')}</small>
                    <div style="display:flex; gap:0.5rem;">
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
function renderPublicListings(category = 'all') {
    const grid = document.getElementById('listingsGrid');
    const emptyEl = document.getElementById('listingsEmpty');
    if (!grid) return;

    let listings = getListings().filter(l => l.status === 'approved');
    if (category !== 'all') listings = listings.filter(l => l.category === category);

    if (listings.length === 0) {
        grid.innerHTML = '';
        if (emptyEl) emptyEl.style.display = 'flex';
    } else {
        if (emptyEl) emptyEl.style.display = 'none';
        grid.innerHTML = listings.map(renderListingCard).join('');
    }
}

/**
 * Renders seller's own listings on profile.html
 */
function renderSellerListings(statusFilter = 'all') {
    const grid = document.getElementById('sellerListingsGrid');
    const emptyEl = document.getElementById('sellerEmpty');
    if (!grid) return;

    const user = getUser();
    let listings = getListings().filter(l => l.sellerId === user.id || l.sellerEmail === user.email);
    if (statusFilter !== 'all') listings = listings.filter(l => l.status === statusFilter);

    if (listings.length === 0) {
        grid.innerHTML = '';
        if (emptyEl) emptyEl.style.display = 'flex';
    } else {
        if (emptyEl) emptyEl.style.display = 'none';
        grid.innerHTML = listings.map(renderSellerCard).join('');
    }
}

/**
 * Renders buyer browse view on profile.html
 */
function renderBuyerListings(category = 'all') {
    const grid = document.getElementById('buyerListingsGrid');
    const emptyEl = document.getElementById('buyerEmpty');
    if (!grid) return;

    let listings = getListings().filter(l => l.status === 'approved');
    if (category !== 'all') listings = listings.filter(l => l.category === category);

    if (listings.length === 0) {
        grid.innerHTML = '';
        if (emptyEl) emptyEl.style.display = 'flex';
    } else {
        if (emptyEl) emptyEl.style.display = 'none';
        grid.innerHTML = listings.map(renderListingCard).join('');
    }
}

/**
 * Renders admin listing panel on profile.html
 */
function renderAdminListings(statusFilter = 'all') {
    const container = document.getElementById('adminListingsContainer');
    const emptyEl = document.getElementById('adminEmpty');
    if (!container) return;

    let listings = getListings();
    if (statusFilter !== 'all') listings = listings.filter(l => l.status === statusFilter);
    listings = listings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (listings.length === 0) {
        container.innerHTML = '';
        if (emptyEl) emptyEl.style.display = 'flex';
    } else {
        if (emptyEl) emptyEl.style.display = 'none';
        container.innerHTML = `<div class="admin-listings-list">${listings.map(renderAdminCard).join('')}</div>`;
    }
}

// ─── Action Handlers ──────────────────────────────────────────

function adminAction(id, newStatus) {
    updateListingStatus(id, newStatus);
    const activeTab = document.querySelector('#adminStatusTabs .status-tab.active');
    const filter = activeTab ? activeTab.dataset.status : 'all';
    renderAdminListings(filter);
}

function deleteMyListing(id) {
    if (!confirm('Are you sure you want to delete this listing?')) return;
    deleteListing(id);
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

function handleMessageClick(id) {
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
    window.location.href = `chat.html?listing=${id}`;
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

        if (role === 'admin') {
            navHtml += `
                <a href="profile.html" class="${currentPath.includes('profile') ? 'active' : ''}">Admin Panel</a>
            `;
        } else if (role === 'seller') {
            navHtml += `
                <a href="profile.html" class="${currentPath.includes('profile') ? 'active' : ''}">My Listings</a>
            `;
        } else {
            // Buyer
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
                emptyBtn.innerText = 'Go to Dashboard to List →';
            } else {
                emptyBtn.style.display = 'none';
            }
        }
        
        // Hide marketing footer links for logged-in users
        const footerLinks = document.querySelectorAll('.footer-links li a');
        footerLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href === 'signup.html' || href === '#safety' || href === 'index.html#safety' || href === 'escrow-policy.html' || href === 'escrow-policy.html#dispute' || href === 'escrow-policy.html#terms' || href === 'escrow-policy.html#privacy') {
                // Keep the legal links that might still be applicable, but definitely hide signup and safety (if safety is hidden on app view)
                if (href === 'signup.html' || href === '#safety') {
                    link.parentElement.style.display = 'none';
                }
            }
        });
    } else {
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
        const user = await window.api.request(`/users/me?token=${response.access_token}`);

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

async function signupUser(name, email, password, role) {
    try {
        await window.api.signup({ full_name: name, email, password, role });
        await loginUser(email, password, role);
    } catch (error) {
        alert('Signup failed: ' + error.message);
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

    const user = getUser();

    // ── App-view mode on index.html (hide marketing for logged-in users)
    if (user) {
        document.body.classList.add('app-view');
    }

    // ──────────────────────────────────────────────────────────
    //  INDEX.HTML — Public Listings + Filter
    // ──────────────────────────────────────────────────────────
    const listingsGrid = document.getElementById('listingsGrid');
    if (listingsGrid) {
        renderPublicListings('all');

        // Filter buttons
        const filterBtns = document.querySelectorAll('#listingsFilter .filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderPublicListings(btn.dataset.category);
            });
        });
    }

    // ──────────────────────────────────────────────────────────
    //  INDEX.HTML — Live Stats from Backend (/stats)
    // ──────────────────────────────────────────────────────────
    const statTotalUsers    = document.getElementById('statTotalUsers');
    const statSellers       = document.getElementById('statSellers');
    const statSatisfaction  = document.getElementById('statSatisfaction');
    const statAvgSale       = document.getElementById('statAvgSale');
    const statUserBreakdown = document.getElementById('statUserBreakdown');

    if (statTotalUsers) {
        loadLiveStats();
    }

    // ──────────────────────────────────────────────────────────
    //  PROFILE.HTML — Role-Based Views
    // ──────────────────────────────────────────────────────────
    const sellerView = document.getElementById('sellerView');
    const buyerView  = document.getElementById('buyerView');
    const adminView  = document.getElementById('adminView');

    if (sellerView || buyerView || adminView) {
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        const role = user.role || 'buyer';

        // Fill profile sidebar
        const userNameEl    = document.getElementById('userName');
        const userEmailEl   = document.getElementById('userEmail');
        const userInitialsEl = document.getElementById('userInitials');
        const userRoleBadgeEl = document.getElementById('userRoleBadge');

        if (userNameEl)    userNameEl.innerText = user.full_name;
        if (userEmailEl)   userEmailEl.innerText = user.email;
        if (userInitialsEl) userInitialsEl.innerText = user.initials;
        if (userRoleBadgeEl) {
            userRoleBadgeEl.innerHTML = `<span class="badge-role badge-${role}">${role}</span>`;
        }

        // Hide wallet/messages for admin
        const walletMenu = document.querySelector('.profile-menu-item[href="wallet.html"]');
        const chatMenu   = document.querySelector('.profile-menu-item[href="chat.html"]');
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
            renderAdminListings('all');

            // Admin status tabs
            const tabs = document.querySelectorAll('#adminStatusTabs .status-tab');
            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    tabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    renderAdminListings(tab.dataset.status);
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

        // Form submit
        const form = document.getElementById('createListingForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const user = getUser();
                if (!user) return;

                const listing = {
                    id: `listing_${Date.now()}_${Math.random().toString(36).substr(2,6)}`,
                    title:       document.getElementById('listingTitle').value.trim(),
                    category:    document.getElementById('listingCategory').value,
                    price:       document.getElementById('listingPrice').value,
                    condition:   document.getElementById('listingCondition').value,
                    description: document.getElementById('listingDesc').value.trim(),
                    imageUrl:    pendingImageUrls.length > 0 ? pendingImageUrls[0] : '',
                    imageUrls:   [...pendingImageUrls],
                    status:      'pending',
                    sellerId:    user.id,
                    sellerEmail: user.email,
                    sellerName:  user.full_name,
                    createdAt:   new Date().toISOString()
                };

                addListing(listing);
                form.reset();
                if (previewContainer) previewContainer.innerHTML = '';
                pendingImageUrls = [];
                closeModal('listingModal');

                // Show success notification
                showToast('🎉 Listing submitted! Awaiting admin approval.');
                renderSellerListings('all');

                // Reset seller tabs to 'all'
                const tabs = document.querySelectorAll('#sellerStatusTabs .status-tab');
                tabs.forEach(t => t.classList.remove('active'));
                const allTab = document.getElementById('sellerTabAll');
                if (allTab) allTab.classList.add('active');
            });
        }
    }

    // ──────────────────────────────────────────────────────────
    //  LOGIN & SIGNUP FORMS
    // ──────────────────────────────────────────────────────────
    const roleSelector = document.getElementById('roleSelector');
    if (roleSelector) {
        const tabs = roleSelector.querySelectorAll('.role-tab');
        const roleInput = document.getElementById('selectedRole');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const role = tab.getAttribute('data-role');
                if (roleInput) roleInput.value = role;
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
            });
        });
    }

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const pass  = document.getElementById('password').value;
            const role  = document.getElementById('selectedRole').value;
            loginUser(email, pass, role);
        });
    }

    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name  = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const pass  = document.getElementById('password').value;
            const role  = document.getElementById('selectedRole').value;
            signupUser(name, email, pass, role);
        });
    }

    // ──────────────────────────────────────────────────────────
    //  CHAT
    // ──────────────────────────────────────────────────────────
    const chatForm  = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');
    const chatBox   = document.getElementById('chatBox');

    if (chatForm && chatInput && chatBox) {
        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = chatInput.value.trim();
            if (!text) return;
            addMessage(text, 'user');
            chatInput.value = '';
        });
    }

    function addMessage(text, type) {
        const div = document.createElement('div');
        div.classList.add('message', type);
        div.innerText = text;
        chatBox.appendChild(div);
        chatBox.scrollTop = chatBox.scrollHeight;
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
                    const listings = getListings().filter(l =>
                        l.status === 'approved' &&
                        (l.title.toLowerCase().includes(query) || l.description.toLowerCase().includes(query))
                    );
                    if (listings.length === 0) {
                        grid.innerHTML = '';
                        const emptyEl = document.getElementById('listingsEmpty');
                        if (emptyEl) emptyEl.style.display = 'flex';
                    } else {
                        const emptyEl = document.getElementById('listingsEmpty');
                        if (emptyEl) emptyEl.style.display = 'none';
                        grid.innerHTML = listings.map(renderListingCard).join('');
                    }
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
        if (chatBox) {
            chatBox.innerHTML = '';
        }

        // Handle Active Listing Banner
        const urlParams = new URLSearchParams(window.location.search);
        const listingId = urlParams.get('listing');
        const bannerContainer = document.getElementById('chatListingBanner');
        
        if (listingId && bannerContainer) {
            const listings = getListings();
            const activeListing = listings.find(l => l.id === listingId);
            
            if (activeListing) {
                const imgSrc = (activeListing.imageUrls && activeListing.imageUrls.length > 0) ? activeListing.imageUrls[0] : (activeListing.imageUrl || CATEGORY_ICONS[activeListing.category] || '');
                const imgHtml = imgSrc ? `<img src="${imgSrc}" style="width: 48px; height: 48px; object-fit: cover; border-radius: 8px;">` : `<div style="width: 48px; height: 48px; background: #e2e8f0; border-radius: 8px; display:flex; align-items:center; justify-content:center;">📦</div>`;
                
                bannerContainer.innerHTML = `
                    <div style="display:flex; align-items:center; gap: 1rem;">
                        ${imgHtml}
                        <div>
                            <div style="font-weight: 600; font-size: 0.95rem;">${activeListing.title}</div>
                            <div style="color: var(--primary); font-weight: 700;">৳${Number(activeListing.price).toLocaleString('en-IN')}</div>
                        </div>
                    </div>
                    <button class="btn-primary" style="padding: 0.5rem 1rem; font-size: 0.85rem;" onclick="handleBuyClick('${activeListing.id}')">🛒 Buy with Escrow</button>
                `;
                bannerContainer.style.display = 'flex';
                
                // Add a welcome message to chat as visual starting point (mock)
                setTimeout(() => {
                    addMessage(`Hi, I'm interested in your ${activeListing.title}. Is it still available?`, 'user');
                }, 400);
            }
        }
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

// Expose globals needed by inline onclick attributes
window.adminAction    = adminAction;
window.deleteMyListing = deleteMyListing;
window.handleBuyClick = handleBuyClick;
window.logoutUser     = logoutUser;
