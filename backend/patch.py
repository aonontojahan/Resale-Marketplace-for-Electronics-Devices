import re

def patch_file():
    with open('frontend/js/app.js', 'r', encoding='utf-8') as f:
        code = f.read()

    # 1. Remove mock db functions
    code = re.sub(
        r'// ─── Listings Storage \(simulated DB\) ─────────────────────────.*?// ─── Category Icon Map ────────────────────────────────────────',
        '// ─── Category Icon Map ────────────────────────────────────────',
        code,
        flags=re.DOTALL
    )

    # 2. Async render functions
    code = code.replace(
        "function renderPublicListings(category = 'all') {",
        "async function renderPublicListings(category = 'all') {"
    )
    code = code.replace(
        "let listings = getListings().filter(l => l.status === 'approved');",
        "let allListings = await window.api.getListings();\n    let listings = allListings.filter(l => l.status === 'approved');"
    )

    code = code.replace(
        "function renderSellerListings(statusFilter = 'all') {",
        "async function renderSellerListings(statusFilter = 'all') {"
    )
    code = code.replace(
        "let listings = getListings().filter(l => l.sellerId === user.id || l.sellerEmail === user.email);",
        "let allListings = await window.api.getListings();\n    let listings = allListings.filter(l => l.seller_id === user.id || l.sellerEmail === user.email);"
    )

    code = code.replace(
        "function renderBuyerListings(category = 'all') {",
        "async function renderBuyerListings(category = 'all') {"
    )

    code = code.replace(
        "function renderAdminListings(statusFilter = 'all') {",
        "async function renderAdminListings(statusFilter = 'all') {"
    )
    code = code.replace(
        "let listings = getListings();",
        "let listings = await window.api.getListings();\n    if(!listings) listings = [];"
    )

    # 3. Actions
    code = code.replace(
        "function adminAction(id, newStatus) {\n    updateListingStatus(id, newStatus);",
        "async function adminAction(id, newStatus) {\n    await window.api.updateListingStatus(id, newStatus);"
    )

    code = code.replace(
        "function deleteMyListing(id) {\n    if (!confirm('Are you sure you want to delete this listing?')) return;\n    deleteListing(id);",
        "async function deleteMyListing(id) {\n    if (!confirm('Are you sure you want to delete this listing?')) return;\n    await window.api.deleteListing(id);"
    )

    # 4. Search bar
    code = code.replace(
        "const listings = getListings().filter(l =>",
        "window.api.getListings().then(allListings => {\n                    const listings = allListings.filter(l =>"
    )
    code = code.replace(
        "grid.innerHTML = listings.map(renderListingCard).join('');\n                    }\n                }\n            }",
        "grid.innerHTML = listings.map(renderListingCard).join('');\n                    }\n                });\n                }\n            }"
    )

    # 5. Form Submit Fix
    form_submit_replacement = """
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
                formData.append('token', user.token);
                
                const fileInput = document.getElementById('listingImages');
                if (fileInput && fileInput.files.length > 0) {
                    formData.append('image', fileInput.files[0]);
                }

                try {
                    await window.api.createListing(formData);
                    form.reset();
                    if (previewContainer) previewContainer.innerHTML = '';
                    pendingImageUrls = [];
                    closeModal('listingModal');

                    showToast('🎉 Listing submitted! Awaiting admin approval.');
                    await renderSellerListings('all');

                    const tabs = document.querySelectorAll('#sellerStatusTabs .status-tab');
                    tabs.forEach(t => t.classList.remove('active'));
                    const allTab = document.getElementById('sellerTabAll');
                    if (allTab) allTab.classList.add('active');
                } catch(err) {
                    alert('Error creating listing: ' + err.message);
                }
            });
        }
"""

    old_form_submit = """        // Form submit
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
        }"""
    code = code.replace(old_form_submit, form_submit_replacement)

    code = re.sub(r'const imgSrc = \(.*?\) \? listing.imageUrls\[0\] : \(.*? \'\',\);?',
                  'const imgSrc = listing.image_url ? `http://localhost:8000${listing.image_url}` : (listing.imageUrl || \'\');', code)
    
    # We also need to fix `renderListingCard`, `renderSellerCard`, and `renderAdminCard` image parsing
    card_img_logic_old = "const imgSrc = (listing.imageUrls && listing.imageUrls.length > 0) ? listing.imageUrls[0] : (listing.imageUrl || CATEGORY_ICONS[listing.category] || '');"
    card_img_logic_new = "const imgSrc = listing.image_url ? `http://localhost:8000${listing.image_url}` : (listing.imageUrl || '');"
    code = code.replace(card_img_logic_old, card_img_logic_new)

    with open('frontend/js/app.js', 'w', encoding='utf-8') as f:
        f.write(code)

if __name__ == '__main__':
    patch_file()
    print('done')
