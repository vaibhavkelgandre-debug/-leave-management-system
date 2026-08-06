import apiClient, { unwrap } from "./apiClient.js";

export async function getMyBalances({ year } = {}) {
    const response = await apiClient.get("/leave-balances/me", { params: year ? { year } : {} });
    return unwrap(response);
}

export async function getUserBalances(userId, { year } = {}) {
    const response = await apiClient.get(`/leave-balances/user/${userId}`, {
        params: year ? { year } : {},
    });
    return unwrap(response);
}
