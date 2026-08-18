import { useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useClickOutside } from "../../hooks/useClickOutside.js";

const MAX_RESULTS = 50;

// A type-to-filter dropdown for picking one value out of a long option list
// (e.g. an employee out of a few hundred/thousand) — a plain <select> makes
// that a slow scroll-and-squint exercise. Same input+dropdown+click-outside
// shape as TopBar.jsx's NavSearch, just backed by a controlled `value`
// instead of pure navigation.
//
// `query` is `null` while not editing (the input just displays the selected
// option's label, derived straight from `value`/`options` on every render —
// no effect needed) and a string while actively typing/browsing. This is the
// same "derive instead of sync-via-effect" fix already used elsewhere in
// this app (see RequestDetailModal's keyed-fetch-result pattern) for the
// react-hooks/set-state-in-effect rule: syncing a local echo of a prop back
// with setState-in-an-effect causes an extra render on every external value
// change, and is exactly what that lint rule flags.
export function SearchSelect({ id, options, value, onChange, placeholder = "Everyone", "aria-label": ariaLabel }) {
    const [query, setQuery] = useState(null);
    const containerRef = useRef(null);
    const editing = query !== null;

    const selectedLabel = useMemo(
        () => options.find((option) => option.value === value)?.label ?? "",
        [options, value]
    );
    const displayValue = editing ? query : selectedLabel;

    function closeAndRevert() {
        setQuery(null);
    }

    useClickOutside(containerRef, closeAndRevert, editing);

    const results = useMemo(() => {
        const needle = (query ?? "").trim().toLowerCase();
        const matches = needle ? options.filter((option) => option.label.toLowerCase().includes(needle)) : options;
        return matches.slice(0, MAX_RESULTS);
    }, [query, options]);

    function select(option) {
        onChange(option?.value ?? "");
        setQuery(null);
    }

    function handleKeyDown(event) {
        if (event.key === "Escape") {
            closeAndRevert();
        } else if (event.key === "Enter") {
            event.preventDefault();
            select(results[0] ?? null);
        }
    }

    return (
        <div ref={containerRef}>
            <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                    id={id}
                    type="text"
                    role="combobox"
                    aria-expanded={editing}
                    aria-label={ariaLabel}
                    value={displayValue}
                    placeholder={placeholder}
                    onFocus={() => setQuery(selectedLabel)}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={handleKeyDown}
                    className="block w-full rounded-md border border-slate-300 py-2 pr-3 pl-9 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
            </div>
            {/* Deliberately NOT position:absolute — an overlay here would float
                on top of whatever sits below it in the surrounding layout (a
                sibling filter field, in HrReportsPage's case), hiding it while
                open. Rendering in normal flow instead pushes that content down
                for as long as the dropdown is open, so nothing is ever hidden
                behind it, at the cost of a small layout shift. max-h-64 +
                overflow-auto still caps how much it can push by. */}
            {editing && (
                <ul className="relative z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                    <li>
                        <button
                            type="button"
                            onClick={() => select(null)}
                            className="block w-full px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-50"
                        >
                            {placeholder}
                        </button>
                    </li>
                    {results.length === 0 && <li className="px-3 py-2 text-sm text-slate-400">No matches</li>}
                    {results.map((option) => (
                        <li key={option.value}>
                            <button
                                type="button"
                                onClick={() => select(option)}
                                className="block w-full px-3 py-2 text-left hover:bg-slate-50"
                            >
                                <span className="flex flex-wrap items-center gap-2">
                                    <span className="truncate text-sm text-slate-700">{option.label}</span>
                                    {option.badge}
                                </span>
                                {option.sublabel && (
                                    <span className="block truncate text-xs text-slate-400">{option.sublabel}</span>
                                )}
                            </button>
                        </li>
                    ))}
                    {results.length === MAX_RESULTS && (
                        <li className="px-3 py-1.5 text-xs text-slate-400">Keep typing to narrow down further…</li>
                    )}
                </ul>
            )}
        </div>
    );
}
