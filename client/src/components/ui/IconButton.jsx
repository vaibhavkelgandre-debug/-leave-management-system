import { Loader2 } from "lucide-react";
import { Tooltip } from "./Tooltip.jsx";

const VARIANT_CLASSES = {
    default: "text-slate-500 hover:bg-slate-100 hover:text-slate-700",
    primary: "text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700",
    success: "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700",
    danger: "text-red-600 hover:bg-red-50 hover:text-red-700",
    ghost: "text-slate-400 hover:bg-slate-100 hover:text-slate-600",
};

const SIZE_CLASSES = {
    sm: "h-7 w-7",
    md: "h-9 w-9",
};

// `tooltipPortal` forwards Tooltip's own `portal` mode. Needed for any icon
// button inside a table row: the row sits in an `overflow-x-auto` wrapper
// inside an `overflow-hidden` Card, and the default CSS-absolute tooltip
// interacts with that badly in two ways — it gets clipped at the Card's edge,
// and, being laid out in the document, its `whitespace-nowrap` box counts
// toward the wrapper's `scrollWidth`, so a table that otherwise fits exactly
// still shows a horizontal scrollbar for a label nobody can see. A portalled
// tooltip is in `document.body`, so it does neither.
export function IconButton({
    icon: Icon,
    label,
    variant = "default",
    size = "md",
    loading = false,
    disabled = false,
    tooltipPosition = "top",
    tooltipPortal = false,
    className = "",
    ...rest
}) {
    return (
        <Tooltip label={label} position={tooltipPosition} portal={tooltipPortal} className="inline-flex shrink-0">
            <button
                type="button"
                aria-label={label}
                disabled={disabled || loading}
                className={`inline-flex shrink-0 items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
                {...rest}
            >
                {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                    <Icon className="h-4 w-4" aria-hidden="true" />
                )}
            </button>
        </Tooltip>
    );
}
