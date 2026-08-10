// Request-shape and org-structure business rules for user/employee management
// endpoints (invites, role/manager assignment, activation status).
import { z } from "zod";

// Validates the payload for inviting a new employee, and enforces that
// EMPLOYEE and HR_ADMIN both require a managerId at creation time (a MANAGER
// may be created without one, unchanged) — the actual role-compatibility
// check (who's an allowed manager for which target role) lives in
// reportingService.assertManagerAllowed, not here, so it stays in one place
// for both invite and reassignment.
export const inviteEmployeeSchema = z
    .object({
        firstName: z.string().trim().min(1, "First name is required"),
        lastName: z.string().trim().min(1, "Last name is required"),
        email: z.string().trim().email("Enter a valid email address"),
        role: z.enum(["EMPLOYEE", "MANAGER", "HR_ADMIN"]),
        managerId: z.string().uuid("managerId must be a valid id").optional().nullable(),
    })
    .superRefine((data, ctx) => {
        if (data.role === "EMPLOYEE" && !data.managerId) {
            ctx.addIssue({
                code: "custom",
                path: ["managerId"],
                message: "managerId is required for employees",
            });
        }
        if (data.role === "HR_ADMIN" && !data.managerId) {
            ctx.addIssue({
                code: "custom",
                path: ["managerId"],
                // A new HR admin reports to whichever existing HR admin
                // created them (see reportingService.js) — the root
                // HR_ADMIN(s) with no manager at all only ever come from
                // POST /auth/register/hr, not this invite flow.
                message: "managerId is required for HR admins",
            });
        }
    });

// Shared check for any route with a :id param — guards against malformed ids
// reaching the repository layer as a raw SQL parameter.
export const userIdParamSchema = z.object({
    id: z.string().uuid("id must be a valid id"),
});

// Used when HR reassigns an employee's manager; managerId can be explicitly
// null to remove a manager (e.g. before promoting someone to HR_ADMIN).
export const updateManagerSchema = z.object({
    managerId: z.string().uuid("managerId must be a valid id").nullable(),
});

// Used when HR activates/deactivates an account — restricted to the two valid
// lifecycle states so a bad value can't leave a user in an undefined status.
export const updateStatusSchema = z.object({
    status: z.enum(["ACTIVE", "INACTIVE"]),
});
