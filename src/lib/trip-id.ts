import "server-only";

/**
 * Self-describing trip ids.
 *
 * Trips were held in a module-level map, which works on one long-lived server
 * and fails on serverless: the request that books a trip and the requests that
 * poll it can land on different instances, so a poll would find nothing and
 * report the trip as unknown.
 *
 * The id instead carries the facts needed to rebuild the trip, so any instance
 * can answer without shared state. Only immutable facts belong here — anything
 * that changes after booking has to come from the provider.
 */

export function encodeTripPayload(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeTripPayload<T>(encoded: string): T | null {
  try {
    const json = Buffer.from(encoded, "base64url").toString("utf8");
    const parsed: unknown = JSON.parse(json);
    return parsed && typeof parsed === "object" ? (parsed as T) : null;
  } catch {
    return null;
  }
}

/** Coordinates and address as one compact tuple. */
export type PackedPoint = [number, number, string?];

export function packPoint(point: {
  latitude: number;
  longitude: number;
  address?: string;
}): PackedPoint {
  const lat = Number(point.latitude.toFixed(5));
  const lng = Number(point.longitude.toFixed(5));
  return point.address ? [lat, lng, point.address] : [lat, lng];
}

export function unpackPoint(packed: PackedPoint | undefined) {
  if (!packed) return undefined;
  return { latitude: packed[0], longitude: packed[1], address: packed[2] };
}
