import { ROLES } from "../../constants/roles.js";

let counter = 0;

export function makeUser(overrides = {}) {
    counter += 1;
    return {
        id: overrides.id ?? `user-${counter}`,
        first_name: "Test",
        last_name: "User",
        email: `test${counter}@example.com`,
        role: ROLES.EMPLOYEE,
        manager_id: null,
        status: "ACTIVE",
        ...overrides,
    };
}
