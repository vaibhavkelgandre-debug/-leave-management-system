// Dedicated page for HR's monthly payroll run (Module 5 v2) — moved out of
// the "Run payroll" modal on SalarySlipsPage.jsx now that it also carries
// role/profile-status filters: a whole page gives that its own room, and
// keeps SalarySlipsPage.jsx focused on just listing slips.
import { Link } from "react-router-dom";
import { PayrollRunForm } from "../components/salary/PayrollRunForm.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { PageHeader } from "../components/ui/PageHeader.jsx";

export function PayrollRunPage() {
    return (
        <div>
            <PageHeader
                title="Run Payroll"
                description="Calculate net pay from each payroll-ready employee's salary structure and approved leave, then approve to generate payslips."
                action={
                    <Button as={Link} to="/dashboard/salary-slips" variant="secondary">
                        Back to Salary Slips
                    </Button>
                }
            />

            <Card className="mt-6 max-w-2xl p-6">
                <PayrollRunForm />
            </Card>
        </div>
    );
}
