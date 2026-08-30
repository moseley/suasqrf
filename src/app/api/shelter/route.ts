import { NextResponse } from "next/server";
import { geocode } from "@/lib/geocode";
import { findHotelsNear, SEARCH_RADIUS_MILES } from "@/lib/amadeus";

/**
 * Looks for hotels near a shelter request.
 *
 * Geocoding and the Amadeus call both stay server-side, so no key reaches the
 * browser. When nothing is found within the radius the caller falls back to an
 * ordinary shelter request rather than showing an empty list.
 */
export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { location } = (payload ?? {}) as Record<string, unknown>;
  if (typeof location !== "string" || location.trim() === "") {
    return NextResponse.json({ error: "A location is required." }, { status: 400 });
  }

  const point = await geocode(location);
  if (!point) {
    return NextResponse.json(
      { error: "Could not resolve that location.", field: "location" },
      { status: 400 },
    );
  }

  const { configured, hotels } = await findHotelsNear(point.latitude, point.longitude);

  return NextResponse.json({
    configured,
    radiusMiles: SEARCH_RADIUS_MILES,
    location: point,
    hotels,
  });
}
