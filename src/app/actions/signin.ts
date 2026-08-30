"use server";

import {
  getSuasConfig,
  issueChallenge,
  verifyChallenge,
  writeSession,
  clearSession,
  ApiError,
  type ChallengeMethod,
} from "@/lib/suas-api";

/**
 * Sign-in against the SUAS API.
 *
 * These run on the server so the session credential never reaches client
 * JavaScript. With the API unconfigured they report `configured: false` and the
 * caller falls back to the local mock sign-in.
 */

export type RequestResult =
  | { ok: true; configured: true; message: string }
  | { ok: true; configured: false }
  | { ok: false; error: string };

export type VerifyResult = { ok: true } | { ok: false; error: string };

function methodFor(channel: "email" | "phone"): ChallengeMethod {
  return channel === "phone" ? "PHONE_OTP" : "EMAIL_OTP";
}

export async function requestCode(
  destination: string,
  channel: "email" | "phone",
): Promise<RequestResult> {
  const config = getSuasConfig();
  if (!config) return { ok: true, configured: false };

  if (destination.trim() === "") {
    return { ok: false, error: "Enter an email address or phone number." };
  }

  try {
    await issueChallenge(config, { destination: destination.trim(), method: methodFor(channel) });
  } catch (error) {
    // A 503 means the channel itself is unavailable, which is a different fact
    // from "destination not enrolled" and does surface (AUTH.md §5).
    const message =
      error instanceof ApiError && error.status === 503
        ? "That delivery channel is unavailable right now. Try another method."
        : "Could not send a code. Try again.";
    return { ok: false, error: message };
  }

  // Uniform on purpose: this must not reveal whether the destination exists.
  return {
    ok: true,
    configured: true,
    message: "If that destination is enrolled, a code is on its way.",
  };
}

export async function verifyCode(destination: string, code: string): Promise<VerifyResult> {
  const config = getSuasConfig();
  if (!config) return { ok: false, error: "Sign-in is not configured." };

  if (code.trim() === "") return { ok: false, error: "Enter the code you received." };

  try {
    const session = await verifyChallenge(config, {
      destination: destination.trim(),
      code: code.trim(),
    });
    await writeSession(session.session_credential, new Date(session.expires_at));
  } catch {
    return { ok: false, error: "That code is not valid." };
  }

  return { ok: true };
}

export async function signOut(): Promise<void> {
  await clearSession();
}
