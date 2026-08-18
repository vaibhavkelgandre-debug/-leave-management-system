import apiClient, { unwrap } from "./apiClient.js";

export async function getSalaryStructure(employeeId) {
    const response = await apiClient.get(`/employees/${employeeId}/salary-structure`);
    return unwrap(response);
}

export async function assignSalaryStructure(employeeId, fields) {
    const response = await apiClient.patch(`/employees/${employeeId}/salary-structure`, fields);
    return unwrap(response);
}
