// Dedicated destination for "Add Employee" on the All Employees page — this
// used to open InviteEmployeeForm inside a Modal, moved to its own route on
// direct request so every field, and the generated invite link once one's
// created, are fully visible on a page instead of a cramped dialog. Same
// modal-to-page move ApplyLeavePage.jsx already made for the same reason.
// EmployeesPage.jsx needs no callback wired back from here — navigating
// there again (the "Back to All Employees" link, used both as a Cancel
// before inviting and a Done after) remounts it fresh, which re-fetches the
// roster on its own. Wider than a typical single-column form card (`max-w-4xl`
// rather than the page's own `max-w-7xl` cap) — InviteEmployeeForm's fields
// lay out horizontally now, so this needs the width to actually use that
// layout instead of just adding empty margin.
import { Link } from "react-router-dom";
import { InviteEmployeeForm } from "../components/team/InviteEmployeeForm.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { ROLES } from "../constants/roles.js";
import { Button } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { PageHeader } from "../components/ui/PageHeader.jsx";

export function AddEmployeePage() {
    const { hasAnyRole } = useAuth();
    // Where "back" goes depends on where the caller could have come from:
    // All Employees is SUPER_ADMIN-only now, so pointing an HR admin at it
    // would send them to /403 on the way out of a successful invite. Both
    // destinations remount and refetch, which is why neither needs a
    // callback wired back from here.
    const backTo = hasAnyRole([ROLES.SUPER_ADMIN]) ? "/dashboard/employees" : "/dashboard/team";
    const backLabel = backTo === "/dashboard/employees" ? "Back to All Employees" : "Back to My Team";

    return (
        <div>
            <PageHeader title="Add Employee" description="Invite a new employee, manager, or HR admin to the org." />

            <div className="mt-6 max-w-4xl">
                <Card className="p-6">
                    <InviteEmployeeForm
                        secondaryAction={
                            <Button as={Link} to={backTo} variant="secondary">
                                {backLabel}
                            </Button>
                        }
                    />
                </Card>
            </div>
        </div>
    );
}
