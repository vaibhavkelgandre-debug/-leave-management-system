import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { useAuth } from "../hooks/useAuth.js";
import { submitProfileForVerification } from "../services/userService.js";
import { getSalaryStructure } from "../services/salaryStructureService.js";
import { toErrorMessage } from "../services/httpError.js";
import { Avatar } from "../components/ui/Avatar.jsx";
import { RoleBadge, StatusBadge } from "../components/ui/Badge.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { PageHeader } from "../components/ui/PageHeader.jsx";
import { ProfileForm } from "../components/profile/ProfileForm.jsx";
import { ChangePasswordModal } from "../components/profile/ChangePasswordModal.jsx";

function money(value) {
    return Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function personName(person) {
    return person ? `${person.first_name} ${person.last_name}` : "Not assigned yet";
}

// Read-only, and shown above the editable form rather than inside it —
// who's above this employee is set by HR via the manager field, never
// editable here (see server/src/repositories/userRepository.js's
// PROFILE_FIELD_COLUMNS, which never includes manager_id).
function ReportingLineSummary({ manager, hr }) {
    return (
        <div className="mb-6 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 sm:grid-cols-2">
            <div>
                <p className="text-xs font-medium text-slate-500">Manager</p>
                <p className="text-sm text-slate-800">
                    {personName(manager)}
                    {manager?.email && <span className="text-slate-400"> · {manager.email}</span>}
                </p>
            </div>
            <div>
                <p className="text-xs font-medium text-slate-500">HR (verifies your profile)</p>
                <p className="text-sm text-slate-800">
                    {personName(hr)}
                    {hr?.email && <span className="text-slate-400"> · {hr.email}</span>}
                </p>
            </div>
        </div>
    );
}

export function ProfilePage() {
    // The auth context's own user (from GET /auth/me) already carries every
    // profile field, always unmasked — a user viewing their own profile is
    // always "self" (see userService.maskSensitiveProfileFields server-side).
    // refreshUser() re-fetches it after a save so this page (and everywhere
    // else `user` is read from context) reflects the change immediately.
    const { user, refreshUser } = useAuth();

    const [structure, setStructure] = useState(null);
    const [structureLoaded, setStructureLoaded] = useState(false);
    const [submitError, setSubmitError] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        let cancelled = false;
        getSalaryStructure(user.id)
            .then((data) => {
                if (!cancelled) setStructure(data);
            })
            .catch(() => {
                if (!cancelled) setStructure(null);
            })
            .finally(() => {
                if (!cancelled) setStructureLoaded(true);
            });
        return () => {
            cancelled = true;
        };
    }, [user.id]);

    async function handleSubmitForVerification() {
        setSubmitting(true);
        setSubmitError(null);
        try {
            await submitProfileForVerification();
            await refreshUser();
        } catch (err) {
            setSubmitError(toErrorMessage(err, "Unable to submit your profile"));
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div>
            <PageHeader title="My Profile" description="Your personal details, and your account settings." />

            <div className="mt-6 grid gap-6 lg:grid-cols-[20rem_1fr] lg:items-start">
                <div className="space-y-6">
                    <Card className="p-6">
                        <div className="flex items-center gap-3">
                            <Avatar firstName={user.first_name} lastName={user.last_name} size="lg" />
                            <div className="min-w-0">
                                <p className="truncate font-semibold text-slate-900">
                                    {user.first_name} {user.last_name}
                                </p>
                                <p className="truncate text-sm text-slate-500">{user.email}</p>
                            </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                            <RoleBadge role={user.role} />
                            <StatusBadge status={user.status} />
                            <StatusBadge status={user.profile_status} />
                        </div>
                        <p className="mt-4 text-xs text-slate-500">
                            Role and status are managed by HR — contact them to make a change.
                        </p>

                        {user.profile_status === "INCOMPLETE" && user.profile_send_back_reason && (
                            <div role="alert" className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                                <p className="text-xs font-semibold text-amber-800">Sent back for correction</p>
                                <p className="mt-0.5 text-xs text-amber-700">{user.profile_send_back_reason}</p>
                            </div>
                        )}

                        {submitError && (
                            <p role="alert" className="mt-3 text-xs text-red-600">
                                {submitError}
                            </p>
                        )}
                        {user.profile_status === "INCOMPLETE" && (
                            <Button className="mt-4 w-full" size="sm" loading={submitting} onClick={handleSubmitForVerification}>
                                Submit for verification
                            </Button>
                        )}
                        {user.profile_status === "SUBMITTED" && (
                            <p className="mt-4 text-xs text-slate-500">Waiting on HR to verify your profile.</p>
                        )}

                        <ChangePasswordModal
                            trigger={(open) => (
                                <Button variant="secondary" icon={KeyRound} className="mt-3 w-full" onClick={open}>
                                    Change password
                                </Button>
                            )}
                        />
                    </Card>

                    {structureLoaded && structure && (
                        <Card className="p-6">
                            <h2 className="text-sm font-semibold text-slate-900">Salary structure</h2>
                            <p className="mt-1 text-xs text-slate-500">Assigned by HR — read-only.</p>
                            <dl className="mt-3 space-y-1.5 text-sm">
                                {[
                                    ["Basic salary", structure.basic_salary],
                                    ["HRA", structure.hra],
                                    ["Special allowance", structure.special_allowance],
                                    ["PF (your contribution)", structure.pf_employee_contribution],
                                    ["ESIC", structure.esic],
                                    ["Income tax", structure.income_tax],
                                ].map(([label, value]) => (
                                    <div key={label} className="flex items-center justify-between">
                                        <dt className="text-slate-500">{label}</dt>
                                        <dd className="font-medium text-slate-800">{money(value)}</dd>
                                    </div>
                                ))}
                            </dl>
                        </Card>
                    )}
                </div>

                <Card className="p-6">
                    <h2 className="text-lg font-semibold text-slate-900">Personal details</h2>
                    <div className="mt-4">
                        <ReportingLineSummary manager={user.manager} hr={user.hr} />
                        <ProfileForm user={user} onSaved={refreshUser} />
                    </div>
                </Card>
            </div>
        </div>
    );
}
