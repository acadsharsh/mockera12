// api.js - Centralized API Handler for Frontend

class ApiClient {
    constructor() {
        this.baseUrl = CONFIG.API_BASE_URL;
    }

    getToken() {
        return localStorage.getItem('token');
    }

    getHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        const token = this.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            ...options,
            headers: {
                ...this.getHeaders(),
                ...options.headers
            }
        };

        try {
            const response = await fetch(url, config);
            
            // Handle 401 Unauthorized (Logout)
            if (response.status === 401) {
                this.logout();
                return;
            }

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'API Request Failed');
            }

            return data;
        } catch (error) {
            console.error(`API Error [${endpoint}]:`, error);
            throw error;
        }
    }

    // Auth Methods
    async login(email, password) {
        const data = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        if (data.token) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user_role', data.role);
            localStorage.setItem('user_name', data.name);
        }
        return data;
    }

    async register(email, password, role) {
        return this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password, role })
        });
    }

    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user_role');
        localStorage.removeItem('user_name');
        window.location.href = '/auth/login.html';
    }

    // Student Methods
    async getTests() {
        return this.request('/student/tests');
    }

    async getTestDetails(testId) {
        return this.request(`/test/${testId}`);
    }

    async submitTest(submissionData) {
        return this.request('/student/submit', {
            method: 'POST',
            body: JSON.stringify(submissionData)
        });
    }

    async getResult(submissionId) {
        return this.request(`/student/result/${submissionId}`);
    }

    // Creator Methods
    async getStats() {
        return this.request('/creator/stats');
    }
}

const api = new ApiClient();
