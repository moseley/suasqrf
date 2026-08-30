import "server-only";

/**
 * Amadeus Self-Service client — hotels near a location, for the emergency
 * shelter flow.
 *
 * Server-only: client_credentials means the secret must never reach the
 * browser. Sign up at https://developers.amadeus.com for a free test key.
 *
 * With credentials unset this returns clearly-labelled sample properties so
 * the flow is testable, and the surface says so rather than passing them off
 * as live availability.
 */

const TEST_BASE = "https://test.api.amadeus.com";
const PROD_BASE = "https://api.amadeus.com";

/** How far from the veteran we are willing to look. */
export const SEARCH_RADIUS_MILES = 25;

export type AmadeusConfig = {
  clientId: string;
  clientSecret: string;
  production: boolean;
};

export function getAmadeusConfig(): AmadeusConfig | null {
  const clientId = process.env.AMADEUS_CLIENT_ID;
  const clientSecret = process.env.AMADEUS_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    production: process.env.AMADEUS_ENV === "production",
  };
}

function baseUrl(config: AmadeusConfig): string {
  return config.production ? PROD_BASE : TEST_BASE;
}

type CachedToken = { value: string; expiresAt: number };
let cached: CachedToken | null = null;

async function getAccessToken(config: AmadeusConfig): Promise<string> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const response = await fetch(`${baseUrl(config)}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`Amadeus token failed: ${response.status}`);

  const body = (await response.json()) as { access_token: string; expires_in: number };
  cached = { value: body.access_token, expiresAt: Date.now() + (body.expires_in - 60) * 1000 };
  return cached.value;
}

export type Hotel = {
  hotelId: string;
  name: string;
  /** Miles from the searched point, as reported by Amadeus. */
  distanceMiles?: number;
  latitude?: number;
  longitude?: number;
  /** True when this came from the local sample set, not from Amadeus. */
  sample?: boolean;
};

type HotelListResponse = {
  data?: Array<{
    hotelId: string;
    name: string;
    geoCode?: { latitude: number; longitude: number };
    distance?: { value: number; unit: string };
  }>;
};

/**
 * Sample properties used when Amadeus is unconfigured. Deliberately generic:
 * these are not real bookable hotels and the surface labels them as samples.
 */
const SAMPLE_HOTELS: Hotel[] = [
  { hotelId: "SAMPLE001", name: "Sample Inn — Airport", distanceMiles: 3.2, sample: true },
  { hotelId: "SAMPLE002", name: "Sample Lodge — Downtown", distanceMiles: 7.8, sample: true },
  { hotelId: "SAMPLE003", name: "Sample Suites — Midtown", distanceMiles: 14.1, sample: true },
];

export type HotelSearch = {
  configured: boolean;
  hotels: Hotel[];
};

/**
 * Hotels within `radiusMiles` of a point. Returns an empty list rather than
 * throwing when the search fails, so the caller can fall back to the ordinary
 * shelter request instead of showing an error.
 */
export async function findHotelsNear(
  latitude: number,
  longitude: number,
  radiusMiles: number = SEARCH_RADIUS_MILES,
): Promise<HotelSearch> {
  const config = getAmadeusConfig();
  if (!config) return { configured: false, hotels: SAMPLE_HOTELS };

  try {
    const token = await getAccessToken(config);
    const query = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      radius: String(Math.round(radiusMiles)),
      radiusUnit: "MILE",
    });

    const response = await fetch(
      `${baseUrl(config)}/v1/reference-data/locations/hotels/by-geocode?${query}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
    );

    if (!response.ok) {
      console.error("Amadeus hotel search failed", response.status, await response.text());
      return { configured: true, hotels: [] };
    }

    const body = (await response.json()) as HotelListResponse;

    return {
      configured: true,
      hotels: (body.data ?? []).map((hotel) => ({
        hotelId: hotel.hotelId,
        name: hotel.name,
        distanceMiles: hotel.distance?.unit === "MILE" ? hotel.distance.value : undefined,
        latitude: hotel.geoCode?.latitude,
        longitude: hotel.geoCode?.longitude,
      })),
    };
  } catch (error) {
    console.error("Amadeus hotel search error", error);
    return { configured: true, hotels: [] };
  }
}
