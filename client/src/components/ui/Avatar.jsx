// Initials-circle avatar — extracted from the old AppHeader.jsx so the same
// markup isn't duplicated across the top bar, team lists, and profile page.
const SIZE_CLASSES = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-16 w-16 text-lg",
};

export function Avatar({ firstName = "", lastName = "", size = "md", className = "" }) {
    const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();

    return (
        <span
            className={`flex shrink-0 items-center justify-center rounded-full bg-indigo-100 font-semibold text-indigo-700 ${SIZE_CLASSES[size]} ${className}`}
        >
            {initials}
        </span>
    );
}
