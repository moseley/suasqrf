import "server-only";

/**
 * Uber Direct client. Server-only: the client_credentials grant means the
 * secret must never be sent to the browser, so every call here runs in a
 * route handler and the UI talks to our own /api routes instead.
 *
 * Docs: https://developer.uber.com/docs/deliveries/get-started
 */

const TOKEN_URL = "https://auth.uber.com/oauth/v2/token";
const API_BASE = "https://api.uber.com/v1/customers";
const SCOPE = "eats.deliveries";

export type UberConfig = {
  customerId: string;
  clientId: string;
  clientSecret: string;
  pickup: { name: string; address: string; phone: string };
  sandbox: boolean;
};

/**
 * Reads credentials from the environment. Returns null rather than throwing so
 * the app keeps working as a mock wherever they are not configured yet.
 */
export function getUberConfig(): UberConfig | null {
  const customerId = process.env.UBER_CUSTOMER_ID;
  const clientId = process.env.UBER_CLIENT_ID;
  const clientSecret = process.env.UBER_CLIENT_SECRET;
  if (!customerId || !clientId || !clientSecret) return null;

  return {
    customerId,
    clientId,
    clientSecret,
    pickup: {
      name: process.env.UBER_PICKUP_NAME ?? "",
      address: process.env.UBER_PICKUP_ADDRESS ?? "",
      phone: process.env.UBER_PICKUP_PHONE ?? "",
    },
    sandbox: process.env.UBER_ENV !== "production",
  };
}

type CachedToken = { value: string; expiresAt: number };
let cached: CachedToken | null = null;

/**
 * Fetches an access token, reusing the cached one until a minute before it
 * expires. The cache is per server instance, which is all a token needs.
 */
export async function getAccessToken(config: UberConfig): Promise<string> {
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
  cached = {
    value: body.access_token,
    expiresAt: Date.now() + (body.expires_in - 60) * 1000,
  };
  return cached.value;
}

export type DeliveryRequest = {
  dropoffAddress: string;
  dropoffName: string;
  dropoffPhone: string;
  /** Surfaced to the courier — dietary needs, gate codes, and the like. */
  note?: string;
};

export type DeliveryResult = {
  id: string;
  status: string;
  trackingUrl?: string;
};

/**
 * Creates a delivery. Uber Direct also exposes a /delivery_quotes step for
 * pricing before committing; add it if the caller needs a cost up front.
 */
export async function createDelivery(
  config: UberConfig,
  request: DeliveryRequest,
): Promise<DeliveryResult> {
  const token = await getAccessToken(config);

  const response = await fetch(`${API_BASE}/${config.customerId}/deliveries`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      pickup_name: config.pickup.name,
      pickup_address: config.pickup.address,
      pickup_phone_number: config.pickup.phone,
      dropoff_name: request.dropoffName,
      dropoff_address: request.dropoffAddress,
      dropoff_phone_number: request.dropoffPhone,
      dropoff_notes: request.note,
      manifest_items: [
        { name: "Meal", quantity: 1, size: "small" },
      ],
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Uber delivery request failed: ${response.status} ${detail}`);
  }

  const body = (await response.json()) as {
    id: string;
    status: string;
    tracking_url?: string;
  };

  return { id: body.id, status: body.status, trackingUrl: body.tracking_url };
}
