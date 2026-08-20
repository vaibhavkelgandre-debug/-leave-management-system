// One person's row, shared by the read-only "All Employees" org view
// (EmployeesPage.jsx, `showActions={false}`) and the interactive "My Team"
// page (TeamPage.jsx, actions on by default) — the manager-reassign/
// activate-deactivate logic lives in exactly one place regardless of which
// page a person is currently rendered on. Renders as a single `<tr>` meant
// to sit inside EmployeeTable.jsx's `<table>`, never rendered standalone.
// The manager-edit form is a **separate full-width row** under the person's
// own (same pattern as SalarySlipList.jsx's void-reason prompt), reversing an
// earlier "keep it in the Employee cell" decision that turned out to break
// the table: ManagerSelect renders a `w-full` <select> *plus* helper text, and
// a cell can't contain something wider than its column without stretching it,
// so opening the dropdown visibly re-laid-out every column. A `colSpan` row
// is the only version that can't affect column widths at all. Short
// per-person errors (a failed status toggle) do stay in the cell.
import { useState } from "react";
import { Check, Pencil, UserCheck, UserX, X } from "lucide-react";
import { updateManager, updateStatus } from "../../services/userService.js";
import { toErrorMessage } from "../../services/httpError.js";
import { useAuth } from "../../hooks/useAuth.js";
import { ManagerSelect } from "./ManagerSelect.jsx";
import { Avatar } from "../ui/Avatar.jsx";
import { IconButton } from "../ui/IconButton.jsx";
import { Badge, RoleBadge, StatusBadge } from "../ui/Badge.jsx";
import { STATUS_BADGE_CLASSES } from "../../constants/badges.js";
import { ROLES } from "../../constants/roles.js";

const ALLOWED_MANAGER_ROLES = {
    MANAGER: ["HR_ADMIN"],
    EMPLOYEE: ["MANAGER", "HR_ADMIN"],
    // An HR admin's manager must be another HR admin — specifically
    // whichever HR admin created them (see the edit-permission note below) —
    // or the single SUPER_ADMIN.
    HR_ADMIN: ["HR_ADMIN", "SUPER_ADMIN"],
};

const tdClasses = "px-3 py-3 align-top text-sm text-slate-700";

function dash(value) {
    return value || "—";
}

