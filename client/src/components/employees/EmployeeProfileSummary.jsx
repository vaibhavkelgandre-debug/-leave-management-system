// Every field the employee could have filled in, grouped the same way
// ProfileForm.jsx groups them for editing — read-only, shared by HR's
// verification detail page (EmployeeVerificationDetailPage.jsx) and the
// employee-details page for an already-verified employee
// (EmployeeDetailsPage.jsx), so the two pages present a profile identically.
// Each group is its own bordered card with a light-header bar + icon —
// deliberately the same light-background-header look ProfileForm.jsx's own
// `Section` toggle uses, so the read-only summary here and the editable
// form there read as the same design language, not two different UIs.
import { Briefcase, IdCard, MapPin, Phone, User } from "lucide-react";
import { formatDateKey } from "../../utils/dates.js";

function formatDate(value) {
    return value ? formatDateKey(value) : null;
}

function SummaryField({ label, value }) {
    return (
        <div>
            <dt className="text-xs text-slate-500">{label}</dt>
            <dd className="mt-0.5 text-sm font-semibold text-slate-900">{value || "—"}</dd>
        </div>
    );
}

function SummarySection({ icon: Icon, title, columns = "sm:grid-cols-3", children }) {
    return (
        <div className="overflow-hidden rounded-lg border border-slate-200">
            <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                <Icon className="h-4 w-4 shrink-0 text-indigo-500" aria-hidden="true" />
                <h4 className="text-xs font-semibold tracking-wide text-slate-600 uppercase">{title}</h4>
            </div>
            <dl className={`grid grid-cols-2 gap-x-6 gap-y-4 px-4 py-4 ${columns}`}>{children}</dl>
        </div>
    );
}

export function EmployeeProfileSummary({ employee }) {
    return (
        <div className="space-y-4">
            <SummarySection icon={Briefcase} title="Work details">
                <SummaryField label="Employee code" value={employee.employee_code} />
                <SummaryField label="Designation" value={employee.designation} />
                <SummaryField label="Department" value={employee.department} />
                <SummaryField label="Joining date" value={formatDate(employee.joining_date)} />
                <SummaryField label="Last working day" value={formatDate(employee.last_working_day)} />
            </SummarySection>

            <SummarySection icon={User} title="Personal details">
                <SummaryField label="Phone" value={employee.phone} />
                <SummaryField label="Date of birth" value={formatDate(employee.date_of_birth)} />
                <SummaryField label="Highest education" value={employee.highest_education} />
                <SummaryField label="Blood group" value={employee.blood_group} />
                <SummaryField label="Marital status" value={employee.marital_status} />
                <SummaryField label="Nearest airport" value={employee.nearest_airport} />
                <SummaryField label="Passport number" value={employee.passport_number} />
                <SummaryField label="Passport expiry" value={formatDate(employee.passport_expiry_date)} />
                <SummaryField label="Health problem" value={employee.health_problem} />
                <SummaryField label="Health insurance" value={employee.health_insurance_status} />
            </SummarySection>

            <SummarySection icon={MapPin} title="Address" columns="sm:grid-cols-2">
                <SummaryField label="Current address" value={employee.current_address} />
                <SummaryField label="Permanent address" value={employee.permanent_address} />
            </SummarySection>

            <SummarySection icon={Phone} title="Emergency contacts" columns="sm:grid-cols-4">
                <SummaryField label="Contact 1 — phone" value={employee.emergency_contact_1_phone} />
                <SummaryField label="Contact 1 — relationship" value={employee.emergency_contact_1_relationship} />
                <SummaryField label="Contact 2 — phone" value={employee.emergency_contact_2_phone} />
                <SummaryField label="Contact 2 — relationship" value={employee.emergency_contact_2_relationship} />
            </SummarySection>

            <SummarySection icon={IdCard} title="Government ID & bank details">
                <SummaryField label="PAN number" value={employee.pan_number} />
                <SummaryField label="Aadhar number" value={employee.aadhar_number} />
                <SummaryField label="Bank account number" value={employee.bank_account_number} />
                <SummaryField label="Bank IFSC code" value={employee.bank_ifsc_code} />
                <SummaryField label="Bank name" value={employee.bank_name} />
            </SummarySection>
        </div>
    );
}
