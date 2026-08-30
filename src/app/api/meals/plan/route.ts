import { NextResponse } from "next/server";
import { geocode } from "@/lib/geocode";
import { findNearestOpen } from "@/lib/yelp";
import { chooseMeal } from "@/lib/meal-menu";
import { issueMealVoucher, MEAL_VALUE_USD } from "@/lib/uber-vouchers";

/**
 * Plans a meal for a veteran: nearest open affordable kitchen, and a standing
 * template that carries none of their allergens.
 *
 * Nothing here is browsed or chosen by the veteran — a request is one tap. The
 * order itself is still placed by a person; no public API allows otherwise, so
 * this reports a plan rather than claiming food is on its way.
 */
export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { address, allergies, name } = (payload ?? {}) as Record<string, unknown>;
  if (typeof address !== "string" || address.trim() === "") {
    return NextResponse.json({ error: "A delivery address is required." }, { status: 400 });
  }

  const avoid = Array.isArray(allergies) ? allergies.filter((a): a is string => typeof a === "string") : [];

  // Every template is built to clear the big 9, so this only fails if the list
  // is later widened. Route to a person rather than sending something unsafe.
  const meal = chooseMeal(avoid);
  if (!meal) {
    return NextResponse.json({
      planned: false,
      reason: "No standard meal clears your allergies. A caseworker will arrange this.",
    });
  }

  const point = await geocode(address);
  if (!point) {
    return NextResponse.json(
      { error: "Could not resolve that address.", field: "address" },
      { status: 400 },
    );
  }

  const { configured, restaurant } = await findNearestOpen(point.latitude, point.longitude);
  if (!restaurant) {
    return NextResponse.json({
      planned: false,
      reason: "Nothing suitable is open nearby right now. A caseworker will arrange this.",
    });
  }

  // The credit funds the meal; it does not order it.
  let voucher = null;
  try {
    voucher = await issueMealVoucher(typeof name === "string" ? name : "Veteran");
  } catch {
    // A funding failure must not lose the plan — the meal can still be placed.
  }

  return NextResponse.json({
    planned: true,
    liveSearch: configured,
    restaurant,
    meal,
    valueUsd: MEAL_VALUE_USD,
    voucher,
  });
}
