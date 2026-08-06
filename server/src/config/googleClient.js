// Wraps Google's OAuth2Client so the rest of the app (Google login/ID token
// verification) doesn't construct its own client or read env vars directly.
import { OAuth2Client } from "google-auth-library";

let client;

// Lazily creates and caches a single OAuth2Client instance — avoids
// re-reading env/config and re-initializing the client on every request.
export function getGoogleClient() {
    if (!client) {
        client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    }
    return client;
}
