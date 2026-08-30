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

export type Point = {
  latitude: number;
  longitude: number;
  address: string;
  /** Captured here so callers needing a ZIP do not have to look it up again. */
  postcode?: string;
};

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
    const url = `${ENDPOINT}?q=${encodeURIComponent(address)}&format=json&limit=1&addressdetails=1`;
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) return null;

    const body = (await response.json()) as Array<{
      lat: string;
      lon: string;
      address?: Record<string, string>;
    }>;
    if (body.length === 0) return null;

    const point: Point = {
      latitude: Number.parseFloat(body[0].lat),
      longitude: Number.parseFloat(body[0].lon),
      address,
      postcode: body[0].address?.postcode,
    };
    cache.set(key, point);
    return point;
  } catch {
    return null;
  }
}

const REVERSE_ENDPOINT = "https://nominatim.openstreetmap.org/reverse";

const reverseCache = new Map<string, Record<string, string>>();

/** One reverse lookup, cached, shared by the formatters below. */
async function reverseLookup(
  latitude: number,
  longitude: number,
): Promise<Record<string, string> | null> {
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
    const parts = { ...(body.address ?? {}) };
    if (body.display_name) parts.__display = body.display_name;

    reverseCache.set(key, parts);
    return parts;
  } catch {
    return null;
  }
}

/**
 * The postal code at a point.
 *
 * The veteran ride service requires a ZIP on both addresses, and a typed place
 * name or a type-ahead result often carries none — so it is derived from the
 * coordinates rather than the text.
 */
export async function postcodeFor(
  latitude: number,
  longitude: number,
): Promise<string | undefined> {
  const parts = await reverseLookup(latitude, longitude);
  return parts?.postcode;
}

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
  const parts = await reverseLookup(latitude, longitude);
  if (!parts) return null;

  // Prefer a short postal-style line over Nominatim's very long display_name.
  // A fix landing between buildings comes back as "1315;1317;1319" — take the
  // first, which is a real address rather than a list a courier cannot use.
  const houseNumber = parts.house_number?.split(";")[0]?.trim();
  const street = [houseNumber, parts.road].filter(Boolean).join(" ");
  const city = parts.city ?? parts.town ?? parts.village ?? parts.suburb;
  const short = [street, city, parts.state, parts.postcode].filter(Boolean).join(", ");

  return short || parts.__display || null;
}

export type PlaceMatch = {
  /** Short name, e.g. "Kaiser Permanente Mountain View". */
  name: string;
  /** Full address for the field once chosen. */
  address: string;
  latitude: number;
  longitude: number;
  distanceMiles: number;
};

/** Great-circle miles between two points. */
function milesBetween(a: Point, b: { latitude: number; longitude: number }): number {
  const R = 3958.8;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Places matching a name, nearest to a point first.
 *
 * Uses Photon, which is built for type-ahead over the same OpenStreetMap data
 * and takes a location bias — Nominatim ranks by prominence and matches whole
 * names, so "Kaiser" there returns a landmark three counties away before the
 * branch down the road.
 *
 * Free and keyless, with the same caveat as the tile and routing services: fine
 * for development and a pilot, not for real load.
 */
const PHOTON_ENDPOINT = "https://photon.komoot.io/api";

/** A destination is somewhere a driver can drop someone, not a landform. */
const NOT_DESTINATIONS = new Set(["waterway", "natural", "landuse", "boundary", "place"]);

export async function searchNear(
  query: string,
  origin: Point,
  limit = 6,
): Promise<PlaceMatch[]> {
  if (query.trim().length < 3) return [];

  try {
    const url =
      `${PHOTON_ENDPOINT}?q=${encodeURIComponent(query)}` +
      `&lat=${origin.latitude}&lon=${origin.longitude}&limit=25&lang=en`;

    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) return [];

    const body = (await response.json()) as {
      features?: Array<{
        geometry?: { coordinates?: [number, number] };
        properties?: Record<string, string>;
      }>;
    };

    return (body.features ?? [])
      .filter((feature) => !NOT_DESTINATIONS.has(feature.properties?.osm_key ?? ""))
      .map((feature) => {
        const [longitude, latitude] = feature.geometry?.coordinates ?? [NaN, NaN];
        const parts = feature.properties ?? {};
        const street = [parts.housenumber, parts.street].filter(Boolean).join(" ");

        return {
          name: parts.name || street || query,
          address:
            [street, parts.city, parts.state, parts.postcode].filter(Boolean).join(", ") || "",
          latitude,
          longitude,
          distanceMiles: Number(milesBetween(origin, { latitude, longitude }).toFixed(1)),
        };
      })
      .filter((match) => Number.isFinite(match.latitude) && match.address !== "")
      // Photon biases by distance but still weighs importance; sort outright so
      // the closest branch is always first.
      .sort((a, b) => a.distanceMiles - b.distanceMiles)
      .slice(0, limit);
  } catch {
    return [];
  }
}
