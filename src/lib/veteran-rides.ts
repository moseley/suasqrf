import "server-only";

import { createMockProvider } from "./mock-trips";
import { getRoute } from "./route";
import type { Trip, TripRequest, TripStatus } from "./uber-rides";
import {
  decodeTripPayload,
  encodeTripPayload,
  packPoint,
  unpackPoint,
  type PackedPoint,
} from "./trip-id";

/**
 * Veterans To Veterans — the local ride service used when a rider asks for a
 * veteran driver.
 *
 * Speaks the Veteran Network ride API: one POST /api/v1/ride-requests matches
 * a veteran driver and books them, so there is no search-then-book handshake
 * to orchestrate here.
 *
 * Point it at a deployment with VETERAN_RIDES_API_URL. Unset, it falls back to
 * a local stand-in so the flow stays testable.
 */

export const PROVIDER_NAME = "Veterans To Veterans";

/** Ids are prefixed so a lookup can tell which provider owns a trip. */
const PREFIX = "vrs";

const DEFAULT_DURATION_MINUTES = 60;
const DEFAULT_MAX_DISTANCE_KM = 40;

const fallback = createMockProvider({
  prefix: PREFIX,
  provider: PROVIDER_NAME,
  drivers: [
    { name: "Ray T.", phone: "+14155550131", make: "Chevrolet", model: "Silverado", plate: "4VET889", color: "Green" },
    { name: "Angela M.", phone: "+14155550164", make: "Subaru", model: "Outback", plate: "5USMC12", color: "Grey" },
    { name: "Curtis B.", phone: "+14155550192", make: "Jeep", model: "Cherokee", plate: "3ARMY07", color: "Tan" },
  ],
});

type ServiceConfig = { apiUrl: string; apiKey?: string };

function getConfig(): ServiceConfig | null {
  const apiUrl = process.env.VETERAN_RIDES_API_URL?.replace(/\/+$/, "");
  if (!apiUrl) return null;
  return { apiUrl, apiKey: process.env.VETERAN_RIDES_API_KEY };
}

export function owns(requestId: string): boolean {
  return requestId.startsWith(`${PREFIX}-`) || requestId.startsWith(`${PREFIX}:`);
}

/**
 * Hyphen, not a colon: the id travels in a URL path segment, and a colon gets
 * percent-encoded there and re-encoded on the way back out, so the prefix
 * stops matching and the lookup goes to the wrong provider.
 */
function tag(id: string): string {
  return `${PREFIX}-${id}`;
}

function untag(requestId: string): string {
  return requestId.startsWith(`${PREFIX}-`) || requestId.startsWith(`${PREFIX}:`)
    ? requestId.slice(PREFIX.length + 1)
    : requestId;
}

/** US five-digit ZIP out of a free-text address, when there is one. */
function zipFrom(address: string | undefined): string | undefined {
  return address?.match(/\b(\d{5})(?:-\d{4})?\b/)?.[1];
}

/** The ZIP travels in its own field, so it is not repeated in the address. */
function addressWithoutZip(address: string | undefined): string {
  return (address ?? "")
    .replace(/\b\d{5}(?:-\d{4})?\b/, "")
    .replace(/[\s,]+$/, "")
    .trim();
}

/**
 * The API exposes no read endpoint for a booking, so the match is carried in
 * the id rather than held in memory: a module-level map is lost whenever a
 * different instance serves the poll, which reported the trip as unknown.
 *
 * It follows that the trip does not change after booking — the status screen
 * shows what was recorded at match time and nothing more.
 */
type Packed = {
  st: TripStatus;
  /** Matched veteran, absent when nobody was available. */
  n?: string;
  c?: string;
  l?: string;
  p: PackedPoint;
  o: PackedPoint;
};

type RideResponse = {
  status?: string;
  veteran?: {
    name?: string;
    carModel?: string;
    licensePlate?: string;
    zipCode?: string;
  } | null;
  booking?: { status?: string } | null;
  message?: string;
};

function statusFrom(response: RideResponse): TripStatus {
  if (response.status && response.status !== "matched") return "no_drivers_available";
  if (!response.veteran) return "no_drivers_available";

  switch (response.booking?.status) {
    case "confirmed":
      return "accepted";
    case "completed":
      return "completed";
    case "cancelled":
      return "rider_canceled";
    default:
      return "processing";
  }
}

export async function createTrip(request: TripRequest): Promise<Trip> {
  const config = getConfig();
  if (!config) return fallback.create(request);

  // Doubles as the trip's identity, since the API returns none.
  const idempotencyKey = crypto.randomUUID();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Idempotency-Key": idempotencyKey,
  };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;

  const response = await fetch(`${config.apiUrl}/api/v1/ride-requests`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      rider: {
        name: [request.guest.firstName, request.guest.lastName].filter(Boolean).join(" "),
        veteran: true,
        phone: request.guest.phoneNumber,
      },
      currentAddress: {
        address: addressWithoutZip(request.pickup.address),
        ...(zipFrom(request.pickup.address) ? { zipCode: zipFrom(request.pickup.address) } : {}),
      },
      destinationAddress: {
        address: addressWithoutZip(request.dropoff.address),
        ...(zipFrom(request.dropoff.address) ? { zipCode: zipFrom(request.dropoff.address) } : {}),
      },
      durationMinutes: DEFAULT_DURATION_MINUTES,
      maxDistanceKm: DEFAULT_MAX_DISTANCE_KM,
      ...(request.noteForDriver ? { notes: request.noteForDriver } : {}),
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Veteran ride request failed: ${response.status} ${await response.text()}`);
  }

  const body = (await response.json()) as RideResponse;
  const status = statusFrom(body);

  const packed: Packed = {
    st: status,
    ...(body.veteran?.name ? { n: body.veteran.name } : {}),
    ...(body.veteran?.carModel ? { c: body.veteran.carModel } : {}),
    ...(body.veteran?.licensePlate ? { l: body.veteran.licensePlate } : {}),
    p: packPoint(request.pickup),
    o: packPoint(request.dropoff),
  };

  return {
    requestId: tag(encodeTripPayload(packed)),
    status,
    provider: PROVIDER_NAME,
    pickup: request.pickup,
    dropoff: request.dropoff,
    route: (await getRoute(request.pickup, request.dropoff)) ?? undefined,
    // Only present once a veteran is actually matched.
    driver: body.veteran?.name ? { name: body.veteran.name } : undefined,
    vehicle: body.veteran?.carModel
      ? { model: body.veteran.carModel, licensePlate: body.veteran.licensePlate }
      : undefined,
  };
}

export async function getTrip(requestId: string): Promise<Trip | null> {
  const config = getConfig();
  if (!config) return fallback.get(requestId);

  const packed = decodeTripPayload<Packed>(untag(requestId));
  const pickup = unpackPoint(packed?.p);
  const dropoff = unpackPoint(packed?.o);
  if (!packed || !pickup || !dropoff) return null;

  return {
    requestId,
    status: packed.st,
    provider: PROVIDER_NAME,
    pickup,
    dropoff,
    route: (await getRoute(pickup, dropoff)) ?? undefined,
    driver: packed.n ? { name: packed.n } : undefined,
    vehicle: packed.c ? { model: packed.c, licensePlate: packed.l } : undefined,
  };
}

/** Sandbox stepping, available only against the stand-in. */
export const sandbox = {
  setStatus: fallback.setStatus,
  resume: fallback.resume,
  available: () => getConfig() === null,
};
