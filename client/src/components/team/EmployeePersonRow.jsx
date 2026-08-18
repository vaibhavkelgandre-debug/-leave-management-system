// One person's row, shared by the read-only "All Employees" org view
// (EmployeesPage.jsx, `showActions={false}`) and the interactive "My Team"
// page (TeamPage.jsx, actions on by default) — the manager-reassign/
// activate-deactivate logic lives in exactly one place regardless of which
// page a person is currently rendered on.
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

const ALLOWED_MANAGER_ROLES = {
    MANAGER: ["HR_ADMIN"],
    EMPLOYEE: ["MANAGER", "HR_ADMIN"],
    // An HR admin's manager must be another HR admin — specifically
    // whichever HR admin created them (see the edit-permission note below) —
    // or the single SUPER_ADMIN.
    HR_ADMIN: ["HR_ADMIN", "SUPER_ADMIN"],
};

// `showReportsTo`: only useful where the surrounding card doesn't already
// make it obvious who this person reports to — a row inside a manager's own
// team card would just be repeating that card's own header, but a row in
// the "reports directly to HR" card needs it since there's no single
// grouping manager to imply it.
//
// `showActions`: change-manager/activate-deactivate only render on the "My
// Team" page (TeamPage.jsx) — managing your own team is what those actions
// are for, so the company-wide "All Employees" view (EmployeesPage.jsx)
// renders every row read-only by passing this false.
//
// `showProfileStatus`: the profile_status badge (INCOMPLETE/SUBMITTED/
// VERIFIED) only renders on "My Team" — that's where HR needs, at a glance,
// to tell who on their team is already verified from who still isn't.
export function EmployeePersonRow({
    user,
    users,
    onChanged,
    showReportsTo = false,
    showActions = true,
    showProfileStatus = false,
    className = "",
}) {
    const { user: currentUser } = useAuth();
    const [isEditingManager, setIsEditingManager] = useState(false);
    const [selectedManagerId, setSelectedManagerId] = useState(user.manager_id || "");
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);

    const [statusError, setStatusError] = useState(null);
    const [statusSaving, setStatusSaving] = useState(false);

    const manager = users.find((u) => u.id === user.manager_id);
    const allowedManagerRoles = ALLOWED_MANAGER_ROLES[user.role] || [];
    const managerOptions = users.filter((u) => u.id !== user.id && allowedManagerRoles.includes(u.role));
    const fullName = `${user.first_name} ${user.last_name}`;
    const isSelf = user.id === currentUser.id;
    const isActive = user.status === "ACTIVE";
    // Auth is strict per-team: editing anyone's reporting line — not just an
    // HR admin's — is restricted server-side (userService.changeManager) to
    // whoever created them (`user.invited_by`), same mechanism as
    // canEditStatus below. A row with no recorded creator (`invited_by`,
    // e.g. a root HR admin who registered directly) can't be edited by
    // anyone here — mirrored client-side so the icon doesn't invite a click
    // that would just 403.
    const canEditManager = Boolean(user.invited_by) && currentUser.id === user.invited_by;
    // Activating/deactivating is restricted the same way, for every role —
    // only whoever created this account may toggle its status. A row with
    // no recorded creator (`invited_by`) can't be toggled by anyone here.
    const canEditStatus = Boolean(user.invited_by) && currentUser.id === user.invited_by;

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

    return (
        <li
            className={`flex flex-wrap items-start justify-between gap-3 px-4 py-3 transition hover:bg-slate-50/80 ${
                isSelf ? "bg-indigo-50/60 ring-1 ring-inset ring-indigo-200" : className
            }`}
        >
            <div className="flex min-w-0 items-start gap-3">
                <Avatar firstName={user.first_name} lastName={user.last_name} size="sm" />
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-900">{fullName}</span>
                        {isSelf && <Badge className="bg-indigo-100 text-indigo-700">You</Badge>}
                        <RoleBadge role={user.role} />
                        <StatusBadge status={user.status} />
                        {showProfileStatus && user.profile_status && (
                            <Badge className={STATUS_BADGE_CLASSES[user.profile_status]}>{user.profile_status}</Badge>
                        )}
                    </div>
                    <p className="text-xs text-slate-500">{user.email}</p>
                    {showReportsTo && (
                        <p className="mt-0.5 text-xs text-slate-500">
                            Reports to {manager ? `${manager.first_name} ${manager.last_name}` : "—"}
                        </p>
                    )}

                    {isEditingManager && (
                        <div className="mt-2 max-w-xs">
                            {error && (
                                <p role="alert" className="mb-1 text-xs text-red-600">
                                    {error}
                                </p>
                            )}
                            <div className="flex items-center gap-1.5">
                                <ManagerSelect
                                    id={`manager-${user.id}`}
                                    label={`Manager for ${fullName}`}
                                    value={selectedManagerId}
                                    onChange={(event) => setSelectedManagerId(event.target.value)}
                                    options={managerOptions}
                                    targetRole={user.role}
                                    currentUserId={currentUser.id}
                                />
                                <IconButton icon={Check} label="Save" variant="primary" loading={saving} onClick={saveManager} />
                                <IconButton icon={X} label="Cancel" variant="ghost" onClick={cancelEditing} />
                            </div>
                        </div>
                    )}
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

            {showActions && (
                <div className="flex shrink-0 items-center gap-1">
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
            )}
        </li>
    );
}
