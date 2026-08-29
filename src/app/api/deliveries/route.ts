import { NextResponse } from "next/server";
import { createDelivery, getUberConfig } from "@/lib/uber";

/**
 * Creates an Uber Direct delivery for a meal request.
 *
 * The browser posts here rather than to Uber, so the client secret stays on
 * the server. Without credentials the route reports `configured: false` and
 * the caller falls back to the mock confirmation.
 */
export async function POST(request: Request) {
  const config = getUberConfig();
  if (!config) {
    return NextResponse.json(
      { configured: false, reason: "Uber Direct credentials are not set." },
      { status: 503 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { address, name, phone, note } = (payload ?? {}) as Record<string, unknown>;
  if (typeof address !== "string" || address.trim() === "") {
    return NextResponse.json({ error: "A delivery address is required." }, { status: 400 });
  }

  try {
    const delivery = await createDelivery(config, {
      dropoffAddress: address,
      dropoffName: typeof name === "string" && name ? name : "Veteran",
      dropoffPhone: typeof phone === "string" ? phone : "",
      note: typeof note === "string" ? note : undefined,
    });

    // `status` is Uber's own recorded state — surface it rather than inventing
    // a friendlier one (MVP_REFERENCE.md §7.2).
    return NextResponse.json({ configured: true, sandbox: config.sandbox, ...delivery });
  } catch (error) {
    console.error("Uber Direct delivery failed", error);
    return NextResponse.json({ error: "Could not create the delivery." }, { status: 502 });
  }
}
