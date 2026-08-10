import { findRoleByName } from "../../../repositories/roleRepository.js";
import { insertUser } from "../../../repositories/userRepository.js";
import { insertInvitation } from "../../../repositories/invitationRepository.js";
import { insertLeaveType } from "../../../repositories/leaveTypeRepository.js";
import { insertHoliday } from "../../../repositories/holidayRepository.js";
import { insertDelegation } from "../../../repositories/delegationRepository.js";
import { submitLeaveRequest } from "../../../services/leaveRequestService.js";
import { hashPassword } from "../../../utils/password.js";

export const DEFAULT_PASSWORD = "Password123!";

// `invitedBy`: when given, backs an `invitations` row for this user so tests
// can set up "who created this HR admin" (userRepository.js's `invited_by`
// column, used by userService.changeManager to restrict who may edit an
// HR_ADMIN's own reporting line) without going through the full HTTP invite
// flow. A fake unique token is fine — nothing in these tests ever redeems it.
export async function createUser({
    role = "EMPLOYEE",
    managerId = null,
    firstName = "Test",
    lastName = "User",
    email,
    password = DEFAULT_PASSWORD,
    status = "ACTIVE",
    invitedBy = null,
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

    if (invitedBy) {
        await insertInvitation({
            userId: user.id,
            tokenHash: `test-token-${user.id}-${Math.random().toString(36).slice(2)}`,
            invitedBy,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });
    }

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

// Goes through the real service (not a direct repository insert) so a test's
// setup produces the same ledger/audit side effects a real submission would
// — anything asserting on balance state after further actions needs that.
export async function createLeaveRequest({
    employeeId,
    leaveTypeId,
    startDate = "2027-02-01",
    endDate = "2027-02-01",
    startHalfDay = false,
    endHalfDay = false,
    reason = "Test reason",
} = {}) {
    return submitLeaveRequest(employeeId, { leaveTypeId, startDate, endDate, startHalfDay, endHalfDay, reason });
}

export async function createDelegation({
    managerId,
    delegateId,
    startDate = "2027-01-01",
    endDate = "2027-01-31",
} = {}) {
    return insertDelegation({ managerId, delegateId, startDate, endDate });
}
