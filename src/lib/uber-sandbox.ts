import "server-only";

import { getAccessToken, getRidesConfig, type RidesConfig } from "./uber-rides";

/**
 * Guest Rides sandbox controls. A "run" spins up mock riders and drivers that
 * live for 8 hours; driver state is then advanced by hand, which is what makes
 * the real trip states testable end to end.
 *
 * Docs: https://developer.uber.com/docs/guest-rides/guides/sandbox
 */

const SANDBOX_BASE = "https://sandbox-api.uber.com";

export type DriverState = "ACCEPT" | "ARRIVED" | "BEGIN_TRIP" | "DROPOFF" | "CANCEL";

function assertSandbox(config: RidesConfig): void {
  if (!config.sandbox) {
    throw new Error("Sandbox controls are not available against production.");
  }
}

/**
 * Creates a run. Responses can take up to a minute. Save the returned id as
 * UBER_RIDES_SANDBOX_RUN_ID so trip requests attach to these mock drivers.
 */
export async function createRun(
  config: RidesConfig,
  options: {
    pickup: { latitude: number; longitude: number };
    dropoff: { latitude: number; longitude: number };
    parentProductTypeId: string;
    driverCount?: number;
  },
): Promise<{ runId: string }> {
  assertSandbox(config);
  const token = await getAccessToken(config);

  const response = await fetch(`${SANDBOX_BASE}/v1/guests/sandbox/run`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      // One empty object per mock driver wanted.
      driver_locations: Array.from({ length: options.driverCount ?? 1 }, () => ({})),
      pickup_location: options.pickup,
      dropoff_location: options.dropoff,
      parent_product_type_id: options.parentProductTypeId,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    // A 401 here usually means the app is not yet whitelisted for the sandbox.
    throw new Error(`Sandbox run failed: ${response.status} ${await response.text()}`);
  }

  const body = (await response.json()) as { run_id?: string; runUUID?: string };
  const runId = body.run_id ?? body.runUUID;
  if (!runId) throw new Error("Sandbox run returned no id.");
  return { runId };
}

/** Lists the mock driver ids created by a run. */
export async function getRun(config: RidesConfig, runId: string): Promise<unknown> {
  assertSandbox(config);
  const token = await getAccessToken(config);

  const response = await fetch(`${SANDBOX_BASE}/v1/guests/sandbox/run/${runId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`Sandbox run lookup failed: ${response.status}`);
  return response.json();
}

/**
 * Advances a mock driver. The happy path is
 * ACCEPT → ARRIVED → BEGIN_TRIP → DROPOFF; CANCEL is valid after ACCEPT or
 * ARRIVED.
 */
export async function setDriverState(
  config: RidesConfig,
  options: { driverId: string; state: DriverState },
): Promise<void> {
  assertSandbox(config);
  const token = await getAccessToken(config);

  const response = await fetch(`${SANDBOX_BASE}/v1/guests/sandbox/driver-state`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ driver_id: options.driverId, state: options.state }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Driver state change failed: ${response.status} ${await response.text()}`);
  }
}

/** Convenience for scripts: config or a clear error. */
export function requireRidesConfig(): RidesConfig {
  const config = getRidesConfig();
  if (!config) {
    throw new Error("UBER_RIDES_CLIENT_ID and UBER_RIDES_CLIENT_SECRET are not set.");
  }
  return config;
}
