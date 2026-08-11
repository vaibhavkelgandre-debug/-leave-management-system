import * as userService from "../services/userService.js";
import * as invitationService from "../services/invitationService.js";
import * as reportingService from "../services/reportingService.js";
import { sendSuccess } from "../utils/apiResponse.js";

// HR-only action to onboard a new employee/manager — there is no public registration,
// so this is how every non-HR account gets created.
export async function inviteEmployee(req, res, next) {
    try {
        const result = await invitationService.inviteEmployee(req.body, req.user.id);
        sendSuccess(res, 201, "Employee invited", result);
    } catch (error) {
        next(error);
    }
}

// Lists users, scoped by the caller's role (e.g. HR sees everyone, a manager may only
// see their reports) — the actual visibility rules live in userService.
export async function getUsers(req, res, next) {
    try {
        const users = await userService.listUsersFor(req.user);
        sendSuccess(res, 200, "Users retrieved", users);
    } catch (error) {
        next(error);
    }
}

// Gives a manager the list of people who report to them, for the manager dashboard.
export async function getMyTeam(req, res, next) {
    try {
        const team = await reportingService.getTeam(req.user.id);
        sendSuccess(res, 200, "Team retrieved", team);
    } catch (error) {
        next(error);
    }
}

// Fetches a single user's profile by id, e.g. for HR/manager detail views.
export async function getUserById(req, res, next) {
    try {
        const user = await userService.getUserById(req.params.id);
        sendSuccess(res, 200, "User retrieved", user);
    } catch (error) {
        next(error);
    }
}

// Reassigns an employee to a different manager, keeping the reporting tree accurate as
// org structure changes.
export async function updateManager(req, res, next) {
    try {
        const user = await userService.changeManager(req.params.id, req.body.managerId, req.user);
        sendSuccess(res, 200, "Manager updated", user);
    } catch (error) {
        next(error);
    }
}

// Activates/deactivates a user account (e.g. offboarding) — passes the acting HR user
// through so the service can both record who made the change and check they're the one
// who created this account in the first place (see changeStatus).
export async function updateStatus(req, res, next) {
    try {
        const user = await userService.changeStatus(req.params.id, req.body.status, req.user);
        sendSuccess(res, 200, "Status updated", user);
    } catch (error) {
        next(error);
    }
}
