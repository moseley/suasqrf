import "server-only";

import type { LatLng, Trip, TripRequest, TripStatus } from "./uber-rides";

/**
 * A local stand-in for Guest Rides, for use while the guests.trips scope is
 * still pending approval.
 *
 * It returns the same Trip shape and the same status vocabulary as the real
 * API, so swapping back is a config change rather than a rewrite. Trips live
 * in memory and are lost on reload — this is a development aid, not storage.
 *
 * Enable with UBER_RIDES_MOCK=1.
 */

export function isMockEnabled(): boolean {
  return process.env.UBER_RIDES_MOCK === "1";
}

/** Seconds after booking at which each state becomes current. */
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

type MockTrip = {
  requestId: string;
  bookedAt: number;
  /** Set by the sandbox control route; freezes the trip at this state. */
  pinned?: TripStatus;
  pickup: LatLng;
  dropoff: LatLng;
  driverName: string;
  driverPhone: string;
  vehicle: { make: string; model: string; licensePlate: string };
};

const trips = new Map<string, MockTrip>();

const DRIVERS = [
  { name: "Dana W.", phone: "+14155550188", make: "Toyota", model: "Prius", plate: "7XKD432" },
  { name: "Luis R.", phone: "+14155550149", make: "Honda", model: "Accord", plate: "8ABC211" },
  { name: "Priya N.", phone: "+14155550170", make: "Ford", model: "Escape", plate: "6TRW905" },
];

function elapsedSeconds(trip: MockTrip): number {
  return (Date.now() - trip.bookedAt) / 1000;
}

function statusFor(trip: MockTrip): TripStatus {
  if (trip.pinned) return trip.pinned;
  const elapsed = elapsedSeconds(trip);
  let current: TripStatus = "processing";
  for (const step of TIMELINE) {
    if (elapsed >= step.at) current = step.status;
  }
  return current;
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Approach leg: the driver starts a little away from pickup and closes in.
 * Trip leg: pickup to dropoff. Positions are interpolated from the clock, so
 * a pinned trip holds its position too.
 */
function driverLocationFor(trip: MockTrip, status: TripStatus): LatLng | undefined {
  if (!["accepted", "arriving", "in_progress"].includes(status)) return undefined;

  const origin = {
    latitude: trip.pickup.latitude + 0.012,
    longitude: trip.pickup.longitude - 0.014,
  };
  const elapsed = elapsedSeconds(trip);

  if (status === "in_progress") {
    const t = clamp01((elapsed - ARRIVED_AT) / (COMPLETED_AT - ARRIVED_AT));
    return {
      latitude: lerp(trip.pickup.latitude, trip.dropoff.latitude, t),
      longitude: lerp(trip.pickup.longitude, trip.dropoff.longitude, t),
    };
  }

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
    etaMinutes:
      status === "accepted" || status === "arriving"
        ? Math.max(1, Math.ceil((ARRIVED_AT - elapsed) / 60) + 3)
        : undefined,
    pickup: trip.pickup,
    dropoff: trip.dropoff,
    driverLocation: driverLocationFor(trip, status),
    driver: assigned
      ? { name: trip.driverName, phoneNumber: trip.driverPhone, rating: 4.9 }
      : undefined,
    vehicle: assigned
      ? {
          make: trip.vehicle.make,
          model: trip.vehicle.model,
          licensePlate: trip.vehicle.licensePlate,
        }
      : undefined,
  };
}

export function createMockTrip(request: TripRequest): Trip {
  const driver = DRIVERS[trips.size % DRIVERS.length];
  const trip: MockTrip = {
    requestId: `mock-${Math.random().toString(36).slice(2, 10)}`,
    bookedAt: Date.now(),
    pickup: request.pickup,
    dropoff: request.dropoff,
    driverName: driver.name,
    driverPhone: driver.phone,
    vehicle: { make: driver.make, model: driver.model, licensePlate: driver.plate },
  };
  trips.set(trip.requestId, trip);
  return toTrip(trip);
}

export function getMockTrip(requestId: string): Trip | null {
  const trip = trips.get(requestId);
  return trip ? toTrip(trip) : null;
}

/**
 * Mirrors the sandbox driver-state control: pins the trip to a state instead
 * of letting the clock advance it. Also how you reach the unhappy paths.
 */
export function setMockStatus(requestId: string, status: TripStatus): Trip | null {
  const trip = trips.get(requestId);
  if (!trip) return null;
  trip.pinned = status;
  return toTrip(trip);
}

/** Lets the clock take over again from where it would have been. */
export function resumeMockTrip(requestId: string): Trip | null {
  const trip = trips.get(requestId);
  if (!trip) return null;
  delete trip.pinned;
  return toTrip(trip);
}
