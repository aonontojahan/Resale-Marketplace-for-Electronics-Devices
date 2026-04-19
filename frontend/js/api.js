const API_BASE_URL = "http://localhost:8000";

const api = {
    /**
     * Helper for authenticated and unauthenticated JSON requests.
     */
    async request(endpoint, method = "GET", body = null, token = null) {
        const headers = {
            "Content-Type": "application/json",
        };

        if (!token) {
            const userJson = localStorage.getItem('resale_user');
            if (userJson) {
                try {
                    const user = JSON.parse(userJson);
                    token = user.access_token || user.token;
                } catch (e) {
                    console.error("Failed to parse user session for token:", e);
                }
            }
        }

        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        const options = { method, headers };
        if (body) {
            options.body = JSON.stringify(body);
        }

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.detail || "Something went wrong");
            }
            return data;
        } catch (error) {
            console.error("API Error:", error);
            throw error;
        }
    },

    // ─── Auth ───────────────────────────────────────────────────────────────

    async signup(userData) {
        return this.request("/auth/signup", "POST", userData);
    },

    async login(credentials) {
        return this.request("/auth/login", "POST", credentials);
    },

    async getMe(token) {
        return this.request('/users/me', 'GET', null, token);
    },

    // ─── Wallet ─────────────────────────────────────────────────────────────

    async depositWallet(amount) {
        return this.request('/wallet/deposit', 'POST', { amount });
    },

    async getWalletTransactions() {
        return this.request('/wallet/transactions', 'GET');
    },

    // ─── Users ──────────────────────────────────────────────────────────────

    async getUsers(role = null) {
        let endpoint = "/users";
        if (role) endpoint += `?role=${role}`;
        return this.request(endpoint, "GET");
    },

    async adminUserAction(userId, action) {
        return this.request(`/admin/users/${userId}/action`, "POST", { action });
    },

    // ─── Products ───────────────────────────────────────────────────────────

    async getProducts(options = {}) {
        let endpoint = "/products";
        const queryParams = new URLSearchParams();

        if (options.page)         queryParams.append('page', options.page);
        if (options.limit)        queryParams.append('limit', options.limit);
        if (options.status && options.status !== 'all') queryParams.append('status', options.status);
        if (options.category && options.category !== 'all') queryParams.append('category', options.category);
        if (options.seller_id)    queryParams.append('seller_id', options.seller_id);
        if (options.search_query) queryParams.append('search_query', options.search_query);

        const qs = queryParams.toString();
        if (qs) endpoint += `?${qs}`;
        return this.request(endpoint, "GET");
    },
    
    async getProduct(productId) {
        return this.request(`/products/${productId}`, "GET");
    },

    /**
     * Create a product. Uses raw fetch because we send FormData (multipart).
     * Token goes in the Authorization header, NOT in the form body.
     */
    async createProduct(formData, token) {
        if (!token) {
            const userJson = localStorage.getItem('resale_user');
            if (userJson) {
                try {
                    const user = JSON.parse(userJson);
                    token = user.token || user.access_token;
                } catch (e) {
                    console.error("Failed to parse user session for token:", e);
                }
            }
        }
        try {
            const response = await fetch(`${API_BASE_URL}/products`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || 'Something went wrong');
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    async updateProductStatus(productId, status) {
        return this.request(`/products/${productId}/status`, "PATCH", { status });
    },

    async deleteProduct(productId) {
        return this.request(`/products/${productId}`, "DELETE");
    },

    // ─── Chats ──────────────────────────────────────────────────────────────

    async createChat(productId, buyerId, sellerId) {
        return this.request("/chats", "POST", {
            product_id: productId,
            buyer_id: buyerId,
            seller_id: sellerId
        });
    },

    async getUserChats(userId) {
        return this.request(`/chats?user_id=${userId}`, "GET");
    },

    async getChatMessages(sessionId) {
        return this.request(`/chats/${sessionId}/messages`, "GET");
    },

    async deleteChat(sessionId) {
        return this.request(`/chats/${sessionId}`, "DELETE");
    },

    async markChatRead(sessionId, userId) {
        return this.request(`/chats/${sessionId}/read?user_id=${userId}`, "POST");
    },

    // ─── Reviews ────────────────────────────────────────────────────────────

    async createReview(reviewData) {
        return this.request('/reviews', 'POST', reviewData);
    }
};

window.api = api;
