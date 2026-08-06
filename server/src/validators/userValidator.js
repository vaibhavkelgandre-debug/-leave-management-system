// Request-shape and org-structure business rules for user/employee management
// endpoints (invites, role/manager assignment, activation status).
import { z } from "zod";

// Validates the payload for inviting a new employee, and enforces the org-chart
// rule that only EMPLOYEE/MANAGER roles have a manager and HR_ADMIN never does —
// keeping the reporting hierarchy consistent at creation time rather than in the DB.
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
        if (data.role === "HR_ADMIN" && data.managerId) {
            ctx.addIssue({
                code: "custom",
                path: ["managerId"],
                message: "HR_ADMIN accounts cannot have a manager",
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
