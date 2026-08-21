// The one and only module in this codebase that knows a mail provider exists.
//
// This is the swap the previous version of this file predicted: it used
// nodemailer over Gmail SMTP, called that "explicitly temporary", and noted
// that moving to an HTTP-API provider would mean rewriting `sendMail` and
// nothing else. That held — this file changed and mailService.js,
// mailFeatures.js, mailLayout.js and every caller did not.
//
// Why the swap was forced, so nobody tries to go back: **Render blocks
// outbound SMTP.** Ports 587 and 465 both fail with a TCP connect timeout
// (5s, before any TLS or auth), and a silent drop rather than ECONNREFUSED is
// the signature of a firewall, not a slow host — a TCP handshake to Google is
// one round trip. Before that surfaced, the same setup failed differently and
// far more confusingly: nodemailer resolves A and AAAA records separately and
// picks one at *random*, so sends died on `connect ENETUNREACH 2404:6800:…`
// whenever the coin landed on IPv6, which Render has no route for. Pinning to
// IPv4 fixed that and revealed the port block underneath. No amount of SMTP
// configuration gets mail out of Render.
//
// HTTPS on 443 is not blocked, which is the whole reason this works.
//
// Deliberately no `@sendgrid/mail` dependency: the v3 send endpoint is one
// POST with a JSON body, `fetch` is global in Node 18+, and a package buys
// nothing but risk here — an uncommitted nodemailer entry in package.json is
// what crashed this project's Render deploy at boot earlier. Zero new
// dependencies means that failure mode cannot recur.
//
// This still exports a *function*, not a client — the same deviation from
// config/cloudinary.js's precedent, for the same reason. Exposing a provider
// object would leak its shape into mailService.js and make the next swap a
// two-file change.
//
// `{ to, subject, text, html }` remains the exact intersection of SendGrid's,
// Resend's and nodemailer's send calls, so it stays swappable. Resist adding
// cc/bcc until something needs them: that's precisely where providers diverge.
//
// `attachments` is the one key that is *not* a free intersection, and exists
// for exactly one caller — the payslip PDF (mailService.sendSalarySlipEmail).
// Callers hand over `{ filename, content: Buffer, contentType }` and this
// function maps it to whatever the current provider wants. SendGrid demands
// base64 in `content` plus `type` and `disposition`; nodemailer took a raw
// Buffer; Resend takes either. Keep that mapping explicit here rather than
// spreading the caller's object through, so the next swap stays one file.
import dotenv from "dotenv";

dotenv.config();

const SEND_ENDPOINT = "https://api.sendgrid.com/v3/mail/send";

// A hung provider must not hold a request open indefinitely. The old SMTP
// transport capped connect/greeting/socket separately; one HTTP request needs
// one budget. 10s is generous for a JSON POST and still well inside any
// reasonable proxy timeout — and the payslip flow sends sequentially *after*
// responding, so a slow provider delays that loop rather than a user's wait.
const REQUEST_TIMEOUT_MS = 10_000;

// SendGrid wants `from` as `{ email, name }`, but MAIL_FROM is conventionally
// one RFC-5322 string. Parse the display-name form rather than making every
// deployment configure the same identity twice.
//
// The bare-address form is the common case and passes through untouched.
//
// Both quoting mistakes are absorbed rather than passed on, because an env var
// that literally contains quotes is a *known* deployment error here: dotenv
// strips surrounding quotes from a .env file and hosting dashboards do not, so
// the value that works locally arrives quoted in production. `"Name <addr>"`
// (the whole thing quoted) and `"Name" <addr>` (only the display name, the RFC
// form) therefore both parse to the same sender. The old nodemailer parser
// turned the first into the garbage address `"Name <addr"@example.com` and sent
// it anyway; failing loudly would be better than that, but not failing at all
// is better still.
function parseFrom(value) {
    let raw = (value || "").trim();
    // Only a pair wrapping the *entire* value — `"Name" <addr>` ends in `>`,
    // so the RFC form is untouched by this.
    const wrapped = raw.match(/^"(.*)"$/);
    if (wrapped) raw = wrapped[1].trim();
    if (!raw) return null;

    const angled = raw.match(/^(.*)<([^>]+)>\s*$/);
    if (!angled) return { email: raw };

    const name = angled[1].trim().replace(/^"(.*)"$/, "$1").trim();
    const email = angled[2].trim();
    return name ? { email, name } : { email };
}

// No fallback, unlike the SMTP version which could default to SMTP_USER
// because the authenticated mailbox *was* the sender. SendGrid rejects a send
// whose `from` isn't a verified sender, so a missing MAIL_FROM has to read as
// "unconfigured" (log the message) instead of 403-ing on every send.
function fromAddress() {
    return parseFrom(process.env.MAIL_FROM);
}

function apiKey() {
    // Pasted keys routinely carry a trailing newline or stray spaces, which
    // produces a 401 indistinguishable from a wrong key. Same reasoning as
    // the Gmail App Password whitespace strip this replaces.
    return (process.env.SENDGRID_API_KEY || "").trim();
}

