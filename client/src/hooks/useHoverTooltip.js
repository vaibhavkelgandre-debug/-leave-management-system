// Drives the app's `FloatingTooltip` from a hover on a plain DOM element,
// for the one case `<Tooltip>` can't cover: FullCalendar builds its own event
// elements, so there's no React child to wrap. The calendars attach listeners
// to those elements in `eventDidMount` and call `show`/`hide` here.
//
// This exists so the calendars don't keep using the native `title` attribute
// — the only place in the app that still did, which is exactly why a leave
// bar's hover label looked like an OS tooltip (stark dark box) next to the
// app's own light one on every icon button. The look itself is not duplicated:
// this hook only owns *when* and *where*, and ui/Tooltip.jsx still owns *what
// it looks like*.
import { useCallback, useState } from "react";
import { computeTooltipStyle } from "../utils/tooltipPosition.js";

// Input: the position keyword to place the tooltip at ("top" by default,
// matching every other tooltip in the app). Output:
// `{ label, style, show, hide }` — feed `label`/`style` straight into
// `<FloatingTooltip>`, and call `show(element, label)` / `hide()` from
// listeners.
//
// `show` measures the element on every call rather than caching a rect: a
// month grid re-lays-out on navigation, and a stale rect would put the
// tooltip somewhere the trigger no longer is.
export function useHoverTooltip(position = "top") {
    const [hovered, setHovered] = useState(null);

    const show = useCallback(
        (element, label) => {
            if (!element || !label) return;
            setHovered({ label, style: computeTooltipStyle(element.getBoundingClientRect(), position) });
        },
        [position]
    );

    // Also the cleanup path: an element removed while hovered (navigating to
    // another month with the cursor over an event) never fires `mouseleave`,
    // so the calendars call this from `eventWillUnmount` too. Setting the same
    // `null` twice is free — React bails out of the re-render itself.
    const hide = useCallback(() => setHovered(null), []);

    return { label: hovered?.label ?? null, style: hovered?.style ?? null, show, hide };
}
