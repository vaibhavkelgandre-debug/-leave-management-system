import { useEffect, useState } from "react";
import { Pencil, Plus, UserCheck, UserX } from "lucide-react";
import { getLeaveTypes, updateLeaveTypeStatus } from "../services/leaveTypeService.js";
import { toErrorMessage } from "../services/httpError.js";
import { LeaveTypeForm } from "../components/leaveTypes/LeaveTypeForm.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { IconButton } from "../components/ui/IconButton.jsx";
import { Modal } from "../components/ui/Modal.jsx";
import { PageHeader } from "../components/ui/PageHeader.jsx";
import { StatusBadge } from "../components/ui/Badge.jsx";

function LeaveTypeRow({ leaveType, onChanged, onEdit }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    async function handleToggleStatus() {
        setBusy(true);
        setError(null);
        try {
            await updateLeaveTypeStatus(leaveType.id, !leaveType.is_active);
            await onChanged();
        } catch (err) {
            setError(toErrorMessage(err, "Unable to update status"));
        } finally {
            setBusy(false);
        }
    }

    return (
        <tr className="hover:bg-slate-50">
            <td className="px-4 py-3">
                <div className="font-medium text-slate-900">{leaveType.name}</div>
                {error && (
                    <div role="alert" className="text-xs text-red-600">
                        {error}
                    </div>
                )}
            </td>
            <td className="px-4 py-3 text-slate-600">{Number(leaveType.annual_entitlement)}</td>
            <td className="px-4 py-3 text-slate-600">{leaveType.accrual_type}</td>
            <td className="px-4 py-3 text-slate-600">{leaveType.allow_negative_balance ? "Yes" : "No"}</td>
            <td className="px-4 py-3 text-slate-600">{leaveType.requires_document ? "Yes" : "No"}</td>
            <td className="px-4 py-3">
                <StatusBadge status={leaveType.is_active ? "ACTIVE" : "INACTIVE"} />
            </td>
            <td className="px-4 py-3">
                <div className="flex items-center gap-1">
                    <IconButton icon={Pencil} label="Edit" tooltipPortal onClick={() => onEdit(leaveType)} />
                    <IconButton
                        icon={leaveType.is_active ? UserX : UserCheck}
                        label={leaveType.is_active ? "Deactivate" : "Activate"}
                        variant={leaveType.is_active ? "danger" : "success"}
                        loading={busy}
                        tooltipPortal
                        onClick={handleToggleStatus}
                    />
                </div>
            </td>
        </tr>
    );
}

export function LeaveTypesPage() {
    // null until the first load resolves — doubles as the loading sentinel so
    // no setState happens synchronously inside the effect.
    const [leaveTypes, setLeaveTypes] = useState(null);
    const [loadError, setLoadError] = useState(null);

    const loading = leaveTypes === null;

    // null while closed, `{}` (no `id`) to create, or a leave type row to edit.
    const [editingLeaveType, setEditingLeaveType] = useState(null);
    const [showModal, setShowModal] = useState(false);

    // Bumped by children after a mutation to re-trigger the fetch effect. The
    // request lives inside the effect (rather than a function called from it)
    // so state is only ever set from an async callback.
    const [reloadToken, setReloadToken] = useState(0);
    const reload = () => setReloadToken((token) => token + 1);

    useEffect(() => {
        let cancelled = false;

        // HR always sees deactivated types too — they're the only role that can
        // reactivate one, so hiding them here would strand them.
        getLeaveTypes({ includeInactive: true })
            .then((data) => {
                if (cancelled) return;
                setLeaveTypes(data);
                setLoadError(null);
            })
            .catch(() => {
                if (cancelled) return;
                setLeaveTypes([]);
                setLoadError("Unable to load leave types");
            });

        return () => {
            cancelled = true;
        };
    }, [reloadToken]);

    function openCreateModal() {
        setEditingLeaveType(null);
        setShowModal(true);
    }

    function openEditModal(leaveType) {
        setEditingLeaveType(leaveType);
        setShowModal(true);
    }

    function closeModal() {
        setShowModal(false);
    }

    function handleSaved() {
        setShowModal(false);
        reload();
    }

    return (
        <div>
            <PageHeader
                title="Leave Types"
                description="Creating a leave type immediately gives every active employee a balance for it."
                action={
                    <Button icon={Plus} onClick={openCreateModal}>
                        Add Leave Type
                    </Button>
                }
            />

            <Modal open={showModal} onClose={closeModal} title={editingLeaveType ? "Edit leave type" : "New leave type"}>
                <LeaveTypeForm key={editingLeaveType?.id || "new"} leaveType={editingLeaveType} onSaved={handleSaved} />
            </Modal>

            <section className="mt-8">
                {loading && (
                    <p role="status" className="mt-2 text-sm text-slate-500">
                        Loading…
                    </p>
                )}
                {loadError && (
                    <p role="alert" className="mt-2 text-sm text-red-600">
                        {loadError}
                    </p>
                )}
                {!loading && !loadError && leaveTypes.length === 0 && (
                    <p className="mt-2 text-sm text-slate-500">No leave types yet. Add one to get started.</p>
                )}
                {!loading && !loadError && leaveTypes.length > 0 && (
                    <Card className="mt-4 overflow-hidden">
                        {/* overflow-x-auto lets this (the widest table in the app)
                            scroll horizontally on a phone-width screen instead of
                            clipping columns (NFR-8). */}
                        <div className="scrollbar-thin overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-slate-500">
                                    <tr>
                                        <th className="px-4 py-2 font-medium">Name</th>
                                        <th className="px-4 py-2 font-medium">Entitlement</th>
                                        <th className="px-4 py-2 font-medium">Accrual</th>
                                        <th className="px-4 py-2 font-medium">Negative</th>
                                        <th className="px-4 py-2 font-medium">Document</th>
                                        <th className="px-4 py-2 font-medium">Status</th>
                                        <th className="px-4 py-2 font-medium">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {leaveTypes.map((leaveType) => (
                                        <LeaveTypeRow key={leaveType.id} leaveType={leaveType} onChanged={reload} onEdit={openEditModal} />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                )}
            </section>
        </div>
    );
}
