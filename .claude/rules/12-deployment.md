# Deployment (Render)

> Part of the [project rules](../rules.md). These are binding, not advisory.

---

## 🚀 Deployment (Render)

- Frontend (Static Site) and backend (Web Service) are deployed as **separate Render services** on different `*.onrender.com` subdomains. Since `onrender.com` is a public suffix, this makes them **cross-site** to the browser, not just cross-origin.
- The auth cookie is `httpOnly` + `SameSite=None; Secure` (`server/src/utils/cookies.js`) so it can travel cross-site at all — but browsers (especially Incognito) block cross-site/"third-party" cookies by default regardless of `SameSite=None`. Symptom: login succeeds (frontend trusts the response body's user object), but the cookie never actually gets stored, so the very next API call 401s and the user gets bounced back to sign-in.
- **Fix — make requests same-origin from the browser's point of view** so the cookie is never third-party:
  1. Frontend Static Site → **Settings → Redirects/Rewrites**: add rule `/api/*` → `https://<backend>.onrender.com/api/*`, Action **Rewrite**. It must be listed **above** the catch-all `/*` → `/index.html` SPA fallback rule — Render matches top-to-bottom and stops at the first match, so the fallback would otherwise swallow every `/api/*` request first.
  2. Frontend Static Site → **Environment**: set `VITE_API_URL=/api` (relative, not the backend's absolute URL). Vite bakes this in at build time, so changing it requires **Clear build cache & deploy**, not just a rule save.
- No backend code changes are needed for this — `CLIENT_ORIGIN`/CORS and the cookie's existing `SameSite=None; Secure` settings already work fine once requests are same-origin.
- To verify: `fetch('/api/auth/me')` from the deployed frontend's own devtools console should return the backend's JSON (`x-powered-by: Express`), not the SPA's `index.html`. If it returns HTML, the rewrite rule is missing, misordered, or the build wasn't refreshed.

---
