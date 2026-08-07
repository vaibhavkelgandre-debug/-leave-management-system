export function Card({ className = "", children, ...rest }) {
    return (
        <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`} {...rest}>
            {children}
        </div>
    );
}
