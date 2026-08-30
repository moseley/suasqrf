import { NextResponse } from "next/server";
import {
  createGuestTrip,
  getEstimates,
  getGuestTrip,
  getRidesConfig,
  type LatLng,
} from "@/lib/uber-rides";
import { createMockTrip, getMockTrip, isMockEnabled } from "@/lib/uber-rides-mock";
import { geocode } from "@/lib/geocode";
import * as veteranRides from "@/lib/veteran-rides";

/**
 * Books a guest trip, and reports one back.
 *
 * The browser posts here rather than to Uber, so the client secret stays on
 * the server. Without credentials the route reports `configured: false` and
 * the caller falls back to the mock confirmation.
 */

function isLatLng(value: unknown): value is LatLng {
  if (!value || typeof value !== "object") return false;
  const point = value as Record<string, unknown>;
  return typeof point.latitude === "number" && typeof point.longitude === "number";
}

/** Coordinates win when both are supplied; otherwise the address is geocoded. */
async function resolve(point: unknown, address: unknown): Promise<LatLng | null> {
  if (isLatLng(point)) return point;
  if (typeof address !== "string" || address.trim() === "") return null;
  return geocode(address);
}

export async function POST(request: Request) {
  const config = getRidesConfig();
  if (!config && !isMockEnabled()) {
    return NextResponse.json(
      { configured: false, reason: "Uber Guest Rides credentials are not set." },
      { status: 503 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { guest, productId, fareId, note, pickupTime, veteranDriver } = (payload ??
    {}) as Record<string, unknown>;
  const pickupTimeMs = typeof pickupTime === "number" ? pickupTime : undefined;
  const body = (payload ?? {}) as Record<string, unknown>;

  // Callers may send coordinates directly, or plain addresses to resolve here.
  // Geocoding stays server-side so the UI never needs a maps key.
  const pickup = await resolve(body.pickup, body.pickupAddress);
  if (!pickup) {
    return NextResponse.json(
      { error: "Could not resolve the pickup location.", field: "pickup" },
      { status: 400 },
    );
  }

  const dropoff = await resolve(body.dropoff, body.dropoffAddress);
  if (!dropoff) {
    return NextResponse.json(
      { error: "Could not resolve the destination.", field: "dropoff" },
      { status: 400 },
    );
  }

  const rider = (guest ?? {}) as Record<string, unknown>;
  if (typeof rider.firstName !== "string" || typeof rider.phoneNumber !== "string") {
    return NextResponse.json(
      { error: "guest.firstName and guest.phoneNumber are required." },
      { status: 400 },
    );
  }

  const riderDetails = {
    firstName: rider.firstName,
    lastName: typeof rider.lastName === "string" ? rider.lastName : "",
    phoneNumber: rider.phoneNumber,
    email: typeof rider.email === "string" ? rider.email : undefined,
  };

  // A veteran driver is a different service entirely, not an Uber option.
  if (veteranDriver === true) {
    try {
      const trip = await veteranRides.createTrip({
        guest: riderDetails,
        pickup,
        dropoff,
        productId: "veteran-standard",
        noteForDriver: typeof note === "string" ? note : undefined,
        pickupTimeMs,
      });
      return NextResponse.json({ configured: true, ...trip });
    } catch (error) {
      console.error("Veteran ride request failed", error);
      return NextResponse.json(
        { error: "Could not reach the veteran driver service." },
        { status: 502 },
      );
    }
  }

  // Local stand-in while guests.trips approval is pending. Same shapes, so
  // turning it off is the only change needed once the real scope lands.
  if (!config) {
    const trip = await createMockTrip({
      guest: riderDetails,
      pickup,
      dropoff,
      productId: "mock-uberx",
      noteForDriver: typeof note === "string" ? note : undefined,
      pickupTimeMs,
    });
    return NextResponse.json({ configured: true, sandbox: true, mock: true, ...trip });
  }

  try {
    // Without a product the estimate picks one, which also yields the fare_id
    // that locks the upfront price.
    let chosenProduct = typeof productId === "string" ? productId : undefined;
    let chosenFare = typeof fareId === "string" ? fareId : undefined;

    if (!chosenProduct) {
      const estimates = await getEstimates(config, pickup, dropoff);
      if (estimates.length === 0) {
        return NextResponse.json(
          { configured: true, status: "no_drivers_available", estimates: [] },
          { status: 200 },
        );
      }
      chosenProduct = estimates[0].productId;
      chosenFare = estimates[0].fareId;
    }

    const trip = await createGuestTrip(config, {
      guest: riderDetails,
      pickup,
      dropoff,
      productId: chosenProduct,
      fareId: chosenFare,
      noteForDriver: typeof note === "string" ? note : undefined,
      pickupTimeMs,
    });

    return NextResponse.json({ configured: true, sandbox: config.sandbox, ...trip });
  } catch (error) {
    console.error("Uber guest trip failed", error);
    return NextResponse.json({ error: "Could not book the ride." }, { status: 502 });
  }
}

/** GET /api/rides?requestId=... — the current recorded state of a trip. */
export async function GET(request: Request) {
  const config = getRidesConfig();
  const lookupId = new URL(request.url).searchParams.get("requestId") ?? "";
  if (!config && !isMockEnabled() && !veteranRides.owns(lookupId)) {
    return NextResponse.json(
      { configured: false, reason: "Uber Guest Rides credentials are not set." },
      { status: 503 },
    );
  }

  const requestId = new URL(request.url).searchParams.get("requestId");
  if (!requestId) {
    return NextResponse.json({ error: "requestId is required." }, { status: 400 });
  }

  if (veteranRides.owns(requestId)) {
    try {
      const trip = await veteranRides.getTrip(requestId);
      if (!trip) return NextResponse.json({ error: "Unknown trip." }, { status: 404 });
      return NextResponse.json({ configured: true, ...trip });
    } catch (error) {
      console.error("Veteran ride lookup failed", error);
      return NextResponse.json({ error: "Could not read the trip." }, { status: 502 });
    }
  }

  if (!config) {
    const trip = getMockTrip(requestId);
    if (!trip) return NextResponse.json({ error: "Unknown trip." }, { status: 404 });
    return NextResponse.json({ configured: true, sandbox: true, mock: true, ...trip });
  }

  try {
    const trip = await getGuestTrip(config, requestId);
    return NextResponse.json({ configured: true, sandbox: config.sandbox, ...trip });
  } catch (error) {
    console.error("Uber trip lookup failed", error);
    return NextResponse.json({ error: "Could not read the trip." }, { status: 502 });
  }
}
