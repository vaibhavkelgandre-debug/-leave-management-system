import { useState } from "react";
import { updateManager, updateStatus } from "../../services/userService.js";
import { toErrorMessage } from "../../services/httpError.js";
import { useAuth } from "../../hooks/useAuth.js";
import { ManagerSelect } from "./ManagerSelect.jsx";

const ALLOWED_MANAGER_ROLES = {
    MANAGER: ["HR_ADMIN"],
    EMPLOYEE: ["MANAGER", "HR_ADMIN"],
};

const actionButtonClasses =
    "rounded-md border px-2.5 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50";

const STATUS_BADGE_CLASSES = {
    ACTIVE: "bg-green-100 text-green-700",
    INVITED: "bg-amber-100 text-amber-700",
    INACTIVE: "bg-slate-100 text-slate-500",
};

const ROLE_BADGE_CLASSES = {
    HR_ADMIN: "bg-purple-100 text-purple-700",
    MANAGER: "bg-blue-100 text-blue-700",
    EMPLOYEE: "bg-slate-100 text-slate-700",
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
        const nextStatus = user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
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
                <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        ROLE_BADGE_CLASSES[user.role] || "bg-slate-100 text-slate-700"
                    }`}
                >
                    {user.role}
                </span>
            </td>
            <td className="px-4 py-3">
                <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_BADGE_CLASSES[user.status] || "bg-slate-100 text-slate-500"
                    }`}
                >
                    {user.status}
                </span>
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
                        <ManagerSelect
                            id={`manager-${user.id}`}
                            label={`Manager for ${fullName}`}
                            value={selectedManagerId}
                            onChange={(event) => setSelectedManagerId(event.target.value)}
                            options={managerOptions}
                            targetRole={user.role}
                        />
                        <div className="flex gap-1.5">
                            <button
                                type="button"
                                onClick={saveManager}
                                disabled={saving}
                                className={`${actionButtonClasses} border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100`}
                            >
                                {saving ? "Saving…" : "Save"}
                            </button>
                            <button
                                type="button"
                                onClick={cancelEditing}
                                className={`${actionButtonClasses} border-slate-200 text-slate-600 hover:bg-slate-50`}
                            >
                                Cancel
                            </button>
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
                    <div className="flex flex-wrap gap-1.5">
                        {canHaveManager && !isEditingManager && (
                            <button
                                type="button"
                                onClick={startEditing}
                                className={`${actionButtonClasses} border-indigo-200 text-indigo-700 hover:bg-indigo-50`}
                            >
                                Change manager
                            </button>
                        )}
                        {user.status !== "INVITED" && (
                            <button
                                type="button"
                                onClick={toggleStatus}
                                disabled={statusSaving || isSelf}
                                title={isSelf ? "You cannot deactivate your own account" : undefined}
                                className={`${actionButtonClasses} ${
                                    user.status === "ACTIVE"
                                        ? "border-red-200 text-red-600 hover:bg-red-50"
                                        : "border-green-200 text-green-700 hover:bg-green-50"
                                }`}
                            >
                                {statusSaving ? "Saving…" : user.status === "ACTIVE" ? "Deactivate" : "Activate"}
                            </button>
                        )}
                    </div>
                </div>
            </td>
        </tr>
    );
}
