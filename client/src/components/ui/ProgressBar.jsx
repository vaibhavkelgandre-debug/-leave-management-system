// Slim colored progress bar — extracted from MyBalancesPage.jsx's BalanceCard
// so LeaveBalanceCard (and anything else that needs a percent-filled bar) can
// reuse the same markup instead of redefining it.
export function ProgressBar({ percent, barClassName = "bg-indigo-500", className = "" }) {
    const clamped = Math.min(100, Math.max(0, percent));

    return (
        <div className={`h-1.5 w-full overflow-hidden rounded-full bg-slate-100 ${className}`}>
            <div className={`h-full rounded-full transition-all ${barClassName}`} style={{ width: `${clamped}%` }} />
        </div>
    );
}
