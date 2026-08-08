import { Loader2 } from "lucide-react";

const VARIANT_CLASSES = {
    primary:
        "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm hover:from-indigo-500 hover:to-violet-500",
    secondary: "border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50",
    success: "bg-emerald-50 text-emerald-700 shadow-sm ring-1 ring-inset ring-emerald-200 hover:bg-emerald-100",
    danger: "bg-red-50 text-red-700 shadow-sm ring-1 ring-inset ring-red-200 hover:bg-red-100",
    ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
};

const SIZE_CLASSES = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
};

export function Button({
    as: Component = "button",
    variant = "primary",
    size = "md",
    icon: Icon,
    iconPosition = "left",
    loading = false,
    disabled = false,
    className = "",
    children,
    type,
    ...rest
}) {
    const isButtonTag = Component === "button";
    const isDisabled = disabled || loading;

    return (
        <Component
            type={isButtonTag ? type || "button" : undefined}
            disabled={isButtonTag ? isDisabled : undefined}
            aria-disabled={!isButtonTag && isDisabled ? true : undefined}
            className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
            {...rest}
        >
            {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />}
            {!loading && Icon && iconPosition === "left" && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
            {children}
            {!loading && Icon && iconPosition === "right" && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
        </Component>
    );
}
