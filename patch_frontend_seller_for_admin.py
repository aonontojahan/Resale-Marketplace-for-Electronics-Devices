import os

app_js_path = r"e:\PROJECTS\Resale-Marketplace-for-Electronics-Devices\frontend\js\app.js"

with open(app_js_path, "r", encoding="utf-8") as f:
    content = f.read()

orig_admin_seller = """async function renderSellerProductsForAdmin(sellerId, sellerName, previousRole = 'sellers') {
    window.currentAdminInlineStatus = `seller_products_${sellerId}`;
    window.currentSellerViewData = { id: sellerId, name: sellerName, prevRole: previousRole };

    const container = document.getElementById('adminListingsContainer');
    const emptyEl = document.getElementById('adminEmpty');
    const catFilterEl = document.getElementById('adminCategoryFilter');
    
    if (!container) return;
    if (catFilterEl) catFilterEl.style.display = 'none';

    container.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:2rem;">Loading seller products...</p>';
    if (emptyEl) emptyEl.style.display = 'none';

    try {
        let listings = await window.api.getListings();
        listings = listings.filter(l => l.seller_id === sellerId);
        listings = listings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const backBtnHtml = `
            <div style="margin-bottom: 2.5rem; display: flex; align-items: center; justify-content: space-between; background: var(--surface); padding: 1.75rem; border-radius: 20px; border: 1px solid var(--border); border-left: 6px solid var(--primary); box-shadow: var(--shadow-sm); transition: all 0.3s ease;">
                <div style="display: flex; align-items: center; gap: 1.5rem;">
                    <div style="width: 56px; height: 56px; background: rgba(99, 102, 241, 0.08); color: var(--primary); border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 1.6rem; border: 1px solid rgba(99, 102, 241, 0.15);">
                        í¿ª
                    </div>
                    <div>
                        <h3 style="margin: 0; font-size: 1.6rem; font-weight: 900; color: var(--secondary); letter-spacing: -0.03em;">Products by <span class="text-gradient">${sellerName}</span></h3>
                        <p style="margin: 0.25rem 0 0; font-size: 0.95rem; color: var(--text-muted); font-weight: 500;">Managing and reviewing live listings for this verified seller</p>
                    </div>
                </div>
                <div style="text-align: right;">
                    <span style="display: inline-block; padding: 0.6rem 1.4rem; border-radius: 99px; background: rgba(99, 102, 241, 0.08); color: var(--primary); font-weight: 800; font-size: 0.85rem; letter-spacing: 0.06em; border: 1px solid rgba(99, 102, 241, 0.15); box-shadow: 0 2px 4px rgba(99, 102, 241, 0.05);">${listings.length} TOTAL POSTS</span>
                </div>
            </div>
        `;

        if (listings.length === 0) {
            container.innerHTML = backBtnHtml;
            if (emptyEl) {
                emptyEl.style.display = 'flex';
                const emptyTitle = document.getElementById('adminEmptyTitle');
                const emptyDesc = document.getElementById('adminEmptyDesc');
                if (emptyTitle) emptyTitle.innerText = 'No Products Found';
                if (emptyDesc) emptyDesc.innerText = `${sellerName} hasn't posted any products yet.`;
            }
        } else {
            if (emptyEl) emptyEl.style.display = 'none';
            container.innerHTML = backBtnHtml + `<div class="admin-listings-list">${listings.map(renderAdminCard).join('')}</div>`;
        }
    } catch(err) {
        container.innerHTML = `<p style="text-align:center; color:red; padding:2rem;">Error: ${err.message}</p>`;
    }
}"""

new_admin_seller = """async function renderSellerProductsForAdmin(sellerId, sellerName, previousRole = 'sellers', page = 1) {
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
                        í¿ª
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
    } catch(err) {
        if (page === 1) container.innerHTML = `<p style="text-align:center; color:red; padding:2rem;">Error: ${err.message}</p>`;
        else console.error(err);
    }
}"""

content = content.replace(orig_admin_seller, new_admin_seller)

with open(app_js_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Seller Products for Admin Patch applied.")
