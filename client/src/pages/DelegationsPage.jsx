import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { getMyDelegations } from "../services/delegationService.js";
import { DelegationForm } from "../components/leave/DelegationForm.jsx";
import { DelegationList } from "../components/leave/DelegationList.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Modal } from "../components/ui/Modal.jsx";
import { PageHeader } from "../components/ui/PageHeader.jsx";

export function DelegationsPage() {
    const [delegations, setDelegations] = useState([]);
    const [loaded, setLoaded] = useState(false);
    const [loadError, setLoadError] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [reloadToken, setReloadToken] = useState(0);
    const reload = () => setReloadToken((token) => token + 1);

    useEffect(() => {
        let cancelled = false;

        getMyDelegations()
            .then((data) => {
                if (cancelled) return;
                setDelegations(data);
                setLoadError(null);
                setLoaded(true);
            })
            .catch(() => {
                if (cancelled) return;
                setLoadError("Unable to load delegations");
                setLoaded(true);
            });

        return () => {
            cancelled = true;
        };
    }, [reloadToken]);

    function handleCreated() {
        setShowForm(false);
        reload();
    }

    return (
        <div>
            <PageHeader
                title="Delegations"
                description="While you're away, a delegate can approve your team's leave requests for a date range you set."
                action={
                    <Button icon={Plus} onClick={() => setShowForm(true)}>
                        Nominate Delegate
                    </Button>
                }
            />

            <Modal open={showForm} onClose={() => setShowForm(false)} title="Nominate a delegate">
                <DelegationForm onCreated={handleCreated} />
            </Modal>

            {!loaded && (
                <p role="status" className="mt-6 text-sm text-slate-500">
                    Loading…
                </p>
            )}
            {loadError && (
                <p role="alert" className="mt-6 text-sm text-red-600">
                    {loadError}
                </p>
            )}
            {loaded && !loadError && delegations.length === 0 && (
                <p className="mt-6 text-sm text-slate-500">You haven't nominated any delegates yet.</p>
            )}
            {loaded && !loadError && delegations.length > 0 && (
                <div className="mt-6">
                    <DelegationList delegations={delegations} />
                </div>
            )}
        </div>
    );
}
