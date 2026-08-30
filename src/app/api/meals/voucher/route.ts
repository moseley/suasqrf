import { NextResponse } from "next/server";
import { issueMealVoucher } from "@/lib/uber-vouchers";

/**
 * Issues a capped Uber Eats voucher for a meal request.
 *
 * The order itself is never placed here — no public API allows that. The
 * veteran redeems the code and chooses their own meal.
 */
export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { name } = (payload ?? {}) as Record<string, unknown>;
  const veteranName = typeof name === "string" && name.trim() ? name.trim() : "Veteran";

  try {
    const voucher = await issueMealVoucher(veteranName);
    return NextResponse.json({ issued: true, ...voucher });
  } catch (error) {
    console.error("Meal voucher failed", error);
    // Say so plainly: an unissued voucher must not look like funded credit.
    return NextResponse.json(
      { issued: false, reason: "Could not issue a meal credit. A caseworker can still help." },
      { status: 502 },
    );
  }
}
