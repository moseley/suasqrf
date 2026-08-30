import { NextResponse } from "next/server";
import { geocode, searchNear } from "@/lib/geocode";

/**
 * Type-ahead for a destination, nearest to the pickup first.
 *
 * The origin may be given as coordinates or as the pickup address, so the
 * caller does not have to geocode before it can search.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = params.get("q") ?? "";
  if (query.trim().length < 3) return NextResponse.json({ places: [] });

  // Number(null) is 0, which is a real coordinate in the Atlantic — check the
  // parameters are present before trusting them.
  const rawLat = params.get("lat");
  const rawLng = params.get("lng");
  const lat = rawLat === null ? Number.NaN : Number(rawLat);
  const lng = rawLng === null ? Number.NaN : Number(rawLng);

  let origin =
    Number.isFinite(lat) && Number.isFinite(lng)
      ? { latitude: lat, longitude: lng, address: "" }
      : null;

  if (!origin) {
    const near = params.get("near");
    if (near) origin = await geocode(near);
  }

  // Without somewhere to measure from, "closest" is meaningless.
  if (!origin) return NextResponse.json({ places: [] });

  return NextResponse.json({ places: await searchNear(query, origin) });
}
