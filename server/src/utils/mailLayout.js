// The visual shell every outbound email shares — a small set of HTML
// builders so mailService.js's templates describe *content* and never
// re-hand-roll a table layout. Pure string formatting: no transport, no
// business rules, no I/O.
//
// Why it looks like 2003 HTML on purpose: mail clients are not browsers.
//   - Layout is `<table>`-based, not flex/grid. Outlook (Word rendering
//     engine) ignores both, and a flex layout collapses to a single
//     unstyled column there.
//   - Every style is inline. Gmail strips <style> blocks in several
//     contexts (notably its mobile apps and forwarded messages), which
//     would take the whole design with it.
//   - No remote images — clients block them by default, so anything
//     load-bearing would render as a broken box. The "logo" is text.
//   - Max width 600px, the width every mail client agrees on, with the
//     content re-centred by a wrapper table rather than `margin: auto`.
//   - `background` is set on the wrapper AND repeated on the inner card:
//     some clients drop body/table backgrounds, and a card without one
//     would put dark text on a dark background in Gmail's dark mode.
//
// A "preheader" is the grey preview line Gmail shows next to the subject in
// the inbox list. Left unset, Gmail scrapes the first visible text (often a
// bare greeting, or "View this email in your browser"), so every template
// passes one deliberately.

const INK = "#0f172a";
const MUTED = "#475569";
const FAINT = "#94a3b8";
const BORDER = "#e2e8f0";
const CANVAS = "#f1f5f9";
const CARD = "#ffffff";
const PRIMARY = "#4f46e5";
const ACCENT_BG = "#f0fdf4";
const ACCENT_BORDER = "#86efac";
const ACCENT_TEXT = "#15803d";

const FONT_STACK =
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

const PRODUCT_NAME = "Leave Management System";

// Any value that reaches the HTML has to go through this: names, emails,
// designations and void reasons are all user-supplied (HR types the name on
// the invite form), and an unescaped `<` or `&` silently mangles the layout
// long before it's an injection concern. Applied at the leaves — every
// builder below escapes its own inputs — so a template can't forget.
export function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// A normal body paragraph. `size`/`color` are the only knobs, since anything
// more expressive belongs in its own builder rather than a grab-bag of
// options — templates stay readable that way.
export function paragraph(text, { size = 15, color = INK, marginTop = 0, marginBottom = 16 } = {}) {
    return `<p style="margin: ${marginTop}px 0 ${marginBottom}px; font-family: ${FONT_STACK}; font-size: ${size}px; line-height: 1.6; color: ${color};">${escapeHtml(
        text
    )}</p>`;
}

// The primary call to action. A padded <a> inside a single-cell table: the
// table gives Outlook something it will actually render at the right size,
// and the inline padding on the anchor keeps the tap target big enough on
// mobile clients that ignore the cell.
export function button({ label, href }) {
    return `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 20px;">
            <tr>
                <td align="center" bgcolor="${PRIMARY}" style="border-radius: 8px;">
                    <a href="${escapeHtml(href)}"
                       style="display: inline-block; padding: 12px 22px; font-family: ${FONT_STACK}; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">
                        ${escapeHtml(label)}
                    </a>
                </td>
            </tr>
        </table>`;
}

// The "or paste this link" fallback that belongs under every CTA — a button
// is a dead end for anyone reading in a text-only client, or when the client
// mangles the anchor. `word-break` matters: a long token-bearing URL
// otherwise stretches the card and breaks the 600px layout.
export function linkFallback(url) {
    return `
        <p style="margin: 0 0 20px; font-family: ${FONT_STACK}; font-size: 13px; line-height: 1.6; color: ${MUTED};">
            Or paste this link into your browser:<br />
            <span style="word-break: break-all; color: ${PRIMARY};">${escapeHtml(url)}</span>
        </p>`;
}

