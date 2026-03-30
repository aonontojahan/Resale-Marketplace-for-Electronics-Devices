// --- Session Management ---

/**
 * Checks if a user is currently 'logged in'.
 * Simulated using localStorage.
 */
function getUser() {
    const userJson = localStorage.getItem('resale_user');
    return userJson ? JSON.parse(userJson) : null;
}

/**
 * Updates the navigation bar based on auth state.
 */
function updateNav() {
    const nav = document.querySelector('nav');
    if (!nav) return;

    const user = getUser();
    const currentPath = window.location.pathname;

    if (user) {
        const role = user.role || 'buyer';
        let navHtml = `<a href="index.html#about" class="">About Us</a>`;

        if (role === 'admin') {
            navHtml += `
                <a href="#" class="">Dashboard</a>
                <a href="#" class="">Users</a>
                <a href="profile.html" class="${currentPath.includes('profile') ? 'active' : ''}">Profile</a>
            `;
        } else if (role === 'seller') {
            navHtml += `
                <a href="chat.html" class="${currentPath.includes('chat') ? 'active' : ''}">Messages</a>
                <a href="wallet.html" class="${currentPath.includes('wallet') ? 'active' : ''}">Wallet</a>
                <a href="profile.html" class="${currentPath.includes('profile') ? 'active' : ''}">My Store</a>
            `;
        } else {
            // Buyer
            navHtml += `
                <a href="chat.html" class="${currentPath.includes('chat') ? 'active' : ''}">Messages</a>
                <a href="wallet.html" class="${currentPath.includes('wallet') ? 'active' : ''}">Wallet</a>
                <a href="profile.html" class="${currentPath.includes('profile') ? 'active' : ''}">Profile</a>
            `;
        }
        nav.innerHTML = navHtml;
    } else {
        // Logged Out: Show Browse, Login, Signup
        nav.innerHTML = `
            <a href="index.html#about">About Us</a>
            <a href="login.html" class="${currentPath.includes('login') ? 'active' : ''}">Login</a>
            <a href="signup.html" class="${currentPath.includes('signup') ? 'active' : ''}">Sign Up</a>
        `;
    }
}

/**
 * Simulated Login Function
 */
function loginUser(email, password, role) {
    // Specifying the user's requested credentials for the simulation.
    if (password !== 'aonontojahan') {
        alert('Invalid password. Hint: aonontojahan');
        return;
    }
    const mockUser = {
        name: 'Aonontojahan',
        email: email || 'aonontojahan@gmail.com',
        initials: 'AJ',
        role: role || 'buyer'
    };
    localStorage.setItem('resale_user', JSON.stringify(mockUser));
    window.location.href = 'profile.html';
}

/**
 * Simulated Signup Function
 */
function signupUser(name, email, password, role) {
    const mockUser = {
        name: name || 'Aonontojahan',
        email: email || 'aonontojahan@gmail.com',
        initials: (name || 'Aonontojahan').split(' ').map(n => n[0]).join('').toUpperCase(),
        role: role || 'buyer'
    };
    localStorage.setItem('resale_user', JSON.stringify(mockUser));
    window.location.href = 'profile.html';
}

/**
 * Simulated Logout Function
 */
function logoutUser() {
    localStorage.removeItem('resale_user');
    window.location.href = 'index.html';
}

// --- Product Data ---

const productsData = {
    'iphone-13': {
        title: 'iPhone 13 Pro - 256GB Midnight',
        price: '৳82,500',
        image: 'assets/iphone.png',
        condition: 'Like New',
        rating: '⭐ 4.9 (42 reviews)',
        description: 'This iPhone 13 Pro is in excellent condition, barely used for 3 months. Battery health is at 98%. It includes the original box and a protective case. Unlocked and ready for any carrier.'
    },
    'macbook-m2': {
        title: 'MacBook Air M2 (2022) - 8GB/256GB Platinum',
        price: '৳1,15,000',
        image: 'assets/macbook.png',
        condition: 'Excellent',
        rating: '⭐ 4.8 (15 reviews)',
        description: 'Blazing fast MacBook Air with the M2 chip. Only 20 battery cycles. Perfect for students and professionals. Original charger included.'
    },
    'sony-a7iii': {
        title: 'Sony Alpha a7 III - Full Frame Mirrorless (Body Only)',
        price: '৳1,35,000',
        image: 'assets/sony.png',
        condition: 'Good',
        rating: '⭐ 4.7 (28 reviews)',
        description: 'Professional full-frame camera body. Minor scratches on the base but sensor is spotless. Shutter count around 15k. Great for videography.'
    },
    'ipad-pro': {
        title: 'iPad Pro 11-inch (M1) - 128GB Wi-Fi',
        price: '৳72,000',
        image: 'assets/ipad.png',
        condition: 'Flawless',
        rating: '⭐ 5.0 (10 reviews)',
        description: 'Crystal clear display with M1 power. Supports Apple Pencil 2nd Gen. Always kept in a screen protector and case. No dents or scratches.'
    },
    'samsung-s24': {
        title: 'Samsung Galaxy S24 Ultra - 512GB Titanium Black',
        price: '৳1,38,000',
        image: 'assets/samsung_phone.png',
        condition: 'Brand New',
        rating: '⭐ 5.0 (8 reviews)',
        description: 'The ultimate AI phone. Unopened box, full official warranty. 200MP camera, S-Pen included. Experience the best of Android.'
    },
    'xiaomi-14': {
        title: 'Xiaomi 14 Ultra - 16GB/512GB (Leica Optics)',
        price: '৳1,25,000',
        image: 'assets/xiaomi_phone.png',
        condition: 'Like New',
        rating: '⭐ 4.9 (5 reviews)',
        description: 'Photography beast with Leica Summilux lens. Barely used for a week. Zero scratches. Snapdragon 8 Gen 3. Global ROM.'
    }
};

