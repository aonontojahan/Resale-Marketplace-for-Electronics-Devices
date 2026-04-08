const API_BASE_URL = "http://localhost:8000";

const api = {
    /**
     * Helper for authenticated and unauthenticated requests.
     */
    async request(endpoint, method = "GET", body = null, token = null) {
        const headers = {
            "Content-Type": "application/json",
        };
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        const options = {
            method,
            headers,
        };
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

    /**
     * User registration.
     */
    async signup(userData) {
        return this.request("/auth/signup", "POST", userData);
    },

    /**
     * User login.
     */
    async login(credentials) {
        return this.request("/auth/login", "POST", credentials);
    },

    /**
     * Get current user profile.
     */
    async getMe(token) {
        return this.request('/users/me', 'GET', null, token);
    },

    /**
     * Get all users (for admin)
     */
    async getUsers(role = null) {
        let endpoint = "/users";
        if (role) {
            endpoint += `?role=${role}`;
        }
        return this.request(endpoint, "GET");
    },

    /**
     * Admin: Perform disciplinary action
     */
    async adminUserAction(userId, action) {
        return this.request(`/admin/users/${userId}/action`, "POST", { action });
    },

    /**
     * Chat: Create or fetch existing session
     */
    async createChat(listingId, buyerId, sellerId) {
        return this.request("/chats", "POST", {
            listing_id: listingId,
            buyer_id: buyerId,
            seller_id: sellerId
        });
    },

    /**
     * Chat: Get all user sessions
     */
    async getUserChats(userId) {
        return this.request(`/chats?user_id=${userId}`, "GET");
    },
    
    /**
     * Chat: Get message history
     */
    async getChatMessages(sessionId) {
        return this.request(`/chats/${sessionId}/messages`, "GET");
    },
    
    /**
     * Listings API
     */
    async getListings(options = {}) {
        let endpoint = "/listings";
        const queryParams = new URLSearchParams();
        
        if (options.page) queryParams.append('page', options.page);
        if (options.limit) queryParams.append('limit', options.limit);
        if (options.status && options.status !== 'all') queryParams.append('status', options.status);
        if (options.category && options.category !== 'all') queryParams.append('category', options.category);
        if (options.seller_id) queryParams.append('seller_id', options.seller_id);

        const queryString = queryParams.toString();
        if (queryString) {
            endpoint += `?${queryString}`;
        }
        return this.request(endpoint, "GET");
    },
    
    async createListing(formData, token) {
        // Uses fetch manually because we send FormData (not JSON).
        // Token is sent in the Authorization header, NOT in the form body.
        try {
            const response = await fetch(`${API_BASE_URL}/listings`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.detail || 'Something went wrong');
            }
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },
    
    async updateListingStatus(listingId, status) {
        return this.request(`/listings/${listingId}/status`, "PATCH", { status });
    },
    
    async deleteListing(listingId) {
        return this.request(`/listings/${listingId}`, "DELETE");
    },
    
    async deleteChat(sessionId) {
        return this.request(`/chats/${sessionId}`, "DELETE");
    },
    
    async markChatRead(sessionId, userId) {
        return this.request(`/chats/${sessionId}/read?user_id=${userId}`, "POST");
    }
};

window.api = api;
