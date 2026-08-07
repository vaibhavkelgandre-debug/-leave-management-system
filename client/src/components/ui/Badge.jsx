import { BADGE_BASE_CLASSES, ROLE_BADGE_CLASSES, ROLE_LABELS, STATUS_BADGE_CLASSES } from "../../constants/badges.js";

export function Badge({ className = "", children }) {
    return <span className={`${BADGE_BASE_CLASSES} ${className}`}>{children}</span>;
}

export function RoleBadge({ role }) {
    return (
        <Badge className={ROLE_BADGE_CLASSES[role] || "bg-slate-100 text-slate-700"}>
            {ROLE_LABELS[role] || role}
        </Badge>
    );
}

export function StatusBadge({ status }) {
    return <Badge className={STATUS_BADGE_CLASSES[status] || "bg-slate-100 text-slate-500"}>{status}</Badge>;
}
