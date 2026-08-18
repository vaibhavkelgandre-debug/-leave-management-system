export const ROLE_BADGE_CLASSES = {
    SUPER_ADMIN: "bg-amber-200 text-amber-900",
    HR_ADMIN: "bg-purple-100 text-purple-700",
    MANAGER: "bg-blue-100 text-blue-700",
    EMPLOYEE: "bg-slate-100 text-slate-700",
};

export const STATUS_BADGE_CLASSES = {
    ACTIVE: "bg-green-100 text-green-700",
    INVITED: "bg-amber-100 text-amber-700",
    INACTIVE: "bg-slate-100 text-slate-500",
    // Leave request lifecycle states (Module 3).
    SUBMITTED: "bg-amber-100 text-amber-700",
    APPROVED: "bg-green-100 text-green-700",
    REJECTED: "bg-red-100 text-red-700",
    WITHDRAWN: "bg-slate-100 text-slate-500",
    CANCELLED: "bg-slate-100 text-slate-500",
    // Profile verification workflow (Module 5 v2). SUBMITTED is shared with
    // leave requests above — same "awaiting a decision" meaning either way.
    INCOMPLETE: "bg-slate-100 text-slate-500",
    VERIFIED: "bg-green-100 text-green-700",
    // Document review status (employee_documents.status).
    PENDING_REVIEW: "bg-amber-100 text-amber-700",
    // Salary slip status (salary_slips.status). ACTIVE is shared with the
    // account-status meaning above — same "good state" green either way.
    VOIDED: "bg-red-100 text-red-700",
};

export const BADGE_BASE_CLASSES = "rounded-full px-2 py-0.5 text-xs font-medium";

export const ROLE_LABELS = {
    SUPER_ADMIN: "Super Admin",
    HR_ADMIN: "HR",
    MANAGER: "Manager",
    EMPLOYEE: "Employee",
};
