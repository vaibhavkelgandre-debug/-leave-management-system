import * as leaveBalanceService from "../services/leaveBalanceService.js";
import { sendSuccess } from "../utils/apiResponse.js";

export async function getMyBalances(req, res, next) {
    try {
        const balances = await leaveBalanceService.getBalancesForUser(req.user.id, req.query.year);
        sendSuccess(res, 200, "Balances retrieved", balances);
    } catch (error) {
        next(error);
    }
}

export async function getUserBalances(req, res, next) {
    try {
        const balances = await leaveBalanceService.getBalancesForUser(req.params.id, req.query.year);
        sendSuccess(res, 200, "Balances retrieved", balances);
    } catch (error) {
        next(error);
    }
}
