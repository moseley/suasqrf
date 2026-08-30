import "server-only";

/**
 * Address → coordinates.
 *
 * Uses OpenStreetMap's Nominatim, which needs no API key. Its usage policy
 * requires an identifying User-Agent and at most one request per second, so
 * results are cached and a small fixture table short-circuits the addresses
 * the demo uses most.
 *
 * Swap in Google or Mapbox here when there is a key to use; nothing outside
 * this module needs to change.
 */

const ENDPOINT = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "suasqrf/0.1 (veteran support coordination; contact via repo)";

export type Point = { latitude: number; longitude: number; address: string };

/** Known addresses, so the common paths work offline and without rate limits. */
const FIXTURES: Array<{ match: RegExp; latitude: number; longitude: number }> = [
  { match: /855\s+maude/i, latitude: 37.40311, longitude: -122.08073 },
  { match: /va\s+palo\s+alto|3801\s+miranda/i, latitude: 37.40636, longitude: -122.14367 },
  { match: /mountain\s+view/i, latitude: 37.38605, longitude: -122.08385 },
  { match: /palo\s+alto/i, latitude: 37.44188, longitude: -122.14302 },
  { match: /san\s+jose/i, latitude: 37.33874, longitude: -121.88569 },
  { match: /sunnyvale/i, latitude: 37.36883, longitude: -122.03635 },
];

const cache = new Map<string, Point>();

function fromFixture(address: string): Point | null {
  const hit = FIXTURES.find((fixture) => fixture.match.test(address));
  return hit ? { latitude: hit.latitude, longitude: hit.longitude, address } : null;
}

/** Returns null when the address cannot be resolved, rather than throwing. */
export async function geocode(address: string): Promise<Point | null> {
  const key = address.trim().toLowerCase();
  if (key === "") return null;

  const cached = cache.get(key);
  if (cached) return cached;

  const fixture = fromFixture(address);
  if (fixture) {
    cache.set(key, fixture);
    return fixture;
  }

  try {
    const url = `${ENDPOINT}?q=${encodeURIComponent(address)}&format=json&limit=1`;
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) return null;

    const body = (await response.json()) as Array<{ lat: string; lon: string }>;
    if (body.length === 0) return null;

    const point: Point = {
      latitude: Number.parseFloat(body[0].lat),
      longitude: Number.parseFloat(body[0].lon),
      address,
    };
    cache.set(key, point);
    return point;
  } catch {
    return null;
  }
}

const REVERSE_ENDPOINT = "https://nominatim.openstreetmap.org/reverse";

const reverseCache = new Map<string, string>();

/**
 * Coordinates → a street address a person can read.
 *
 * A latitude and longitude tell a veteran nothing about whether we have the
 * right place, so any surface that takes a device fix shows this instead.
 * Returns null on failure; the caller keeps the coordinates either way.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  const key = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
  const cached = reverseCache.get(key);
  if (cached) return cached;

  try {
    const url = `${REVERSE_ENDPOINT}?lat=${latitude}&lon=${longitude}&format=json&zoom=18`;
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) return null;

    const body = (await response.json()) as {
      display_name?: string;
      address?: Record<string, string>;
    };

    const parts = body.address ?? {};
    // Prefer a short postal-style line over Nominatim's very long display_name.
    // A fix landing between buildings comes back as "1315;1317;1319" — take the
    // first, which is a real address rather than a list a courier cannot use.
    const houseNumber = parts.house_number?.split(";")[0]?.trim();
    const street = [houseNumber, parts.road].filter(Boolean).join(" ");
    const city = parts.city ?? parts.town ?? parts.village ?? parts.suburb;
    const short = [street, city, parts.state, parts.postcode].filter(Boolean).join(", ");

    const address = short || body.display_name || null;
    if (address) reverseCache.set(key, address);
    return address;
  } catch {
    return null;
  }
}
