import "server-only";

import { createMockProvider } from "./mock-trips";
import type { Trip, TripRequest } from "./uber-rides";

/**
 * Local veteran-driver ride service.
 *
 * A separate provider from Uber, used when the rider asks for a veteran
 * driver. Point it at a real service with VETERAN_RIDES_API_URL and
 * VETERAN_RIDES_API_KEY; with neither set it falls back to a stand-in that
 * behaves like the Uber one, so the flow is testable today.
 *
 * The remote service is expected to speak the same Trip shape. Adapt it here
 * if the real one differs — nothing outside this module should need to care.
 */

export const PROVIDER_NAME = "Veterans To Veterans";

/** Ids are prefixed so a lookup can tell which provider owns a trip. */
const PREFIX = "vrs";

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
  const apiUrl = process.env.VETERAN_RIDES_API_URL;
  if (!apiUrl) return null;
  return { apiUrl, apiKey: process.env.VETERAN_RIDES_API_KEY };
}

export function owns(requestId: string): boolean {
  return requestId.startsWith(`${PREFIX}-`) || requestId.startsWith(`${PREFIX}:`);
}

function headers(config: ServiceConfig): HeadersInit {
  const result: Record<string, string> = { "Content-Type": "application/json" };
  if (config.apiKey) result.Authorization = `Bearer ${config.apiKey}`;
  return result;
}

/** Remote ids are namespaced on the way in and stripped on the way out. */
function tag(id: string): string {
  return `${PREFIX}:${id}`;
}

function untag(requestId: string): string {
  return requestId.startsWith(`${PREFIX}:`) ? requestId.slice(PREFIX.length + 1) : requestId;
}

export async function createTrip(request: TripRequest): Promise<Trip> {
  const config = getConfig();
  if (!config) return fallback.create(request);

  const response = await fetch(`${config.apiUrl}/rides`, {
    method: "POST",
    headers: headers(config),
    body: JSON.stringify({
      rider: request.guest,
      pickup: request.pickup,
      dropoff: request.dropoff,
      pickupTimeMs: request.pickupTimeMs,
      veteranDriverRequested: true,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Veteran ride request failed: ${response.status} ${await response.text()}`);
  }

  const trip = (await response.json()) as Trip;
  return { ...trip, requestId: tag(trip.requestId), provider: PROVIDER_NAME };
}

export async function getTrip(requestId: string): Promise<Trip | null> {
  const config = getConfig();
  if (!config) return fallback.get(requestId);

  const response = await fetch(`${config.apiUrl}/rides/${untag(requestId)}`, {
    headers: headers(config),
    cache: "no-store",
  });

  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Veteran ride lookup failed: ${response.status}`);

  const trip = (await response.json()) as Trip;
  return { ...trip, requestId: tag(trip.requestId), provider: PROVIDER_NAME };
}

/** Sandbox stepping, available only against the stand-in. */
export const sandbox = {
  setStatus: fallback.setStatus,
  resume: fallback.resume,
  available: () => getConfig() === null,
};