// Input: none. Output: true when there's enough config to attempt a send.
// Checks the sender as well as the key, because SendGrid refuses an
// unverified `from` and a half-filled environment is the common failure —
// which would otherwise surface as a 403 on every send rather than the
// unconfigured fallback below.
export function isMailConfigured() {
    return Boolean(apiKey() && fromAddress());
}

// Input: one message, described in provider-neutral terms, where
// `attachments` (optional) is a list of `{ filename, content: Buffer,
// contentType }`. Output: `true` when the message actually reached the
// provider, `false` when a non-sending path below short-circuited it —
// callers that tell a human "we emailed them" (the invite flow's `emailSent`)
// need to tell those apart, and guessing from `isMailConfigured()` at the
// call site would duplicate this function's own rules. Failure mode: rejects
// if the provider rejects (bad key, unverified sender, network) — callers
// decide whether that's fatal, the same convention cloudinaryService.js
// follows.
//
// Two non-sending paths, both deliberate:
//   - Under NODE_ENV=test, never send. config/cloudinary.js's own
//     dotenv.config() already leaks server/.env into the test process
//     (setup.js loads .env.test with override, but a key absent there and
//     present in .env still lands), so real credentials WILL be visible to
//     the suite. Without this guard, any future test touching a mail path
//     without stubbing this module would send real email.
//   - Unconfigured: log the message instead. That's the local-dev fallback,
//     and living here rather than in the caller means every future sender
//     inherits it for free. Note it logs the full plain-text body, which for
//     invites and resets *contains a live link* — harmless on a laptop, a
//     credential leak into log aggregation in a deployed environment, which
//     is why isMailConfigured() must be true anywhere real.
export async function sendMail({ to, subject, text, html, attachments }) {
    if (process.env.NODE_ENV === "test") return false;

    if (!isMailConfigured()) {
        // Attachment *contents* are never logged — a payslip PDF in the dev
        // console would be both useless and a data leak into log
        // aggregation. Names only, so the fallback still shows what would
        // have gone out.
        const attachmentNames = (attachments ?? []).map((file) => file.filename).join(", ");
        const attachmentNote = attachmentNames ? `\n[attachments] ${attachmentNames}` : "";
        console.log(`[mail:not-configured] to=${to} subject=${subject}\n${text}${attachmentNote}`);
        return false;
    }

    // Order matters: SendGrid requires content parts in ascending MIME
    // preference, so text/plain must precede text/html or the API 400s.
    const content = [{ type: "text/plain", value: text }];
    if (html) content.push({ type: "text/html", value: html });

    // Every tracking feature off, explicitly, because SendGrid enables click
    // tracking by default and that default is actively wrong for this app.
    //
    // Click tracking rewrites every href into a `sendgrid.net` redirect. For
    // these three emails that link is a single-use credential — an invite or
    // password-reset token — so tracking would route a live secret through a
    // third-party redirector, and it also destroys the one property that lets
    // a recipient tell a real invite from a phishing attempt: a visible link
    // to the domain the mail claims to come from. Mismatched link and sender
    // domains are a spam signal in their own right.
    //
    // Open tracking embeds a remote 1x1 image, which contradicts
    // mailLayout.js's no-remote-images rule (blocked images render as broken
    // boxes) and buys nothing: nobody acts on an open rate for a password
    // reset. Subscription tracking would append an unsubscribe footer to
    // transactional mail nobody opted into, which is both nonsensical and a
    // way to have someone "unsubscribe" from their own account emails.
    //
    // Set per-send rather than left to the dashboard so a console toggle
    // can't silently reintroduce any of it.
    const tracking_settings = {
        click_tracking: { enable: false, enable_text: false },
        open_tracking: { enable: false },
        subscription_tracking: { enable: false },
    };

    const payload = {
        personalizations: [{ to: [{ email: to }] }],
        from: fromAddress(),
        subject,
        content,
        tracking_settings,
        ...(attachments?.length
            ? {
                  attachments: attachments.map((file) => ({
                      filename: file.filename,
                      content: file.content.toString("base64"),
                      type: file.contentType,
                      disposition: "attachment",
                  })),
              }
            : {}),
    };

    let response;
    try {
        response = await fetch(SEND_ENDPOINT, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey()}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
    } catch (error) {
        // fetch rejects only on a network-level failure or the timeout above;
        // an HTTP error status resolves normally and is handled below. Both
        // become one thrown Error so callers see a single failure shape.
        throw new Error(`Mail provider unreachable: ${error.message}`);
    }

    // 202 Accepted is the success case and its body is empty, so there's
    // nothing to parse or return. Anything else carries a JSON `errors` array
    // whose messages are the only way to tell a bad key from an unverified
    // sender — surface them instead of a bare status code, because that
    // distinction is exactly what a deployment needs from the log line.
    if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`Mail provider rejected the message (${response.status}): ${detail.slice(0, 500)}`);
    }

    return true;
}
