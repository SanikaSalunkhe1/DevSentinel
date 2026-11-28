import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Essential for sending and receiving secure HTTP-only cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor to catch unauthorized responses globally
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Return structured error message
    const message = error.response?.data?.message || error.message || 'An unexpected error occurred';
    return Promise.reject(new Error(message));
  }
);
