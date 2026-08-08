// Detects a file's real type from its content (magic bytes) rather than its
// extension or the client-reported Content-Type — the spec is explicit that
// neither can be trusted server-side. Only the three types this app accepts
// are recognized; anything else returns null.
const SIGNATURES = [
    { mimeType: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // "%PDF-"
    { mimeType: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
    { mimeType: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
];

// Input: a file buffer. Output: one of "application/pdf" / "image/jpeg" /
// "image/png", or null if the content doesn't match any of them.
export function detectFileType(buffer) {
    const match = SIGNATURES.find((signature) =>
        signature.bytes.every((byte, index) => buffer[index] === byte)
    );
    return match ? match.mimeType : null;
}
