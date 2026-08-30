import { NextResponse } from "next/server";
import { reverseGeocode } from "@/lib/geocode";

/**
 * Turns a device fix into a readable address.
 *
 * Kept server-side so the browser never calls a geocoder directly and no key
 * would ever be needed in the client.
 */
export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { latitude, longitude } = (payload ?? {}) as Record<string, unknown>;
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return NextResponse.json({ error: "latitude and longitude are required." }, { status: 400 });
  }

  const address = await reverseGeocode(latitude, longitude);
  return NextResponse.json({ address });
}
