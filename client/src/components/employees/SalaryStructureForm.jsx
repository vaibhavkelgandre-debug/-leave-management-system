// HR-only: assign/edit an employee's salary structure (Module 5 v2) — one
// current row per employee, the old values archived on the server when
// this overwrites them.
import { useEffect, useState } from "react";
import { getSalaryStructure, assignSalaryStructure } from "../../services/salaryStructureService.js";
import { toErrorMessage } from "../../services/httpError.js";
import { Button } from "../ui/Button.jsx";

const FIELDS = [
    { name: "basicSalary", key: "basic_salary", label: "Basic salary" },
    { name: "hra", key: "hra", label: "HRA" },
    { name: "specialAllowance", key: "special_allowance", label: "Special allowance" },
    { name: "pfEmployeeContribution", key: "pf_employee_contribution", label: "PF (employee)" },
    { name: "pfEmployerContribution", key: "pf_employer_contribution", label: "PF (employer)" },
    { name: "esic", key: "esic", label: "ESIC" },
    { name: "incomeTax", key: "income_tax", label: "Income tax" },
];

function toFormState(structure) {
    const state = {};
    for (const field of FIELDS) {
        state[field.name] = structure ? String(Number(structure[field.key])) : "";
    }
    return state;
}

export function SalaryStructureForm({ employeeId }) {
    const [structure, setStructure] = useState(null);
    const [loaded, setLoaded] = useState(false);
    const [form, setForm] = useState(() => toFormState(null));
    const [formError, setFormError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        let cancelled = false;
        getSalaryStructure(employeeId)
            .then((data) => {
                if (cancelled) return;
                setStructure(data);
                setForm(toFormState(data));
            })
            .catch(() => {
                if (!cancelled) setStructure(null);
            })
            .finally(() => {
                if (!cancelled) setLoaded(true);
            });
        return () => {
            cancelled = true;
        };
    }, [employeeId]);

    function handleChange(event) {
        const { name, value } = event.target;
        setForm((prev) => ({ ...prev, [name]: value }));
        setSuccess(false);
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setSubmitting(true);
        setFormError(null);
        try {
            const payload = Object.fromEntries(FIELDS.map((field) => [field.name, Number(form[field.name] || 0)]));
            const updated = await assignSalaryStructure(employeeId, payload);
            setStructure(updated);
            setForm(toFormState(updated));
            setSuccess(true);
        } catch (err) {
            setFormError(toErrorMessage(err, "Unable to save salary structure"));
        } finally {
            setSubmitting(false);
        }
    }

    if (!loaded) {
        return (
            <p role="status" className="text-sm text-slate-500">
                Loading…
            </p>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            {formError && (
                <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                    {formError}
                </p>
            )}
            {success && (
                <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
                    Salary structure saved.
                </p>
            )}
            <div className="grid grid-cols-2 gap-3">
                {FIELDS.map((field) => (
                    <div key={field.name}>
                        <label htmlFor={`structure-${field.name}`} className="mb-1 block text-xs font-medium text-slate-700">
                            {field.label}
                        </label>
                        <input
                            id={`structure-${field.name}`}
                            name={field.name}
                            type="number"
                            min="0"
                            step="0.01"
                            value={form[field.name]}
                            onChange={handleChange}
                            className="block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                    </div>
                ))}
            </div>
            <Button type="submit" size="sm" loading={submitting} className="w-full">
                {structure ? "Update structure" : "Assign structure"}
            </Button>
        </form>
    );
}
