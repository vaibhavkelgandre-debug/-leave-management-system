// GitHub has no verifying SDK like google-auth-library's OAuth2Client — it
// only offers the authorization-code flow, so this talks to GitHub's plain
// REST endpoints directly (built-in fetch) instead of wrapping a client
// object. Kept in one place so authService doesn't know GitHub's HTTP shape.
const TOKEN_URL = "https://github.com/login/oauth/access_token";
const USER_URL = "https://api.github.com/user";
const EMAILS_URL = "https://api.github.com/user/emails";

// Exchanges an authorization code for the GitHub user's id and verified
// primary email. Input: the `code` GitHub redirected back with. Output:
// `{ githubId, email }`, where `email` is null if no verified primary email
// is on the account (GitHub's public profile email can be null/private, so
// only the emails API's verified+primary entry counts, mirroring Google's
// `email_verified` check). Throws on any failed HTTP call or a token
// exchange that GitHub itself rejects (bad/expired/reused code).
export async function fetchGithubIdentity(code) {
    const tokenResponse = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
            client_id: process.env.GITHUB_CLIENT_ID,
            client_secret: process.env.GITHUB_CLIENT_SECRET,
            code,
            redirect_uri: `${process.env.CLIENT_BASE_URL}/login/github/callback`,
        }),
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) {
        throw new Error(tokenData.error_description || "GitHub token exchange failed");
    }

    const authHeaders = {
        Authorization: `Bearer ${tokenData.access_token}`,
        "User-Agent": "leave-management-system",
    };

    const userResponse = await fetch(USER_URL, { headers: authHeaders });
    if (!userResponse.ok) {
        throw new Error("Unable to fetch GitHub profile");
    }
    const user = await userResponse.json();

    const emailsResponse = await fetch(EMAILS_URL, { headers: authHeaders });
    if (!emailsResponse.ok) {
        throw new Error("Unable to fetch GitHub email addresses");
    }
    const emails = await emailsResponse.json();
    const primaryVerified = emails.find((entry) => entry.primary && entry.verified);

    return { githubId: String(user.id), email: primaryVerified?.email ?? null };
}