// --- Navigation Logic ---

function viewProduct(productId) {
    window.location.href = `product.html?id=${productId}`;
}

/**
 * Dynamically loads product data onto product.html based on URL id.
 */
function loadProductDetails() {
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('id');
    
    if (!productId || !productsData[productId]) return;

    const product = productsData[productId];

    // Update DOM elements
    const titleEl = document.getElementById('productTitle');
    const priceEl = document.getElementById('productPrice');
    const imgEl = document.getElementById('productImg');
    const descEl = document.getElementById('productDesc');
    const badgeEl = document.getElementById('productBadge');
    const ratingEl = document.getElementById('productRating');

    if (titleEl) titleEl.innerText = product.title;
    if (priceEl) priceEl.innerText = product.price;
    if (imgEl) {
        imgEl.src = product.image;
        imgEl.alt = product.title;
    }
    if (descEl) descEl.innerText = product.description;
    if (badgeEl) badgeEl.innerText = product.condition;
    if (ratingEl) ratingEl.innerText = product.rating;
    
    // Update Page Title
    document.title = `${product.title} | ReSale`;
}

// --- Page-Specific Logic ---

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Navigation
    updateNav();

    // Load Dynamic Product Details (if on product.html)
    if (window.location.pathname.includes('product.html')) {
        loadProductDetails();
    }

    // Role Selector Logic
    const roleSelector = document.getElementById('roleSelector');
    if (roleSelector) {
        const tabs = roleSelector.querySelectorAll('.role-tab');
        const roleInput = document.getElementById('selectedRole');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const role = tab.getAttribute('data-role');
                roleInput.value = role;
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
            });
        });
    }

    // Login Form Handling
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

    // Signup Form Handling
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const pass = document.getElementById('password').value;
            const role = document.getElementById('selectedRole').value;
            signupUser(name, email, pass, role);
        });
    }

    // Profile Handling
    const userNameEl = document.getElementById('userName');
    const userEmailEl = document.getElementById('userEmail');
    const userInitialsEl = document.getElementById('userInitials');
    const userRoleBadgeEl = document.getElementById('userRoleBadge');
    const createListingBtn = document.getElementById('createListingBtn');
    const profileSectionTitle = document.getElementById('profileSectionTitle');

    if (userNameEl || userEmailEl) {
        const user = getUser();
        if (user) {
            const role = user.role || 'buyer';
            if (userNameEl) userNameEl.innerText = user.name;
            if (userEmailEl) userEmailEl.innerText = user.email;
            if (userInitialsEl) userInitialsEl.innerText = user.initials;
            
            if (userRoleBadgeEl) {
                userRoleBadgeEl.innerHTML = `<span class="badge-role badge-${role}">${role}</span>`;
            }

            // Role-based UI visibility
            if (createListingBtn && profileSectionTitle) {
                if (role === 'buyer') {
                    createListingBtn.style.display = 'none';
                    profileSectionTitle.innerText = 'My Orders';
                } else if (role === 'admin') {
                    createListingBtn.innerText = '+ Add New Product';
                    profileSectionTitle.innerText = 'Global Management';
                } else {
                    // Seller
                    createListingBtn.style.display = 'block';
                    profileSectionTitle.innerText = 'My Listings';
                }
            }
        } else if (window.location.pathname.includes('profile')) {
            // Redirect to login if trying to access profile while logged out
            window.location.href = 'login.html';
        }
    }

    // Chat Interactivity
    const chatForm = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');
    const chatBox = document.getElementById('chatBox');

    if (chatForm && chatInput && chatBox) {
        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const messageText = chatInput.value.trim();

            if (messageText !== "") {
                addMessage(messageText, 'user');
                chatInput.value = "";

                setTimeout(() => {
                    const responses = [
                        "That sounds good! When can we meet?",
                        "Is the price negotiable?",
                        "I can meet you this afternoon.",
                        "Great! I'll be there."
                    ];
                    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
                    addMessage(randomResponse, 'seller');
                }, 1000);
            }
        });
    }

    function addMessage(text, type) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', type);
        messageDiv.innerText = text;
        chatBox.appendChild(messageDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    // Search Logic (Mock)
    const searchBar = document.querySelector('.search-bar');
    if (searchBar) {
        searchBar.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = searchBar.value.toLowerCase();
                alert(`Searching for: ${query}\n(Normally this would redirect)`);
            }
        });
    }
});
