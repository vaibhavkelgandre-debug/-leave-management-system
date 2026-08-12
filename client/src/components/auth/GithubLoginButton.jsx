import { Button } from "../ui/Button.jsx";
import { GithubIcon } from "./GithubIcon.jsx";

// Unlike GoogleLoginButton (an async popup that hands back a credential),
// GitHub only offers the authorization-code flow — there's no "call and get
// a result back" here, this has to navigate the whole page away to GitHub
// and rely on GithubCallbackPage to pick up where this left off.
export const GITHUB_OAUTH_STATE_KEY = "github_oauth_state";

// A random state value stored client-side and checked again on return is
// the standard CSRF mitigation for this redirect round-trip — without it,
// an attacker could trick a victim's browser into completing an OAuth
// exchange initiated by the attacker.
function generateState() {
    return crypto.randomUUID();
}

export function GithubLoginButton() {
    function handleClick() {
        const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
        // Without this, a missing env var sends the browser to GitHub with a
        // literal "client_id=undefined" — GitHub's own 404 for an
        // unrecognized client id, which looks like this app is broken rather
        // than just unconfigured. Fail loudly here instead.
        if (!clientId) {
            console.error("VITE_GITHUB_CLIENT_ID is not set — GitHub sign-in is not configured for this environment.");
            return;
        }

        const state = generateState();
        sessionStorage.setItem(GITHUB_OAUTH_STATE_KEY, state);

        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: `${window.location.origin}/login/github/callback`,
            scope: "read:user user:email",
            state,
        });
        window.location.href = `https://github.com/login/oauth/authorize?${params.toString()}`;
    }

    return (
        <Button type="button" variant="secondary" icon={GithubIcon} onClick={handleClick} className="w-full">
            Sign in with GitHub
        </Button>
    );
}
