import apiClient, { unwrap } from "./apiClient.js";

export async function getUsers() {
    const response = await apiClient.get("/users");
    return unwrap(response);
}

export async function getMyTeam() {
    const response = await apiClient.get("/users/me/team");
    return unwrap(response);
}

export async function inviteEmployee({ firstName, lastName, email, role, managerId }) {
    const response = await apiClient.post("/users/invite", {
        firstName,
        lastName,
        email,
        role,
        managerId,
    });
    return unwrap(response);
}

export async function updateManager(userId, managerId) {
    const response = await apiClient.patch(`/users/${userId}/manager`, { managerId });
    return unwrap(response);
}

export async function updateStatus(userId, status) {
    const response = await apiClient.patch(`/users/${userId}/status`, { status });
    return unwrap(response);
}
