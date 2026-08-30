import { NextResponse } from "next/server";
import { getRidesConfig, type TripStatus } from "@/lib/uber-rides";
import { isMockEnabled, resumeMockTrip, setMockStatus } from "@/lib/uber-rides-mock";
import * as veteranRides from "@/lib/veteran-rides";
import { requireRidesConfig, setDriverState, type DriverState } from "@/lib/uber-sandbox";

/**
 * Drives a sandbox trip forward by hand.
 *
 * Against the local stand-in it pins a trip to a status; against Uber's real
 * sandbox it steps the mock driver. Either way this is a development control
 * and refuses to run outside the sandbox.
 */

const DRIVER_STATES: DriverState[] = ["ACCEPT", "ARRIVED", "BEGIN_TRIP", "DROPOFF", "CANCEL"];

/** How a driver action reads on the trip, for the local stand-in. */
const AS_STATUS: Record<DriverState, TripStatus> = {
  ACCEPT: "accepted",
  ARRIVED: "arriving",
  BEGIN_TRIP: "in_progress",
  DROPOFF: "completed",
  CANCEL: "driver_canceled",
};

export async function POST(request: Request) {
  const config = getRidesConfig();
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { requestId, state, driverId, resume } = (payload ?? {}) as Record<string, unknown>;

  if (!config && !isMockEnabled() && !(typeof requestId === "string" && veteranRides.owns(requestId))) {
    return NextResponse.json(
      { error: "Set UBER_RIDES_MOCK=1 or configure Guest Rides credentials." },
      { status: 503 },
    );
  }

  // The veteran service has its own stand-in to step.
  const veteranTrip = typeof requestId === "string" && veteranRides.owns(requestId);
  const setStatus = veteranTrip ? veteranRides.sandbox.setStatus : setMockStatus;
  const resumeTrip = veteranTrip ? veteranRides.sandbox.resume : resumeMockTrip;

  if (veteranTrip && !veteranRides.sandbox.available()) {
    return NextResponse.json(
      { error: "The veteran service is pointed at a real API; step it there." },
      { status: 503 },
    );
  }

  if (!config || veteranTrip) {
    if (typeof requestId !== "string") {
      return NextResponse.json({ error: "requestId is required." }, { status: 400 });
    }

    if (resume === true) {
      const trip = await resumeTrip(requestId);
      if (!trip) return NextResponse.json({ error: "Unknown trip." }, { status: 404 });
      return NextResponse.json({ mock: true, ...trip });
    }

    if (typeof state !== "string" || !DRIVER_STATES.includes(state as DriverState)) {
      return NextResponse.json(
        { error: `state must be one of ${DRIVER_STATES.join(", ")}.` },
        { status: 400 },
      );
    }

    const trip = await setStatus(requestId, AS_STATUS[state as DriverState]);
    if (!trip) return NextResponse.json({ error: "Unknown trip." }, { status: 404 });
    return NextResponse.json({ mock: true, ...trip });
  }

  if (typeof driverId !== "string" || typeof state !== "string") {
    return NextResponse.json(
      { error: "driverId and state are required against the Uber sandbox." },
      { status: 400 },
    );
  }

  try {
    await setDriverState(requireRidesConfig(), {
      driverId,
      state: state as DriverState,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Sandbox driver state failed", error);
    return NextResponse.json({ error: String(error) }, { status: 502 });
  }
}
