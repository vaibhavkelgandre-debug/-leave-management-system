import axios from "axios";

const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "http://localhost:5001/api",
    withCredentials: true,
    headers: { "Content-Type": "application/json" },
});

export function unwrap(response) {
    return response.data?.data ?? response.data;
}

let unauthorizedHandler = null;

export function setUnauthorizedHandler(handler) {
    unauthorizedHandler = handler;
}

apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 && error.config?.skipAuthRedirect !== true) {
            unauthorizedHandler?.();
        }
        return Promise.reject(error);
    }
);

export default apiClient;
