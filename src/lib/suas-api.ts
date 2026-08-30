import "server-only";

import { cookies } from "next/headers";

/**
 * Client for the SUAS API (`scrimshawlife-ctrl/suas`), `/api/v0`.
 *
 * Server-only. The session credential lives in an httpOnly cookie and is never
 * serialised into a Client Component payload — AUTH.md §2-§5 and API.md §4.
 *
 * With SUAS_API_BASE_URL unset the app falls back to its local mock sign-in,
 * so the demo keeps working without a running API.
 */

const COOKIE = "suas_session";

export type ChallengeMethod = "MAGIC_LINK" | "EMAIL_OTP" | "PHONE_OTP";

export type SuasConfig = {
  apiBaseUrl: string;
  /** Pre-authentication tenant scope; the API has no session to derive it from. */
  tenantId: string;
};

export function getSuasConfig(): SuasConfig | null {
  const apiBaseUrl = process.env.SUAS_API_BASE_URL?.replace(/\/+$/, "");
  const tenantId = process.env.SUAS_TENANT_ID;
  if (!apiBaseUrl || !tenantId) return null;
  return { apiBaseUrl, tenantId };
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  /** Auth endpoints are the documented pre-session exception (API.md §4). */
  anonymous?: boolean;
};

async function apiRequest<T>(
  config: SuasConfig,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { accept: "application/json" };

  if (options.anonymous !== true) {
    const credential = await readSession();
    if (!credential) throw new ApiError(401, "UNAUTHENTICATED", "No session credential.");
    headers.authorization = `Bearer ${credential}`;
  }
  if (options.body !== undefined) headers["content-type"] = "application/json";

  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    // Coordination state is never stale-served.
    cache: "no-store",
  });

  if (!response.ok) {
    let code = "UNKNOWN";
    let message = `Request failed: ${response.status}`;
    try {
      const body = (await response.json()) as { error?: { code?: string; message?: string } };
      code = body.error?.code ?? code;
      message = body.error?.message ?? message;
    } catch {
      // Non-JSON error body; the status is all we have.
    }
    throw new ApiError(response.status, code, message);
  }

  return (await response.json()) as T;
}

/**
 * Sends a one-time code. The 202 is deliberately uniform so this cannot
 * enumerate veterans — never turn a failure here into "no such account".
 */
export async function issueChallenge(
  config: SuasConfig,
  input: { destination: string; method: ChallengeMethod },
): Promise<void> {
  await apiRequest(config, "/api/v0/auth/challenges", {
    method: "POST",
    anonymous: true,
    body: { tenant_id: config.tenantId, destination: input.destination, method: input.method },
  });
}

export type VerifiedSession = {
  session_credential: string;
  expires_at: string;
};

export async function verifyChallenge(
  config: SuasConfig,
  input: { destination: string; code: string },
): Promise<VerifiedSession> {
  return apiRequest<VerifiedSession>(config, "/api/v0/auth/challenges/commands/verify", {
    method: "POST",
    anonymous: true,
    body: { tenant_id: config.tenantId, destination: input.destination, code: input.code },
  });
}

export async function readSession(): Promise<string | undefined> {
  return (await cookies()).get(COOKIE)?.value;
}

export async function writeSession(credential: string, expiresAt: Date): Promise<void> {
  (await cookies()).set(COOKIE, credential, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
