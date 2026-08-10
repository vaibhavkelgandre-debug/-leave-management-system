import { useEffect } from "react";

// Closes a popover-style element (dropdown, menu) when a pointer event lands
// outside `ref`'s subtree. Shared by the top bar's notification and profile
// dropdowns instead of each reimplementing the same listener.
export function useClickOutside(ref, onClose, active) {
    useEffect(() => {
        if (!active) return undefined;

        function handlePointerDown(event) {
            if (ref.current && !ref.current.contains(event.target)) {
                onClose();
            }
        }

        document.addEventListener("mousedown", handlePointerDown);
        return () => document.removeEventListener("mousedown", handlePointerDown);
    }, [active, ref, onClose]);
}
