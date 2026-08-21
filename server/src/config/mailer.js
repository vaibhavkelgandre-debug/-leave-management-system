// The one and only module in this codebase that knows a mail provider
// exists. Nodemailer/SMTP was chosen to get the flow working end to end and
// is explicitly temporary — swapping to an HTTP-API provider (Resend,
// SendGrid) means rewriting `sendMail` below and nothing else.
//
// That temporariness is why this deviates from the config/cloudinary.js
// precedent it otherwise mirrors: that file exports a configured *client*,
// because the Cloudinary SDK is the only Cloudinary implementation we'll
// ever have, so exposing it costs nothing. Here, exporting a nodemailer
// transporter would leak the provider's shape into mailService.js and make
// the swap a two-file change. Exporting a function keeps it to one.
//
// `{ to, subject, text, html }` is deliberately the exact intersection of
// nodemailer's sendMail, Resend's emails.send and @sendgrid/mail's send —
// all three accept those keys under those names, so this isn't an invented
// abstraction. Resist adding cc/bcc until something needs them: that's
// precisely where the three providers diverge.
//
// `attachments` was added for exactly one reason — the payslip PDF emailed
// after a payroll run (mailService.sendSalarySlipEmail) — and is the one
// place this abstraction is *not* a free intersection, so it's normalized
// here rather than passed through raw. All three providers accept a
// `{ filename, content }` pair, but they disagree on everything around it:
// nodemailer takes `content` as a Buffer/stream/string plus `contentType`,
// Resend takes `content` as a Buffer or base64 string, SendGrid demands
// base64 in `content` and requires `type`. Callers therefore hand over
// `{ filename, content: Buffer, contentType }` and this function maps it to
// whatever the current provider wants — keeping the swap a one-file change,
// which is the whole point of this module.
import dns from "node:dns/promises";
import net from "node:net";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

// Nodemailer's defaults are 120s connect / 30s greeting / 600s socket — a
// hung SMTP server would hold a socket for ten minutes. Capped hard.
const CONNECTION_TIMEOUT_MS = 5_000;
const GREETING_TIMEOUT_MS = 5_000;
const SOCKET_TIMEOUT_MS = 10_000;

// Google displays an App Password as four space-separated groups, and it's
// routinely pasted into .env verbatim — which fails authentication with an
// unhelpful error. Strip whitespace rather than making everyone debug it.
function smtpPassword() {
    return (process.env.SMTP_PASS || "").replace(/\s+/g, "");
}

// Input: none. Output: true when there's enough config to attempt a send.
// Checks the credentials, not just the host, because a half-filled .env is
// the common failure and would otherwise surface as a per-send auth error.
export function isMailConfigured() {
    return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && smtpPassword());
}

// Falls back to SMTP_USER because most providers (Gmail/Workspace included)
// reject or silently rewrite a From that isn't the authenticated mailbox or
// one of its verified aliases. Kept here rather than in the templates so
// per-provider sender rules stay in one file.
function fromAddress() {
    return process.env.MAIL_FROM || process.env.SMTP_USER;
}

// `secure: true` is implicit TLS (port 465); `false` negotiates STARTTLS on
// a plaintext port (587 — what Gmail/Workspace expect, and what works from
// Render, which blocks outbound 25). Read as a string comparison because
// every env var is a string and Boolean("false") is true.
//
// No connection pooling: pooling is for bulk sends, and a pooled connection
// idle between password resets gets closed server-side, producing a
// stale-socket failure on the next send.
function transportOptions({ host, servername }) {
    return {
        host,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === "true",
        auth: { user: process.env.SMTP_USER, pass: smtpPassword() },
        connectionTimeout: CONNECTION_TIMEOUT_MS,
        greetingTimeout: GREETING_TIMEOUT_MS,
        socketTimeout: SOCKET_TIMEOUT_MS,
        // Set only when `host` is an IP literal (see getTransporter below):
        // without it TLS validates the certificate against the address rather
        // than smtp.gmail.com and every send fails on a hostname mismatch.
        ...(servername ? { tls: { servername } } : {}),
    };
}

