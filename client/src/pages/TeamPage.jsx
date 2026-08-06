import { useEffect, useState } from "react";
import { getMyTeam } from "../services/userService.js";
import { useAuth } from "../hooks/useAuth.js";
import { ROLE_BADGE_CLASSES, STATUS_BADGE_CLASSES, BADGE_BASE_CLASSES } from "../constants/badges.js";

function TeamTable({ rows, showsReportsTo }) {
    return (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                    <tr>
                        <th className="px-4 py-2 font-medium">Person</th>
                        <th className="px-4 py-2 font-medium">Role</th>
                        <th className="px-4 py-2 font-medium">Status</th>
                        {showsReportsTo && <th className="px-4 py-2 font-medium">Reports to</th>}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {rows.map((person) => (
                        <tr key={person.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3">
                                <div className="font-medium text-slate-900">
                                    {person.first_name} {person.last_name}
                                </div>
                                <div className="text-xs text-slate-500">{person.email}</div>
                            </td>
                            <td className="px-4 py-3">
                                <span className={`${BADGE_BASE_CLASSES} ${ROLE_BADGE_CLASSES[person.role] || "bg-slate-100 text-slate-700"}`}>
                                    {person.role}
                                </span>
                            </td>
                            <td className="px-4 py-3">
                                <span
                                    className={`${BADGE_BASE_CLASSES} ${STATUS_BADGE_CLASSES[person.status] || "bg-slate-100 text-slate-500"}`}
                                >
                                    {person.status}
                                </span>
                            </td>
                            {showsReportsTo && <td className="px-4 py-3 text-slate-600">{person.managerName}</td>}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export function TeamPage() {
    const { user: currentUser } = useAuth();
    const [team, setTeam] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        getMyTeam()
            .then(setTeam)
            .catch(() => setError("Unable to load your team"));
    }, []);

    if (error) {
        return (
            <div>
                <h1 className="text-2xl font-semibold text-slate-900">My Team</h1>
                <p role="alert" className="mt-6 text-sm text-red-600">
                    {error}
                </p>
            </div>
        );
    }

    if (!team) {
        return (
            <div>
                <h1 className="text-2xl font-semibold text-slate-900">My Team</h1>
                <p role="status" className="mt-6 text-sm text-slate-500">
                    Loading…
                </p>
            </div>
        );
    }

    if (team.length === 0) {
        return (
            <div>
                <h1 className="text-2xl font-semibold text-slate-900">My Team</h1>
                <p className="mt-6 text-sm text-slate-500">You have no direct reports yet.</p>
            </div>
        );
    }

    const byId = new Map(team.map((person) => [person.id, person]));
    const directReports = team.filter((person) => person.manager_id === currentUser.id);
    const extendedTeam = team
        .filter((person) => person.manager_id !== currentUser.id)
        .map((person) => {
            const manager = byId.get(person.manager_id);
            return { ...person, managerName: manager ? `${manager.first_name} ${manager.last_name}` : "—" };
        });

    return (
        <div>
            <h1 className="text-2xl font-semibold text-slate-900">My Team</h1>

            <section className="mt-6">
                <h2 className="text-lg font-semibold text-slate-900">Direct reports</h2>
                <p className="mt-1 text-sm text-slate-500">People who report straight to you.</p>
                <div className="mt-3">
                    {directReports.length > 0 ? (
                        <TeamTable rows={directReports} />
                    ) : (
                        <p className="text-sm text-slate-500">Nobody reports directly to you.</p>
                    )}
                </div>
            </section>

            {extendedTeam.length > 0 && (
                <section className="mt-8">
                    <h2 className="text-lg font-semibold text-slate-900">Extended team</h2>
                    <p className="mt-1 text-sm text-slate-500">
                        Everyone further down your reporting line, and who they answer to.
                    </p>
                    <div className="mt-3">
                        <TeamTable rows={extendedTeam} showsReportsTo />
                    </div>
                </section>
            )}
        </div>
    );
}
