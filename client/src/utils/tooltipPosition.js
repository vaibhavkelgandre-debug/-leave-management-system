// Where a floating (portal-rendered) tooltip should sit, in viewport
// coordinates. Pulled out of ui/Tooltip.jsx once a second caller needed the
// same maths — the calendars, whose hover targets are DOM elements
// FullCalendar creates rather than React children a `<Tooltip>` could wrap
// (see hooks/useHoverTooltip.js). Keeping it here means both callers agree on
// the gap, the max width and the edge-clamping, so a calendar tooltip and a
// sidebar tooltip land the same distance from their trigger.

// Shared with the tooltip's own `maxWidth` — the clamping below only works if
// the box really is this wide at most.
export const TOOLTIP_MAX_WIDTH = 220;
const TOOLTIP_GAP = 6;
const VIEWPORT_MARGIN = 8;

// Input: the trigger's `getBoundingClientRect()` and a position keyword.
// Output: `{ top, left, transform }` for a `position: fixed` box — where its
// own top-left corner should land, before its own transform re-centres it.
// "top"/"bottom" give a centre point (clamped edge-to-edge below);
// "left"/"right" give a vertically-centred edge, where only horizontal
// clamping matters since the box is short and unlikely to overflow
// vertically.
export function computeTooltipStyle(rect, position) {
    if (position === "right") {
        const left = Math.min(rect.right + TOOLTIP_GAP, window.innerWidth - TOOLTIP_MAX_WIDTH - VIEWPORT_MARGIN);
        return { top: rect.top + rect.height / 2, left: Math.max(left, VIEWPORT_MARGIN), transform: "translateY(-50%)" };
    }
    if (position === "left") {
        const left = Math.max(rect.left - TOOLTIP_GAP - TOOLTIP_MAX_WIDTH, VIEWPORT_MARGIN);
        return { top: rect.top + rect.height / 2, left, transform: "translateY(-50%)" };
    }
    const half = TOOLTIP_MAX_WIDTH / 2;
    const centerX = Math.min(
        Math.max(rect.left + rect.width / 2, VIEWPORT_MARGIN + half),
        window.innerWidth - VIEWPORT_MARGIN - half
    );
    if (position === "bottom") {
        return { top: rect.bottom + TOOLTIP_GAP, left: centerX, transform: "translateX(-50%)" };
    }
    return { top: rect.top - TOOLTIP_GAP, left: centerX, transform: "translateX(-50%) translateY(-100%)" };
}
