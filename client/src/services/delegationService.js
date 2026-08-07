import apiClient, { unwrap } from "./apiClient.js";

export async function createDelegation({ delegateId, startDate, endDate }) {
    const response = await apiClient.post("/delegations", { delegateId, startDate, endDate });
    return unwrap(response);
}

export async function getMyDelegations() {
    const response = await apiClient.get("/delegations/mine");
    return unwrap(response);
}