// A label/value list (pay period, net pay, …) as a two-column table rather
// than "Label: value" text, so values line up and long labels don't wrap
// into them. `emphasis: true` on a row renders it as the highlighted figure
// — used for net pay, the one number the reader is actually looking for.
export function detailRows(rows) {
    const cells = rows
        .map(({ label, value, emphasis = false }, index) => {
            const valueStyle = emphasis
                ? `font-size: 16px; font-weight: 700; color: ${ACCENT_TEXT};`
                : `font-size: 14px; font-weight: 600; color: ${INK};`;
            // Rules go between rows, not under the last one — a border on the
            // final row lands directly on the table's own rounded edge and
            // reads as a stray line.
            const rule = index === rows.length - 1 ? "" : `border-bottom: 1px solid ${BORDER};`;
            return `
            <tr>
                <td style="padding: 8px 12px; ${rule} font-family: ${FONT_STACK}; font-size: 13px; color: ${MUTED};">${escapeHtml(
                    label
                )}</td>
                <td align="right" style="padding: 8px 12px; ${rule} font-family: ${FONT_STACK}; ${valueStyle}">${escapeHtml(
                    value
                )}</td>
            </tr>`;
        })
        .join("");

    return `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
               style="width: 100%; margin: 0 0 20px; border: 1px solid ${BORDER}; border-radius: 8px; border-collapse: separate; overflow: hidden;">
            ${cells}
        </table>`;
}

// A tinted callout for the one thing the reader must not miss — the "your
// PDF is attached" line, an expiry warning. Deliberately not a `<blockquote>`
// (clients restyle it) and not an icon (no remote images).
export function callout(text, { tone = "accent" } = {}) {
    const background = tone === "accent" ? ACCENT_BG : CANVAS;
    const border = tone === "accent" ? ACCENT_BORDER : BORDER;
    const color = tone === "accent" ? ACCENT_TEXT : MUTED;
    return `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width: 100%; margin: 0 0 20px;">
            <tr>
                <td style="padding: 12px 14px; background: ${background}; border: 1px solid ${border}; border-radius: 8px; font-family: ${FONT_STACK}; font-size: 13px; line-height: 1.6; color: ${color};">${escapeHtml(
                    text
                )}</td>
            </tr>
        </table>`;
}

// Small print under the main content — security notes, "if you didn't ask
// for this". Separated from `paragraph` so every template's fine print gets
// the same weight instead of each picking its own font size.
export function footnote(text) {
    return `<p style="margin: 0 0 10px; font-family: ${FONT_STACK}; font-size: 12px; line-height: 1.6; color: ${MUTED};">${escapeHtml(
        text
    )}</p>`;
}

// Input: the subject-adjacent `heading`, the inbox `preheader` line, and an
// array of already-built HTML blocks from the helpers above. Output: a
// complete HTML document.
//
// Blocks are joined rather than concatenated by the caller so the layout owns
// all of the vertical rhythm — every builder already carries its own bottom
// margin, and the shell only adds the card padding around them.
export function renderEmailLayout({ heading, preheader, blocks }) {
    const body = blocks.filter(Boolean).join("\n");

    return `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>${escapeHtml(heading)}</title>
</head>
<body style="margin: 0; padding: 0; background: ${CANVAS};">
    <!-- Preheader: shown by Gmail next to the subject, never in the message
         body. Zero-size + hidden + zero opacity because no single one of
         those is respected everywhere. -->
    <div style="display: none; font-size: 1px; line-height: 1px; max-height: 0; max-width: 0; opacity: 0; overflow: hidden; mso-hide: all;">
        ${escapeHtml(preheader)}
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width: 100%; background: ${CANVAS};">
        <tr>
            <td align="center" style="padding: 28px 12px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width: 100%; max-width: 600px;">
                    <tr>
                        <td style="padding: 0 4px 14px; font-family: ${FONT_STACK}; font-size: 13px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase; color: ${MUTED};">
                            ${escapeHtml(PRODUCT_NAME)}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 28px; background: ${CARD}; border: 1px solid ${BORDER}; border-radius: 12px;">
                            <h1 style="margin: 0 0 18px; font-family: ${FONT_STACK}; font-size: 20px; line-height: 1.3; font-weight: 700; color: ${INK};">
                                ${escapeHtml(heading)}
                            </h1>
                            ${body}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 16px 4px 0; font-family: ${FONT_STACK}; font-size: 11px; line-height: 1.6; color: ${FAINT};">
                            Automated message from ${escapeHtml(PRODUCT_NAME)} — please don't reply to this address.
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

// Input: the same lines the HTML shows, as an array (falsy entries dropped so
// a template can inline a condition). Output: the plain-text alternative.
//
// Never optional: a message with no text part is scored as spam by most
// filters, and text-only clients would otherwise show nothing at all. Kept
// here so both halves of a template are built by the same module and can't
// drift into saying different things.
export function renderPlainText(lines) {
    return [...lines.filter((line) => line !== null && line !== undefined && line !== false), "", "—", PRODUCT_NAME]
        .join("\n")
        .replace(/\n{3,}/g, "\n\n");
}