// `showReportsTo`/`showActions`/`showProfileStatus`: passed down from
// EmployeeTable.jsx, which owns the `<thead>` these rows must match
// column-for-column — see that file for what decides each flag.
// `highlighted`: tints the row (the manager's own row atop their team's
// table, EmployeeTeamCard.jsx) so it reads as that table's header rather
// than just another report, without needing a second component.
export function EmployeePersonRow({
    user,
    users,
    onChanged,
    showReportsTo = false,
    showActions = true,
    showProfileStatus = false,
    highlighted = false,
    columnCount = 1,
}) {
    const { user: currentUser } = useAuth();
    const [isEditingManager, setIsEditingManager] = useState(false);
    const [selectedManagerId, setSelectedManagerId] = useState(user.manager_id || "");
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);

    const [statusError, setStatusError] = useState(null);
    const [statusSaving, setStatusSaving] = useState(false);

    // Both endpoints behind these controls (PATCH /users/:id/manager and
    // /status) are `requireRole("HR_ADMIN", "SUPER_ADMIN")` server-side, so
    // HR-tier is the whole client-side rule — a plain MANAGER is offered
    // neither, on any row, because the request would 403 whatever the row
    // says. Deliberately *not* also checking `user.invited_by` here: the
    // service's own rule is "the creator OR someone in my HR scope", and
    // actions only ever render on My Team (TeamPage.jsx), whose rows are the
    // viewer's own subtree by construction — so scope is already satisfied
    // for every row an HR-tier viewer can see, and re-checking creation would
    // just hide controls for anyone they inherited rather than invited. The
    // server re-checks per request regardless.
    const canManagePeople = currentUser.role === ROLES.HR_ADMIN || currentUser.role === ROLES.SUPER_ADMIN;
    const manager = users.find((u) => u.id === user.manager_id);
    const allowedManagerRoles = ALLOWED_MANAGER_ROLES[user.role] || [];
    const managerOptions = users.filter((u) => u.id !== user.id && allowedManagerRoles.includes(u.role));
    const fullName = `${user.first_name} ${user.last_name}`;
    const isSelf = user.id === currentUser.id;
    const isActive = user.status === "ACTIVE";
    // One flag, two controls: they've always had identical permissions, and
    // two names that could drift apart was the more confusing shape.
    const canEditManager = canManagePeople;
    const canEditStatus = canManagePeople;

    function startEditing() {
        setSelectedManagerId(user.manager_id || "");
        setError(null);
        setIsEditingManager(true);
    }

    function cancelEditing() {
        setIsEditingManager(false);
        setError(null);
    }

    async function saveManager() {
        setSaving(true);
        setError(null);
        try {
            await updateManager(user.id, selectedManagerId || null);
            setIsEditingManager(false);
            await onChanged();
        } catch (err) {
            setError(toErrorMessage(err, "Unable to update manager"));
        } finally {
            setSaving(false);
        }
    }

    async function toggleStatus() {
        const nextStatus = isActive ? "INACTIVE" : "ACTIVE";
        setStatusSaving(true);
        setStatusError(null);
        try {
            await updateStatus(user.id, nextStatus);
            await onChanged();
        } catch (err) {
            setStatusError(toErrorMessage(err, "Unable to update status"));
        } finally {
            setStatusSaving(false);
        }
    }

    // The person's row, then (only while editing) the manager-edit row — two
    // sibling <tr>s in a fragment rather than one row, which is what keeps the
    // form out of any single column.
    const personRow = (
        <tr
            className={`transition hover:bg-slate-50/80 ${
                isSelf ? "bg-indigo-50/60" : highlighted ? "bg-indigo-50/40" : ""
            }`}
        >
            <td className={tdClasses}>
                <div className="flex min-w-0 items-start gap-3">
                    <Avatar firstName={user.first_name} lastName={user.last_name} size="sm" />
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-medium text-slate-900">{fullName}</span>
                            {isSelf && <Badge className="bg-indigo-100 text-indigo-700">You</Badge>}
                        </div>

                        {error && !isEditingManager && (
                            <p role="alert" className="mt-1 text-xs text-red-600">
                                {error}
                            </p>
                        )}
                        {statusError && (
                            <p role="alert" className="mt-1 text-xs text-red-600">
                                {statusError}
                            </p>
                        )}
                    </div>
                </div>
            </td>
            <td className={tdClasses}>{dash(user.designation)}</td>
            <td className={tdClasses}>{dash(user.department)}</td>
            <td className={tdClasses}>
                <RoleBadge role={user.role} />
            </td>
            <td className={tdClasses}>
                <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={user.status} />
                    {showProfileStatus && user.profile_status && (
                        <Badge className={STATUS_BADGE_CLASSES[user.profile_status]}>{user.profile_status}</Badge>
                    )}
                </div>
            </td>
            <td className={tdClasses}>{user.email}</td>
            <td className={tdClasses}>{dash(user.phone)}</td>
            {showReportsTo && (
                <td className={tdClasses}>{manager ? `${manager.first_name} ${manager.last_name}` : "—"}</td>
            )}
            {showActions && (
                <td className={`${tdClasses} text-right whitespace-nowrap`}>
                    <div className="flex shrink-0 items-center justify-end gap-1">
                        {canEditManager && !isEditingManager && (
                            <IconButton icon={Pencil} label="Change manager" onClick={startEditing} />
                        )}
                        {/* Your own row keeps showing this (disabled) even though
                            you didn't "create yourself" — deactivating yourself is
                            already independently blocked below, and hiding it
                            entirely here would read as a missing control rather
                            than an intentional one. */}
                        {user.status !== "INVITED" && (isSelf || canEditStatus) && (
                            <IconButton
                                icon={isActive ? UserX : UserCheck}
                                label={isSelf ? "You cannot deactivate your own account" : isActive ? "Deactivate" : "Activate"}
                                variant={isActive ? "danger" : "success"}
                                loading={statusSaving}
                                disabled={isSelf}
                                onClick={toggleStatus}
                            />
                        )}
                    </div>
                </td>
            )}
        </tr>
    );

    if (!isEditingManager) return personRow;

    return (
        <>
            {personRow}
            <tr className="bg-slate-50/80">
                <td colSpan={columnCount} className="px-3 pb-3">
                    {error && (
                        <p role="alert" className="mb-1 text-xs text-red-600">
                            {error}
                        </p>
                    )}
                    {/* Capped at a readable width and left-aligned rather than
                        stretched across every column — a full-width <select>
                        on a wide table would be absurd; the row exists for the
                        layout guarantee, not to use all the space. */}
                    <div className="flex max-w-md items-start gap-1.5">
                        <div className="min-w-0 flex-1">
                            <ManagerSelect
                                id={`manager-${user.id}`}
                                label={`Manager for ${fullName}`}
                                value={selectedManagerId}
                                onChange={(event) => setSelectedManagerId(event.target.value)}
                                options={managerOptions}
                                targetRole={user.role}
                                currentUserId={currentUser.id}
                            />
                        </div>
                        <IconButton icon={Check} label="Save" variant="primary" loading={saving} onClick={saveManager} />
                        <IconButton icon={X} label="Cancel" variant="ghost" onClick={cancelEditing} />
                    </div>
                </td>
            </tr>
        </>
    );
}
