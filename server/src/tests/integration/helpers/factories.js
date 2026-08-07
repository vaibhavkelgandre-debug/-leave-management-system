import { findRoleByName } from "../../../repositories/roleRepository.js";
import { insertUser } from "../../../repositories/userRepository.js";
import { insertLeaveType } from "../../../repositories/leaveTypeRepository.js";
import { insertHoliday } from "../../../repositories/holidayRepository.js";
import { hashPassword } from "../../../utils/password.js";

export const DEFAULT_PASSWORD = "Password123!";

export async function createUser({
    role = "EMPLOYEE",
    managerId = null,
    firstName = "Test",
    lastName = "User",
    email,
    password = DEFAULT_PASSWORD,
    status = "ACTIVE",
} = {}) {
    const roleRecord = await findRoleByName(role);
    const passwordHash = password ? await hashPassword(password) : null;

    const user = await insertUser({
        firstName,
        lastName,
        email: email || `${firstName.toLowerCase()}.${Date.now()}.${Math.random().toString(36).slice(2)}@example.com`,
        passwordHash,
        roleId: roleRecord.id,
        managerId,
        status,
    });

    return { ...user, role, password };
}

export async function createRootHr(overrides = {}) {
    return createUser({ role: "HR_ADMIN", managerId: null, ...overrides });
}

export async function createInvitedUser(overrides = {}) {
    return createUser({ status: "INVITED", password: null, ...overrides });
}

export async function createLeaveType({
    name = `Leave Type ${Date.now()}.${Math.random().toString(36).slice(2)}`,
    annualEntitlement = 12,
    accrualType = "UPFRONT",
    allowNegativeBalance = false,
    requiresDocument = false,
} = {}) {
    return insertLeaveType({ name, annualEntitlement, accrualType, allowNegativeBalance, requiresDocument });
}

export async function createHoliday({ name = "Test Holiday", startDate = "2026-01-01", endDate } = {}) {
    return insertHoliday({ name, startDate, endDate: endDate || startDate });
}
