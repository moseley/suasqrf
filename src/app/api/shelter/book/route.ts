import { NextResponse } from "next/server";
import { bookOffer, findOffers, type Guest } from "@/lib/amadeus";

/**
 * Books a room for tonight.
 *
 * A refusal is reported plainly so the caller can fall back to human
 * coordination — an unbookable room must never look like a booked one.
 */
export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { hotelId, guest } = (payload ?? {}) as Record<string, unknown>;
  if (typeof hotelId !== "string" || hotelId === "") {
    return NextResponse.json({ error: "A hotelId is required." }, { status: 400 });
  }

  const person = (guest ?? {}) as Partial<Guest>;
  const traveller: Guest = {
    firstName: person.firstName || "Veteran",
    lastName: person.lastName || "Guest",
    phone: person.phone || "+15555555555",
    email: person.email || "guest@example.com",
  };

  // Pick the first available offer for tonight. With Amadeus unconfigured
  // there are none, and bookOffer returns a clearly-marked sample booking.
  const offers = await findOffers([hotelId]);
  const offer = offers[0];

  const result = await bookOffer(offer?.offerId ?? `hold-${hotelId}`, traveller);

  if (!result.booked) {
    return NextResponse.json({ booked: false, reason: result.reason }, { status: 200 });
  }

  return NextResponse.json({
    booked: true,
    confirmationNumber: result.confirmationNumber,
    sample: result.sample === true,
    checkInDate: offer?.checkInDate,
    checkOutDate: offer?.checkOutDate,
    price: offer?.price,
  });
}
