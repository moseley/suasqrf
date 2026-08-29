import "server-only";

/**
 * Uber Guest Rides client — books trips for people who do not have an Uber
 * account, which is the veteran case.
 *
 * Server-only: this uses the client_credentials grant, so the secret must
 * never reach the browser. The UI calls our own /api/rides route instead.
 *
 * Docs: https://developer.uber.com/docs/guest-rides/introduction
 */

const TOKEN_URL = "https://auth.uber.com/oauth/v2/token";
const SCOPE = "guests.trips";

const PROD_BASE = "https://api.uber.com";
const SANDBOX_BASE = "https://sandbox-api.uber.com";

export type RidesConfig = {
  clientId: string;
  clientSecret: string;
  /** Sent as x-uber-organizationuuid; required for third-party apps. */
  organizationId?: string;
  /** Sandbox run to attach requests to (x-uber-sandbox-runuuid). */
  sandboxRunId?: string;
  sandbox: boolean;
};

/** Returns null when unconfigured, so the app keeps working as a mock. */
export function getRidesConfig(): RidesConfig | null {
  const clientId = process.env.UBER_RIDES_CLIENT_ID;
  const clientSecret = process.env.UBER_RIDES_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  return {
    clientId,
    clientSecret,
    organizationId: process.env.UBER_RIDES_ORG_ID || undefined,
    sandboxRunId: process.env.UBER_RIDES_SANDBOX_RUN_ID || undefined,
    sandbox: process.env.UBER_ENV !== "production",
  };
}

function baseUrl(config: RidesConfig): string {
  return config.sandbox ? SANDBOX_BASE : PROD_BASE;
}

type CachedToken = { value: string; expiresAt: number };
let cached: CachedToken | null = null;

/** Reuses the token until a minute before it expires. */
export async function getAccessToken(config: RidesConfig): Promise<string> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "client_credentials",
      scope: SCOPE,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Uber token request failed: ${response.status}`);
  }

  const body = (await response.json()) as { access_token: string; expires_in: number };
  cached = { value: body.access_token, expiresAt: Date.now() + (body.expires_in - 60) * 1000 };
  return cached.value;
}

function headers(config: RidesConfig, token: string): HeadersInit {
  const result: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (config.organizationId) result["x-uber-organizationuuid"] = config.organizationId;
  if (config.sandbox && config.sandboxRunId) {
    result["x-uber-sandbox-runuuid"] = config.sandboxRunId;
  }
  return result;
}

export type LatLng = { latitude: number; longitude: number; address?: string };

export type ProductEstimate = {
  productId: string;
  fareId?: string;
  displayName?: string;
  fareDisplay?: string;
  etaMinutes?: number;
};

/**
 * Lists the products available between two points and their upfront fares.
 * The fare_id returned here locks the price when passed to createGuestTrip.
 */
export async function getEstimates(
  config: RidesConfig,
  pickup: LatLng,
  dropoff: LatLng,
): Promise<ProductEstimate[]> {
  const token = await getAccessToken(config);

  const response = await fetch(`${baseUrl(config)}/v1/guests/trips/estimates`, {
    method: "POST",
    headers: headers(config, token),
    body: JSON.stringify({ pickup, dropoff }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Uber estimates failed: ${response.status} ${await response.text()}`);
  }

  const body = (await response.json()) as {
    estimates?: Array<{
      product_id: string;
      fare_id?: string;
      display_name?: string;
      fare_display?: string;
      estimate_info?: { eta?: number };
    }>;
  };

  return (body.estimates ?? []).map((estimate) => ({
    productId: estimate.product_id,
    fareId: estimate.fare_id,
    displayName: estimate.display_name,
    fareDisplay: estimate.fare_display,
    etaMinutes: estimate.estimate_info?.eta,
  }));
}

export type Guest = {
  firstName: string;
  lastName: string;
  /** E.164, e.g. +14155550123. */
  phoneNumber: string;
  email?: string;
};

export type TripRequest = {
  guest: Guest;
  pickup: LatLng;
  dropoff: LatLng;
  productId: string;
  fareId?: string;
  noteForDriver?: string;
};

/**
 * Uber's own trip states. Never widen these into a friendlier claim — the UI
 * label must follow the recorded state (MVP_REFERENCE.md §7.2).
 */
export type TripStatus =
  | "processing"
  | "no_drivers_available"
  | "accepted"
  | "arriving"
  | "in_progress"
  | "driver_canceled"
  | "rider_canceled"
  | "completed"
  | "scheduled"
  | "failed"
  | "offered"
  | "expired"
  | "driver_redispatched";

export type Trip = {
  requestId: string;
  status: TripStatus;
  etaMinutes?: number;
  driver?: { name: string; phoneNumber?: string; rating?: number };
  vehicle?: { make?: string; model?: string; licensePlate?: string };
  /** Echoed back so a status screen can draw the route without re-sending it. */
  pickup?: LatLng;
  dropoff?: LatLng;
  /** Present only while a driver is assigned and moving. */
  driverLocation?: { latitude: number; longitude: number };
};

type TripResponse = {
  request_id: string;
  status: TripStatus;
  estimate_info?: { eta?: number };
  driver?: { name: string; phone_number?: string; rating?: number } | null;
  vehicle?: { make?: string; model?: string; license_plate?: string } | null;
};

function toTrip(body: TripResponse, route?: { pickup: LatLng; dropoff: LatLng }): Trip {
  return {
    requestId: body.request_id,
    status: body.status,
    etaMinutes: body.estimate_info?.eta,
    pickup: route?.pickup,
    dropoff: route?.dropoff,
    driver: body.driver
      ? {
          name: body.driver.name,
          phoneNumber: body.driver.phone_number,
          rating: body.driver.rating,
        }
      : undefined,
    vehicle: body.vehicle
      ? {
          make: body.vehicle.make,
          model: body.vehicle.model,
          licensePlate: body.vehicle.license_plate,
        }
      : undefined,
  };
}

/** Books the trip. A 409 means surge or an expired fare — re-estimate and retry. */
export async function createGuestTrip(
  config: RidesConfig,
  request: TripRequest,
): Promise<Trip> {
  const token = await getAccessToken(config);

  const response = await fetch(`${baseUrl(config)}/v1/guests/trips`, {
    method: "POST",
    headers: headers(config, token),
    body: JSON.stringify({
      guest: {
        first_name: request.guest.firstName,
        last_name: request.guest.lastName,
        phone_number: request.guest.phoneNumber,
        email: request.guest.email,
      },
      pickup: request.pickup,
      dropoff: request.dropoff,
      product_id: request.productId,
      fare_id: request.fareId,
      note_for_driver: request.noteForDriver,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Uber trip request failed: ${response.status} ${await response.text()}`);
  }

  return toTrip((await response.json()) as TripResponse, {
    pickup: request.pickup,
    dropoff: request.dropoff,
  });
}

export async function getGuestTrip(config: RidesConfig, requestId: string): Promise<Trip> {
  const token = await getAccessToken(config);

  const response = await fetch(`${baseUrl(config)}/v1/guests/trips/${requestId}`, {
    headers: headers(config, token),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Uber trip lookup failed: ${response.status}`);
  }

  return toTrip((await response.json()) as TripResponse);
}
