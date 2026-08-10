import apiClient, { unwrap } from "./apiClient.js";

export async function createDelegation({ delegateId, startDate, endDate }) {
    const response = await apiClient.post("/delegations", { delegateId, startDate, endDate });
    return unwrap(response);
}

export async function getMyDelegations() {
    const response = await apiClient.get("/delegations/mine");
    return unwrap(response);
}

// Delegations where the current user is the *delegate*, not the manager who
// nominated them — the only way an employee finds out they've been chosen,
// since nothing else notifies them. Open to any role, unlike getMyDelegations.
export async function getDelegationsAsDelegate() {
    const response = await apiClient.get("/delegations/as-delegate");
    return unwrap(response);
}
