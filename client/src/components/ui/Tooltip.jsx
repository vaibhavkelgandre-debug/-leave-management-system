// A small hover label matching the app's own light card style (white
// background, slate border, subtle shadow) — replaces the browser's native
// `title` attribute tooltip everywhere one was used purely for an on-hover
// description, since that native tooltip renders with whatever the OS/
// browser decides (often a stark black box) and can't be restyled to match
// anything else in the app.
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { computeTooltipStyle, TOOLTIP_MAX_WIDTH } from "../../utils/tooltipPosition.js";

const POSITION_CLASSES = {
    top: "bottom-full left-1/2 mb-1.5 -translate-x-1/2",
    bottom: "top-full left-1/2 mt-1.5 -translate-x-1/2",
    right: "left-full top-1/2 ml-1.5 -translate-y-1/2",
    left: "right-full top-1/2 mr-1.5 -translate-y-1/2",
};

// The floating box itself, portalled to `document.body` — the *only* place
// the portal tooltip's look is defined, shared by `Tooltip` below and by the
// calendars (which hover a DOM element FullCalendar owns rather than a React
// child, so they drive it through hooks/useHoverTooltip.js instead of
// wrapping a trigger). Anything that renders a hover label must come through
// here, or the app grows a second tooltip style.
//
// `style` is whatever `computeTooltipStyle` returned for the trigger's rect;
// rendering nothing without it means a caller can pass its state straight in.
export function FloatingTooltip({ label, style }) {
    if (!label || !style) return null;

    return createPortal(
        <span
            role="tooltip"
            style={{ position: "fixed", top: style.top, left: style.left, transform: style.transform, maxWidth: TOOLTIP_MAX_WIDTH }}
            className="pointer-events-none z-[100] rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium break-words text-slate-700 shadow-md"
        >
            {label}
        </span>,
        document.body
    );
}

// `portal`: renders the floating label into `document.body`, positioned from
// the trigger's live `getBoundingClientRect()` instead of a plain CSS
// `position: absolute` sibling. Needed anywhere the trigger sits inside a
// `overflow-y-auto`/`overflow-hidden` ancestor (e.g. the sidebar's scrollable
// nav column) — a plain absolutely-positioned tooltip trying to visually
// escape that ancestor's bounds gets silently clipped by it (CSS forces
// *both* axes into a clipping/scroll box together once either overflow-x or
// overflow-y is non-`visible`, so there's no way to keep one axis clip-free
// with a plain CSS fix). Every other call site (table row actions, form
// fields — nothing with a clipping ancestor) keeps the simpler, non-portal
// rendering. Also wraps instead of a single `nowrap` line and clamps to the
// viewport, since a portal tooltip has no natural container to constrain it.
export function Tooltip({ label, children, position = "top", className = "", portal = false }) {
    const anchorRef = useRef(null);
    const [portalStyle, setPortalStyle] = useState(null);

    if (!label) return children;

    if (!portal) {
        return (
            <span className={`group/tooltip relative ${className}`}>
                {children}
                <span
                    role="tooltip"
                    className={`pointer-events-none absolute z-20 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 opacity-0 shadow-md transition-opacity duration-150 group-hover/tooltip:opacity-100 ${POSITION_CLASSES[position]}`}
                >
                    {label}
                </span>
            </span>
        );
    }

    function showPortalTooltip() {
        if (!anchorRef.current) return;
        setPortalStyle(computeTooltipStyle(anchorRef.current.getBoundingClientRect(), position));
    }

    function hidePortalTooltip() {
        setPortalStyle(null);
    }

    return (
        <span
            ref={anchorRef}
            className={className}
            onMouseEnter={showPortalTooltip}
            onMouseLeave={hidePortalTooltip}
            onFocus={showPortalTooltip}
            onBlur={hidePortalTooltip}
        >
            {children}
            <FloatingTooltip label={label} style={portalStyle} />
        </span>
    );
}
