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

/* ── Offers and booking ─────────────────────────────────────────────────── */

export type Offer = {
  offerId: string;
  hotelId: string;
  hotelName: string;
  checkInDate: string;
  checkOutDate: string;
  roomDescription?: string;
  price?: { total: string; currency: string };
};

type OffersResponse = {
  data?: Array<{
    hotel?: { hotelId: string; name: string };
    available?: boolean;
    offers?: Array<{
      id: string;
      checkInDate: string;
      checkOutDate: string;
      room?: { description?: { text?: string } };
      price?: { total?: string; currency?: string };
    }>;
  }>;
};

/** Tonight: check in today, out tomorrow. */
export function tonight(): { checkInDate: string; checkOutDate: string } {
  const day = 24 * 60 * 60 * 1000;
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  return { checkInDate: iso(new Date()), checkOutDate: iso(new Date(Date.now() + day)) };
}

/**
 * Bookable offers for the given hotels tonight. Test-environment coverage is
 * patchy, so an empty result is normal and not an error.
 */
export async function findOffers(hotelIds: string[], adults = 1): Promise<Offer[]> {
  const config = getAmadeusConfig();
  if (!config || hotelIds.length === 0) return [];

  const { checkInDate, checkOutDate } = tonight();

  try {
    const token = await getAccessToken(config);
    const query = new URLSearchParams({
      hotelIds: hotelIds.slice(0, 20).join(","),
      adults: String(adults),
      checkInDate,
      checkOutDate,
    });

    const response = await fetch(`${baseUrl(config)}/v3/shopping/hotel-offers?${query}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("Amadeus offers failed", response.status, await response.text());
      return [];
    }

    const body = (await response.json()) as OffersResponse;

    return (body.data ?? [])
      .filter((entry) => entry.available !== false)
      .flatMap((entry) =>
        (entry.offers ?? []).map((offer) => ({
          offerId: offer.id,
          hotelId: entry.hotel?.hotelId ?? "",
          hotelName: entry.hotel?.name ?? "",
          checkInDate: offer.checkInDate,
          checkOutDate: offer.checkOutDate,
          roomDescription: offer.room?.description?.text,
          price:
            offer.price?.total && offer.price.currency
              ? { total: offer.price.total, currency: offer.price.currency }
              : undefined,
        })),
      );
  } catch (error) {
    console.error("Amadeus offers error", error);
    return [];
  }
}

export type Guest = { firstName: string; lastName: string; phone: string; email: string };

export type BookingResult =
  | { booked: true; confirmationNumber: string; sample?: boolean }
  | { booked: false; reason: string };

/**
 * Payment for a real booking. Amadeus requires a card even in the test
 * environment, so card details are read from the environment and are never
 * committed. Without them, booking is refused rather than faked.
 */
function paymentFromEnv(): Record<string, unknown> | null {
  const vendorCode = process.env.AMADEUS_PAYMENT_VENDOR;
  const cardNumber = process.env.AMADEUS_PAYMENT_CARD;
  const expiryDate = process.env.AMADEUS_PAYMENT_EXPIRY;
  const holderName = process.env.AMADEUS_PAYMENT_HOLDER;
  if (!vendorCode || !cardNumber || !expiryDate || !holderName) return null;

  return {
    method: "CREDIT_CARD",
    paymentCard: {
      paymentCardInfo: { vendorCode, cardNumber, expiryDate, holderName },
    },
  };
}

/**
 * Books one offer. Returns a refusal rather than throwing, so a shelter
 * request can always fall through to human coordination.
 */
export async function bookOffer(offerId: string, guest: Guest): Promise<BookingResult> {
  const config = getAmadeusConfig();

  if (!config) {
    // Clearly marked so no surface can present this as a real reservation.
    return { booked: true, confirmationNumber: `SAMPLE-${offerId.slice(-6)}`, sample: true };
  }

  const payment = paymentFromEnv();
  if (!payment) {
    return { booked: false, reason: "Payment is not configured for hotel booking." };
  }

  try {
    const token = await getAccessToken(config);

    const response = await fetch(`${baseUrl(config)}/v2/booking/hotel-orders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        data: {
          type: "hotel-order",
          guests: [
            {
              tid: 1,
              title: "MR",
              firstName: guest.firstName,
              lastName: guest.lastName,
              phone: guest.phone,
              email: guest.email,
            },
          ],
          travelAgent: { contact: { email: guest.email } },
          roomAssociations: [
            { guestReferences: [{ guestReference: "1" }], hotelOfferId: offerId },
          ],
          payment,
        },
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("Amadeus booking failed", response.status, detail);
      return { booked: false, reason: "The room could not be booked." };
    }

    const body = (await response.json()) as {
      data?: { id?: string; associatedRecords?: Array<{ reference?: string }> };
    };

    const reference =
      body.data?.associatedRecords?.[0]?.reference ?? body.data?.id ?? "CONFIRMED";
    return { booked: true, confirmationNumber: reference };
  } catch (error) {
    console.error("Amadeus booking error", error);
    return { booked: false, reason: "The room could not be booked." };
  }
}
