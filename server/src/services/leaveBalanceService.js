import {
    seedBalancesForUser as seedBalancesForUserRepo,
    backfillBalancesForLeaveType as backfillBalancesForLeaveTypeRepo,
    listBalancesForUser,
} from "../repositories/leaveBalanceRepository.js";

const currentYear = () => new Date().getFullYear();

export async function getBalancesForUser(userId, year) {
    return listBalancesForUser(userId, year || currentYear());
}

export async function seedBalancesForUser(userId) {
    await seedBalancesForUserRepo(userId, currentYear());
}

export async function backfillBalancesForLeaveType(leaveTypeId) {
    await backfillBalancesForLeaveTypeRepo(leaveTypeId, currentYear());
}
