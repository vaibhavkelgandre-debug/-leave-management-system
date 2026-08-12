import { useEffect, useRef, useState } from "react";
import { GoogleLogin } from "@react-oauth/google";

// Thin adapter around the third-party Google button: unwraps the library's
// credentialResponse into a plain ID token so callers (LoginForm) don't need
// to know anything about the @react-oauth/google response shape.
//
// Google's rendered button only takes a fixed pixel `width`, not a
// percentage like our own buttons' `w-full` — so to keep it visually the
// same size as the Sign in/GitHub buttons around it, this measures its own
// container and re-renders at that width whenever it changes. ResizeObserver
// isn't available in the jsdom test environment; falling back to `undefined`
// (the library's own default) there is harmless since tests mock GoogleLogin
// entirely and don't assert on its width.
export function GoogleLoginButton({ onSuccess, onError }) {
    const containerRef = useRef(null);
    const [width, setWidth] = useState(0);

    useEffect(() => {
        const el = containerRef.current;
        if (!el || typeof ResizeObserver === "undefined") return;

        const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    return (
        <div ref={containerRef} className="w-full">
            <GoogleLogin
                onSuccess={(credentialResponse) => onSuccess(credentialResponse.credential)}
                onError={onError}
                useOneTap={false}
                width={width || undefined}
            />
        </div>
    );
}
