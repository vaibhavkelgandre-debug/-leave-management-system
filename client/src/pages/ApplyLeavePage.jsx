// Dedicated destination for the sidebar's "Apply Leave" link. This used to
// be a query-param trick (/dashboard/my-leave?apply=1) that opened a modal
// on top of MyBalancesPage — which silently did nothing when clicked while
// already on that page, since a search-only navigation doesn't remount the
// component, so the lazy-initialized state that read the query param never
// re-ran. A real, separate route always mounts fresh on navigation, so the
// link always does something regardless of where it was clicked from.
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getMyBalances } from "../services/leaveBalanceService.js";
import { RequestLeaveForm } from "../components/leave/RequestLeaveForm.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { PageHeader } from "../components/ui/PageHeader.jsx";

export function ApplyLeavePage() {
    const navigate = useNavigate();

    // Own fetch, deliberately not shared with any other page's balance
    // display — this is just enough context (remaining days per type) to
    // help decide how many days to actually request, shown here and nowhere
    // else. MyBalancesPage's own balance cards are a separate, fuller view.
    const [balances, setBalances] = useState(null);

    useEffect(() => {
        let cancelled = false;

        getMyBalances({})
            .then((data) => {
                if (!cancelled) setBalances(data);
            })
            .catch(() => {
                if (!cancelled) setBalances([]);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    // Lands back on My Leave so the new request and updated balance are
    // immediately visible. The new request's start date rides along as
    // router state (not a query param) so MyBalancesPage's calendar can
    // jump to it — passing it this way means MyBalancesPage picks it up
    // from its own fresh mount, the same fix this page exists to apply.
    function handleSubmitted(created) {
        navigate("/dashboard/my-leave", { state: { focusDate: created.start_date } });
    }

    return (
        <div>
            <PageHeader title="Apply Leave" description="Submit a new leave request." />

            <div className="mt-6 grid gap-6 lg:grid-cols-[28rem_1fr] lg:items-start">
                <Card className="p-6">
                    <RequestLeaveForm onSubmitted={handleSubmitted} />
                    <Button as={Link} to="/dashboard/my-leave" variant="secondary" className="mt-3 w-full">
                        Cancel
                    </Button>
                </Card>

                <Card className="p-6">
                    <h2 className="text-sm font-semibold text-slate-900">Your leave balances</h2>
                    <p className="mt-1 text-xs text-slate-500">
                        Check what you have left before picking how many days to request.
                    </p>

                    {balances === null && (
                        <p role="status" className="mt-4 text-sm text-slate-500">
                            Loading…
                        </p>
                    )}
                    {balances !== null && balances.length === 0 && (
                        <p className="mt-4 text-sm text-slate-500">No leave types have been set up yet.</p>
                    )}
                    {balances !== null && balances.length > 0 && (
                        <div className="mt-4 space-y-2">
                            {/* One consistent neutral row + the app's one brand
                                accent (indigo) on the number — cycling through
                                the dashboard's multi-color accent set here read
                                as too busy for a plain reference list. */}
                            {balances.map((balance) => (
                                <div
                                    key={balance.id}
                                    className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
                                >
                                    <span className="text-sm text-slate-700">{balance.leave_type_name}</span>
                                    <span className="text-sm font-semibold text-indigo-600">
                                        {Number(balance.days_remaining)} left
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}
