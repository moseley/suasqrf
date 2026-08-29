import { NextResponse } from "next/server";
import {
  createGuestTrip,
  getEstimates,
  getGuestTrip,
  getRidesConfig,
  type LatLng,
} from "@/lib/uber-rides";

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

export async function POST(request: Request) {
  const config = getRidesConfig();
  if (!config) {
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

  const { guest, pickup, dropoff, productId, fareId, note } = (payload ?? {}) as Record<
    string,
    unknown
  >;

  if (!isLatLng(pickup) || !isLatLng(dropoff)) {
    return NextResponse.json(
      { error: "pickup and dropoff each need a latitude and longitude." },
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
      guest: {
        firstName: rider.firstName,
        lastName: typeof rider.lastName === "string" ? rider.lastName : "",
        phoneNumber: rider.phoneNumber,
        email: typeof rider.email === "string" ? rider.email : undefined,
      },
      pickup,
      dropoff,
      productId: chosenProduct,
      fareId: chosenFare,
      noteForDriver: typeof note === "string" ? note : undefined,
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
  if (!config) {
    return NextResponse.json(
      { configured: false, reason: "Uber Guest Rides credentials are not set." },
      { status: 503 },
    );
  }

  const requestId = new URL(request.url).searchParams.get("requestId");
  if (!requestId) {
    return NextResponse.json({ error: "requestId is required." }, { status: 400 });
  }

  try {
    const trip = await getGuestTrip(config, requestId);
    return NextResponse.json({ configured: true, sandbox: config.sandbox, ...trip });
  } catch (error) {
    console.error("Uber trip lookup failed", error);
    return NextResponse.json({ error: "Could not read the trip." }, { status: 502 });
  }
}
