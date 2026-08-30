import { NextResponse } from "next/server";
import { geocode, reverseGeocode } from "@/lib/geocode";
import { bookOffer, findHotelsNear, findOffers, SEARCH_RADIUS_MILES, type Guest } from "@/lib/amadeus";

/**
 * Arranges a room for tonight.
 *
 * The nearest open property is chosen and booked outright — a veteran asking
 * for emergency shelter should not have to compare options. Its street address
 * is resolved so the surface can show somewhere recognisable, and so a ride
 * there can be requested without retyping.
 *
 * Anything that fails routes to human coordination rather than guessing.
 */
export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { location, latitude, longitude, guest } = (payload ?? {}) as Record<string, unknown>;

  // The browser may send its own coordinates; otherwise geocode the text.
  let point: { latitude: number; longitude: number; address: string } | null = null;

  if (typeof latitude === "number" && typeof longitude === "number") {
    point = {
      latitude,
      longitude,
      address:
        typeof location === "string" && location.trim() !== "" ? location : "Current location",
    };
  } else if (typeof location === "string" && location.trim() !== "") {
    point = await geocode(location);
  }

  if (!point) {
    return NextResponse.json(
      { error: "Could not resolve that location.", field: "location" },
      { status: 400 },
    );
  }

  const { configured, hotels } = await findHotelsNear(point.latitude, point.longitude);
  const nearest = hotels[0];

  if (!nearest) {
    return NextResponse.json({
      booked: false,
      reason: "Nothing suitable is open nearby right now. A caseworker will arrange this.",
    });
  }

  // by-geocode gives a name and a point but no street address, so resolve one.
  const address =
    nearest.latitude !== undefined && nearest.longitude !== undefined
      ? await reverseGeocode(nearest.latitude, nearest.longitude)
      : null;

  const person = (guest ?? {}) as Partial<Guest>;
  const traveller: Guest = {
    firstName: person.firstName || "Veteran",
    lastName: person.lastName || "Guest",
    phone: person.phone || "+15555555555",
    email: person.email || "guest@example.com",
  };

  const offers = await findOffers([nearest.hotelId]);
  const offer = offers[0];
  const result = await bookOffer(offer?.offerId ?? `hold-${nearest.hotelId}`, traveller);

  if (!result.booked) {
    // Say so plainly: an unbookable room must never look like a booked one.
    return NextResponse.json({ booked: false, reason: result.reason });
  }

  return NextResponse.json({
    booked: true,
    liveSearch: configured,
    sample: result.sample === true,
    radiusMiles: SEARCH_RADIUS_MILES,
    hotel: {
      name: nearest.name,
      address,
      distanceMiles: nearest.distanceMiles,
    },
    confirmationNumber: result.confirmationNumber,
    checkInDate: offer?.checkInDate,
  });
}
