import apiClient, { unwrap } from "./apiClient.js";

export async function getHolidays({ year } = {}) {
    const response = await apiClient.get("/holidays", { params: year ? { year } : {} });
    return unwrap(response);
}

export async function createHoliday({ name, holidayDate }) {
    const response = await apiClient.post("/holidays", { name, holidayDate });
    return unwrap(response);
}

export async function deleteHoliday(holidayId) {
    const response = await apiClient.delete(`/holidays/${holidayId}`);
    return unwrap(response);
}
