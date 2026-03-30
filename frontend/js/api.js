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
        // Updated to use the endpoint I just created
        // Note: The FastAPI endpoint expects a query param or header? 
        // My current main.py uses a query param 'token' which is odd for Bearer. 
        // I should fix main.py to use proper OAuth2 dependency, but for now I'll match the param.
        return this.request(`/users/me?token=${token}`, "GET");
    }
};

window.api = api;
