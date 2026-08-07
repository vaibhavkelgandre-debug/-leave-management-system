import { useState } from "react";
import { Check, Pencil, UserCheck, UserX, X } from "lucide-react";
import { updateManager, updateStatus } from "../../services/userService.js";
import { toErrorMessage } from "../../services/httpError.js";
import { useAuth } from "../../hooks/useAuth.js";
import { ManagerSelect } from "./ManagerSelect.jsx";
import { IconButton } from "../ui/IconButton.jsx";
import { RoleBadge, StatusBadge } from "../ui/Badge.jsx";

const ALLOWED_MANAGER_ROLES = {
    MANAGER: ["HR_ADMIN"],
    EMPLOYEE: ["MANAGER", "HR_ADMIN"],
};

export function EmployeeTableRow({ user, users, onChanged }) {
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
    const canHaveManager = user.role !== "HR_ADMIN";
    const isActive = user.status === "ACTIVE";

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
        <tr className="align-top hover:bg-slate-50">
            <td className="px-4 py-3">
                <div className="font-medium text-slate-900">{fullName}</div>
                <div className="text-xs text-slate-500">{user.email}</div>
            </td>
            <td className="px-4 py-3">
                <RoleBadge role={user.role} />
            </td>
            <td className="px-4 py-3">
                <StatusBadge status={user.status} />
            </td>
            <td className="px-4 py-3 text-slate-600">
                {!canHaveManager ? (
                    <span title="HR_ADMIN accounts do not have a manager">—</span>
                ) : isEditingManager ? (
                    <div className="flex flex-col gap-1.5">
                        {error && (
                            <p role="alert" className="text-xs text-red-600">
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
                            />
                            <IconButton icon={Check} label="Save" variant="primary" loading={saving} onClick={saveManager} />
                            <IconButton icon={X} label="Cancel" variant="ghost" onClick={cancelEditing} />
                        </div>
                    </div>
                ) : (
                    <span>{manager ? `${manager.first_name} ${manager.last_name}` : "—"}</span>
                )}
            </td>
            <td className="px-4 py-3">
                <div className="flex flex-col items-start gap-1.5">
                    {error && !isEditingManager && (
                        <p role="alert" className="text-xs text-red-600">
                            {error}
                        </p>
                    )}
                    {statusError && (
                        <p role="alert" className="text-xs text-red-600">
                            {statusError}
                        </p>
                    )}
                    <div className="flex items-center gap-1">
                        {canHaveManager && !isEditingManager && (
                            <IconButton icon={Pencil} label="Change manager" onClick={startEditing} />
                        )}
                        {user.status !== "INVITED" && (
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
                </div>
            </td>
        </tr>
    );
}
