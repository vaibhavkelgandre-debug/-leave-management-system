import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Calculator } from "lucide-react";
import { getMySalarySlips, getSalarySlipsForHr } from "../services/salarySlipService.js";
import { getUserOptions } from "../services/userService.js";
import { SalarySlipList } from "../components/salary/SalarySlipList.jsx";
import { RoleGate } from "../components/auth/RoleGate.jsx";
import { Button } from "../components/ui/Button.jsx";
import { PageHeader } from "../components/ui/PageHeader.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { ROLES } from "../constants/roles.js";

const TABS = { MINE: "mine", TEAM: "team" };

// Same page size as every other paginated list in the app.
const PAGE_SIZE = 25;

const inputClasses =
    "block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";
const labelClasses = "mb-1 block text-sm font-medium text-slate-700";

export function SalarySlipsPage() {
    const { hasAnyRole } = useAuth();
    const isHr = hasAnyRole([ROLES.HR_ADMIN, ROLES.SUPER_ADMIN]);
    // Only HR gets a choice at all — a plain employee only ever has their own
    // history, so there's nothing to switch to, same reasoning as
    // ApprovalsPage's canOverride-gated tabs.
    const [activeTab, setActiveTab] = useState(TABS.MINE);

    // `payPeriod` applies to whichever tab is active; `employeeId`/`role`
    // only ever affect the team fetch below (harmless to leave set while
    // viewing "Your slips" — they just don't do anything there).
    const [payPeriod, setPayPeriod] = useState("");
    const [employeeId, setEmployeeId] = useState("");
    const [role, setRole] = useState("");

    // Only needed to populate the employee filter dropdown — null until
    // loaded so no setState happens synchronously inside the effect.
    const [users, setUsers] = useState(null);

    const [mySlips, setMySlips] = useState([]);
    const [mySlipsLoaded, setMySlipsLoaded] = useState(false);

    const [teamSlips, setTeamSlips] = useState([]);
    // Paginated: this list spans every payroll month ever run, not just the
    // selected one (the pay-period filter is optional).
    const [teamTotal, setTeamTotal] = useState(0);
    const [teamOffset, setTeamOffset] = useState(0);
    const [teamSlipsLoaded, setTeamSlipsLoaded] = useState(false);

    // Bumped after a slip is voided, so the team list reflects its new
    // status without a full page reload.
    const [reloadToken, setReloadToken] = useState(0);

    useEffect(() => {
        let cancelled = false;
        setMySlipsLoaded(false);
        getMySalarySlips({ payPeriod: payPeriod || undefined })
            .then((data) => {
                if (cancelled) return;
                setMySlips(data);
                setMySlipsLoaded(true);
            })
            .catch(() => {
                if (cancelled) return;
                setMySlips([]);
                setMySlipsLoaded(true);
            });
        return () => {
            cancelled = true;
        };
    }, [payPeriod, reloadToken]);

    useEffect(() => {
        if (!isHr) return undefined;
        let cancelled = false;
        setTeamSlipsLoaded(false);
        getSalarySlipsForHr({
            payPeriod: payPeriod || undefined,
            employeeId: employeeId || undefined,
            role: role || undefined,
            limit: PAGE_SIZE,
            offset: teamOffset,
        })
            .then((data) => {
                if (cancelled) return;
                setTeamSlips(data.slips);
                setTeamTotal(data.total);
                setTeamSlipsLoaded(true);
            })
            .catch(() => {
                if (cancelled) return;
                setTeamSlips([]);
                setTeamTotal(0);
                setTeamSlipsLoaded(true);
            });
        return () => {
            cancelled = true;
        };
    }, [isHr, payPeriod, employeeId, role, reloadToken, teamOffset]);

    useEffect(() => {
        if (!isHr) return undefined;
        let cancelled = false;
        getUserOptions()
            .then((data) => {
                if (!cancelled) setUsers(data);
            })
            .catch(() => {
                if (!cancelled) setUsers([]);
            });
        return () => {
            cancelled = true;
        };
    }, [isHr]);

    // Narrowed by the selected role first — pick a role, then pick from just
    // that slice — same flow InviteEmployeeForm's reporting-line picker uses.
    const employeeOptions = (users ?? []).filter((u) => (role ? u.role === role : true));

    function handleVoided() {
        setReloadToken((token) => token + 1);
    }

    function clearFilters() {
        setTeamOffset(0);
        setPayPeriod("");
        setEmployeeId("");
        setRole("");
    }

    const hasActiveFilters = Boolean(payPeriod || employeeId || role);

    return (
        <div>
            <PageHeader
                title="Salary Slips"
                description="Your payslip history for each pay period."
                action={
                    <RoleGate allowedRoles={[ROLES.HR_ADMIN, ROLES.SUPER_ADMIN]}>
                        <Button as={Link} to="/dashboard/payroll-run" icon={Calculator}>
                            Run payroll
                        </Button>
                    </RoleGate>
                }
            />

            {isHr && (
                <div role="tablist" aria-label="Salary slips view" className="mt-6 flex gap-1 border-b border-slate-200">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === TABS.MINE}
                        onClick={() => setActiveTab(TABS.MINE)}
                        className={`border-b-2 px-3 py-2 text-sm font-medium transition ${
                            activeTab === TABS.MINE
                                ? "border-indigo-600 text-indigo-700"
                                : "border-transparent text-slate-500 hover:text-slate-700"
                        }`}
                    >
                        Your slips
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === TABS.TEAM}
                        onClick={() => setActiveTab(TABS.TEAM)}
                        className={`border-b-2 px-3 py-2 text-sm font-medium transition ${
                            activeTab === TABS.TEAM
                                ? "border-indigo-600 text-indigo-700"
                                : "border-transparent text-slate-500 hover:text-slate-700"
                        }`}
                    >
                        Your team's slips
                    </button>
                </div>
            )}

            <div className="mt-6 flex flex-wrap items-end gap-3">
                <div>
                    <label htmlFor="slipPayPeriod" className={labelClasses}>
                        Pay period
                    </label>
                    <input
                        id="slipPayPeriod"
                        type="month"
                        value={payPeriod}
                        onChange={(event) => {
                            setTeamOffset(0);
                            setPayPeriod(event.target.value);
                        }}
                        className={inputClasses}
                    />
                </div>

                {isHr && activeTab === TABS.TEAM && (
                    <>
                        <div>
                            <label htmlFor="slipRole" className={labelClasses}>
                                Role
                            </label>
                            <select
                                id="slipRole"
                                value={role}
                                onChange={(event) => {
                                    setTeamOffset(0);
                                    setRole(event.target.value);
                                    // The previously picked person may no longer
                                    // match the new role slice — clear rather
                                    // than silently keep filtering by a stale id.
                                    setEmployeeId("");
                                }}
                                className={inputClasses}
                            >
                                <option value="">All roles</option>
                                <option value={ROLES.EMPLOYEE}>Employee</option>
                                <option value={ROLES.MANAGER}>Manager</option>
                                <option value={ROLES.HR_ADMIN}>HR Admin</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="slipEmployee" className={labelClasses}>
                                Employee
                            </label>
                            <select
                                id="slipEmployee"
                                value={employeeId}
                                onChange={(event) => {
                                    setTeamOffset(0);
                                    setEmployeeId(event.target.value);
                                }}
                                className={inputClasses}
                            >
                                <option value="">All employees</option>
                                {employeeOptions.map((user) => (
                                    <option key={user.id} value={user.id}>
                                        {user.first_name} {user.last_name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </>
                )}

                {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                        Clear filters
                    </Button>
                )}
            </div>

            <div className="mt-4">
                {activeTab === TABS.MINE && (
                    <>
                        {!mySlipsLoaded && (
                            <p role="status" className="text-sm text-slate-500">
                                Loading…
                            </p>
                        )}
                        {mySlipsLoaded && <SalarySlipList slips={mySlips} />}
                    </>
                )}

                {isHr && activeTab === TABS.TEAM && (
                    <>
                        {!teamSlipsLoaded && (
                            <p role="status" className="text-sm text-slate-500">
                                Loading…
                            </p>
                        )}
                        {teamSlipsLoaded && (
                            <>
                                <SalarySlipList slips={teamSlips} showEmployee canVoid onVoided={handleVoided} />
                                {/* Same "Showing X–Y of Z" + prev/next as every
                                    other paginated list; hidden when it all fits
                                    on one page. */}
                                {teamTotal > PAGE_SIZE && (
                                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                                        <p className="text-xs text-slate-500">
                                            Showing {teamOffset + 1}–{Math.min(teamOffset + PAGE_SIZE, teamTotal)} of{" "}
                                            {teamTotal}
                                        </p>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                disabled={teamOffset === 0}
                                                onClick={() =>
                                                    setTeamOffset((current) => Math.max(current - PAGE_SIZE, 0))
                                                }
                                            >
                                                Previous
                                            </Button>
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                disabled={teamOffset + PAGE_SIZE >= teamTotal}
                                                onClick={() => setTeamOffset((current) => current + PAGE_SIZE)}
                                            >
                                                Next
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
