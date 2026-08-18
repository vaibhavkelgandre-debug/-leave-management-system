// HR's queue of employee profiles awaiting verification (Module 5 v2), plus
// a "Verified Employees" section right below it for jumping back into an
// employee HR has already verified — e.g. to adjust their salary structure
// without hunting through "All Employees". "Review" links to
// EmployeeVerificationDetailPage.jsx (a full page, not a modal); "See
// details" links to the read-only-profile EmployeeDetailsPage.jsx instead,
// since there's nothing left to verify once someone's already VERIFIED.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getPendingVerification, getVerifiedEmployees } from "../services/userService.js";
import { Button } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { PageHeader } from "../components/ui/PageHeader.jsx";

function EmployeeListSection({ title, description, employees, emptyMessage, renderAction }) {
    return (
        <section>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
            {employees.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">{emptyMessage}</p>
            ) : (
                <Card className="mt-3 overflow-hidden">
                    <ul className="divide-y divide-slate-100">
                        {employees.map((employee) => (
                            <li key={employee.id} className="flex items-center justify-between gap-3 px-4 py-3">
                                <div>
                                    <p className="text-sm font-medium text-slate-900">
                                        {employee.first_name} {employee.last_name}
                                    </p>
                                    <p className="text-xs text-slate-500">{employee.email}</p>
                                </div>
                                {renderAction(employee)}
                            </li>
                        ))}
                    </ul>
                </Card>
            )}
        </section>
    );
}

export function EmployeeVerificationPage() {
    const [pending, setPending] = useState([]);
    const [verified, setVerified] = useState([]);
    const [loaded, setLoaded] = useState(false);
    const [loadError, setLoadError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        Promise.all([getPendingVerification(), getVerifiedEmployees()])
            .then(([pendingData, verifiedData]) => {
                if (cancelled) return;
                setPending(pendingData);
                setVerified(verifiedData);
                setLoadError(null);
            })
            .catch(() => {
                if (!cancelled) setLoadError("Unable to load pending profiles");
            })
            .finally(() => {
                if (!cancelled) setLoaded(true);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <div>
            <PageHeader title="Profile Verification" description="Employees who've submitted their profile for review." />

            {loadError && (
                <p role="alert" className="mt-6 text-sm text-red-600">
                    {loadError}
                </p>
            )}

            {loaded && !loadError && (
                <div className="mt-6 space-y-8">
                    <EmployeeListSection
                        title="Pending review"
                        employees={pending}
                        emptyMessage="Nothing waiting for review."
                        renderAction={(employee) => (
                            <Button as={Link} to={`/dashboard/profile-verification/${employee.id}`} size="sm">
                                Review
                            </Button>
                        )}
                    />

                    <EmployeeListSection
                        title="Verified Employees"
                        description="Employees you've verified so far."
                        employees={verified}
                        emptyMessage="No verified employees yet."
                        renderAction={(employee) => (
                            <Button as={Link} to={`/dashboard/team/${employee.id}`} size="sm" variant="secondary">
                                See details
                            </Button>
                        )}
                    />
                </div>
            )}
        </div>
    );
}
