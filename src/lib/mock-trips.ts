import "server-only";

import type { LatLng, Trip, TripRequest, TripStatus } from "./uber-rides";
import { getRoute, pointAlong } from "./route";

/**
 * Shared in-memory trip simulation.
 *
 * Both stand-in providers (Uber Guest Rides and the local veteran service)
 * behave the same way: a clock advances a trip through the real status
 * vocabulary, and a driver moves along the driving geometry. Only the driver
 * fixtures and the id prefix differ.
 *
 * Trips live in memory and are lost on reload — a development aid, not storage.
 */

/** Seconds after pickup time at which each state becomes current. */
const TIMELINE: Array<{ at: number; status: TripStatus }> = [
  { at: 0, status: "processing" },
  { at: 8, status: "accepted" },
  { at: 20, status: "arriving" },
  { at: 32, status: "in_progress" },
  { at: 75, status: "completed" },
];

const ACCEPTED_AT = 8;
const ARRIVED_AT = 32;
const COMPLETED_AT = 75;

export type DriverFixture = {
  name: string;
  phone: string;
  make: string;
  model: string;
  plate: string;
  color: string;
};

type MockTrip = {
  requestId: string;
  bookedAt: number;
  pinned?: TripStatus;
  pickup: LatLng;
  dropoff: LatLng;
  driver: DriverFixture;
  route: LatLng[] | null;
  scheduledFor?: number;
  provider?: string;
};

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** A scheduled trip's clock starts at its pickup time, not at booking. */
function elapsedSeconds(trip: MockTrip): number {
  return (Date.now() - (trip.scheduledFor ?? trip.bookedAt)) / 1000;
}

function statusFor(trip: MockTrip): TripStatus {
  if (trip.pinned) return trip.pinned;
  // Nothing is dispatched until the pickup time comes round.
  if (trip.scheduledFor && Date.now() < trip.scheduledFor) return "scheduled";

  const elapsed = elapsedSeconds(trip);
  let current: TripStatus = "processing";
  for (const step of TIMELINE) {
    if (elapsed >= step.at) current = step.status;
  }
  return current;
}

/**
 * Approach leg: the driver starts a little away from pickup and closes in.
 * Trip leg: follows the driving geometry so the car stays on the roads.
 */
function driverLocationFor(trip: MockTrip, status: TripStatus): LatLng | undefined {
  if (!["accepted", "arriving", "in_progress"].includes(status)) return undefined;

  const elapsed = elapsedSeconds(trip);

  if (status === "in_progress") {
    const t = clamp01((elapsed - ARRIVED_AT) / (COMPLETED_AT - ARRIVED_AT));
    if (trip.route) return pointAlong(trip.route, t);
    return {
      latitude: lerp(trip.pickup.latitude, trip.dropoff.latitude, t),
      longitude: lerp(trip.pickup.longitude, trip.dropoff.longitude, t),
    };
  }

  const origin = {
    latitude: trip.pickup.latitude + 0.012,
    longitude: trip.pickup.longitude - 0.014,
  };
  const t = clamp01((elapsed - ACCEPTED_AT) / (ARRIVED_AT - ACCEPTED_AT));
  return {
    latitude: lerp(origin.latitude, trip.pickup.latitude, t),
    longitude: lerp(origin.longitude, trip.pickup.longitude, t),
  };
}

/** Driver and vehicle only exist once someone has actually accepted. */
function toTrip(trip: MockTrip): Trip {
  const status = statusFor(trip);
  const assigned = ["accepted", "arriving", "in_progress", "completed"].includes(status);
  const elapsed = elapsedSeconds(trip);

  return {
    requestId: trip.requestId,
    status,
    provider: trip.provider,
    etaMinutes:
      status === "accepted" || status === "arriving"
        ? Math.max(1, Math.ceil((ARRIVED_AT - elapsed) / 60) + 3)
        : undefined,
    pickup: trip.pickup,
    dropoff: trip.dropoff,
    route: trip.route ?? undefined,
    driverLocation: driverLocationFor(trip, status),
    driver: assigned
      ? { name: trip.driver.name, phoneNumber: trip.driver.phone, rating: 4.9 }
      : undefined,
    vehicle: assigned
      ? {
          make: trip.driver.make,
          model: trip.driver.model,
          licensePlate: trip.driver.plate,
          color: trip.driver.color,
        }
      : undefined,
  };
}

export type MockProvider = {
  /** Ids minted by this provider all start with its prefix. */
  prefix: string;
  owns: (requestId: string) => boolean;
  create: (request: TripRequest) => Promise<Trip>;
  get: (requestId: string) => Trip | null;
  setStatus: (requestId: string, status: TripStatus) => Trip | null;
  resume: (requestId: string) => Trip | null;
};

export function createMockProvider(options: {
  prefix: string;
  drivers: DriverFixture[];
  /** Shown on the trip screen so the rider knows who is coming. */
  provider?: string;
}): MockProvider {
  const trips = new Map<string, MockTrip>();

  return {
    prefix: options.prefix,

    owns: (requestId) => requestId.startsWith(`${options.prefix}-`),

    async create(request) {
      const driver = options.drivers[trips.size % options.drivers.length];
      const trip: MockTrip = {
        requestId: `${options.prefix}-${Math.random().toString(36).slice(2, 10)}`,
        bookedAt: Date.now(),
        pickup: request.pickup,
        dropoff: request.dropoff,
        driver,
        // Looked up once here rather than on every poll.
        route: await getRoute(request.pickup, request.dropoff),
        scheduledFor: request.pickupTimeMs,
        provider: options.provider,
      };
      trips.set(trip.requestId, trip);
      return toTrip(trip);
    },

    get(requestId) {
      const trip = trips.get(requestId);
      return trip ? toTrip(trip) : null;
    },

    /** Pins the trip to a state instead of letting the clock advance it. */
    setStatus(requestId, status) {
      const trip = trips.get(requestId);
      if (!trip) return null;
      trip.pinned = status;
      return toTrip(trip);
    },

    /** Lets the clock take over again from where it would have been. */
    resume(requestId) {
      const trip = trips.get(requestId);
      if (!trip) return null;
      delete trip.pinned;
      return toTrip(trip);
    },
  };
}