// Why this resolves DNS itself instead of handing nodemailer the hostname.
//
// Nodemailer does not use dns.lookup. lib/shared/index.js calls resolve4 and
// resolve6 separately, concatenates the results IPv4-first, then picks one at
// *random*, keeping the others as connect-failure fallbacks. Render has no
// IPv6 route, so any pick landing on an AAAA record fails with ENETUNREACH —
// and when the platform resolver returns no A record at all there is no
// fallback left to try. That is exactly how
// "connect ENETUNREACH 2404:6800:4003:c05::6d:587" reached production with
// every invite and password reset silently undelivered, while the identical
// config worked locally.
//
// Handing nodemailer an IPv4 literal makes its own resolution a no-op (it
// short-circuits on an IP), so the address family cannot be chosen wrongly.
//
// Deliberately falls back to the hostname if the A lookup fails: that is the
// pre-existing behaviour, so a resolver hiccup can never leave us worse off
// than not pinning at all.
const HOST_CACHE_TTL_MS = 5 * 60 * 1000;

let cachedTransporter = null;
let cachedUntil = 0;

async function ipv4For(host) {
    if (!host || net.isIP(host)) return null;
    const addresses = await dns.resolve4(host);
    if (!addresses.length) return null;
    // Random rather than [0], for the reason nodemailer itself randomizes —
    // spread across Google's pool — and so the retry after an invalidated
    // cache can land on a different address.
    return addresses[Math.floor(Math.random() * addresses.length)];
}

// Built lazily and cached rather than at module load, because resolution is
// async. The TTL means a rotated Google IP is picked up without a restart,
// and rebuilding is cheap precisely because there is no pool to warm.
async function getTransporter() {
    if (!isMailConfigured()) return null;
    if (cachedTransporter && Date.now() < cachedUntil) return cachedTransporter;

    const host = process.env.SMTP_HOST;
    let options = transportOptions({ host });

    try {
        const address = await ipv4For(host);
        if (address) options = transportOptions({ host: address, servername: host });
    } catch (error) {
        console.warn(
            `Could not resolve an IPv4 address for ${host} (${error.code || error.message}) — using the hostname`
        );
    }

    cachedTransporter = nodemailer.createTransport(options);
    cachedUntil = Date.now() + HOST_CACHE_TTL_MS;
    return cachedTransporter;
}

// Input: one message, described in provider-neutral terms, where
// `attachments` (optional) is a list of `{ filename, content: Buffer,
// contentType }`. Output: `true` when the message was actually handed to the
// transport, `false` when a non-sending path below short-circuited it —
// callers that report "we emailed it" to a user (invitations) need to tell
// those two apart, and guessing from `isMailConfigured()` at the call site
// would duplicate this function's own rules. Failure mode: rejects if the
// transport rejects (bad credentials, connection refused, timeout) — callers
// decide whether that's fatal, the same convention cloudinaryService.js
// follows.
//
// Two non-sending paths, both deliberate:
//   - Under NODE_ENV=test, never send. config/cloudinary.js's own
//     dotenv.config() already leaks server/.env into the test process
//     (setup.js loads .env.test with override, but a key absent there and
//     present in .env still lands), so real SMTP credentials WILL be visible
//     to the suite. Without this guard, any future test touching a mail path
//     without stubbing this module would send real email.
//   - Unconfigured: log the message instead. That's the local-dev fallback,
//     and living here rather than in the caller means every future sender
//     (invites, etc.) inherits it for free.
export async function sendMail({ to, subject, text, html, attachments }) {
    if (process.env.NODE_ENV === "test") return false;

    const transporter = await getTransporter();

    if (!transporter) {
        // Attachment *contents* are never logged — a payslip PDF in the
        // dev console would be both useless and a data leak into log
        // aggregation. Names only, so the fallback still shows what would
        // have gone out.
        const attachmentNames = (attachments ?? []).map((file) => file.filename).join(", ");
        const attachmentNote = attachmentNames ? `\n[attachments] ${attachmentNames}` : "";
        console.log(`[mail:not-configured] to=${to} subject=${subject}\n${text}${attachmentNote}`);
        return false;
    }

    const message = {
        from: fromAddress(),
        to,
        subject,
        text,
        html,
        // nodemailer happens to take the same shape callers pass in, so this
        // is a passthrough *today* — mapped explicitly anyway (rather than
        // spreading the caller's object) so a provider swap has one obvious
        // place to translate, and so an unexpected key can't reach the
        // provider. Omitted entirely when there's nothing to attach.
        ...(attachments?.length
            ? {
                  attachments: attachments.map((file) => ({
                      filename: file.filename,
                      content: file.content,
                      contentType: file.contentType,
                  })),
              }
            : {}),
    };

    try {
        await transporter.sendMail(message);
    } catch (error) {
        // Drop the pinned address so the next send re-resolves: one dead IP in
        // Google's pool would otherwise keep failing for the whole TTL.
        cachedTransporter = null;
        throw error;
    }

    return true;
}
