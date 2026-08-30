/**
 * A short reference a person can read out.
 *
 * Trip ids carry the whole trip so any server instance can rebuild it, which
 * makes them far too long to show. This derives a stable short code from the
 * id — same id, same code, on every poll and every instance.
 */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1

export function shortReference(requestId: string): string {
  // FNV-1a: tiny, deterministic, and good enough to keep collisions rare
  // across the handful of trips one person will ever have open.
  let hash = 0x811c9dc5;
  for (let i = 0; i < requestId.length; i++) {
    hash ^= requestId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  let code = "";
  for (let i = 0; i < 6; i++) {
    code += ALPHABET[hash % ALPHABET.length];
    hash = Math.floor(hash / ALPHABET.length) || Math.imul(hash + i + 1, 0x01000193) >>> 0;
  }

  // Keep the provider hint that already prefixes the id.
  const prefix = requestId.startsWith("vrs-") ? "VT" : "RQ";
  return `#${prefix}-${code}`;
}
