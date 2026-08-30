import "server-only";

/**
 * Uber Vouchers — funds a meal without placing the order.
 *
 * No public API lets a third party order food on someone's behalf. A voucher
 * inverts the problem: the organisation funds a capped credit, and the veteran
 * redeems it in Uber Eats and chooses their own meal. That also means the
 * allergen judgement stays with the person who has the allergy.
 *
 * Server-only. Requires the organizations.voucher_programs scope, which is not
 * self-serve — until it is granted, this issues clearly-marked sample codes.
 *
 * Docs: https://developer.uber.com/docs/vouchers/introduction
 */

const TOKEN_URL = "https://auth.uber.com/oauth/v2/token";
const SCOPE = "organizations.voucher_programs";

const PROD_BASE = "https://api.uber.com";
const SANDBOX_BASE = "https://sandbox-api.uber.com";

/** What one meal is worth, before delivery. */
export const MEAL_VALUE_USD = 20;

/** How long a veteran has to redeem before the credit lapses. */
const VALID_FOR_DAYS = 7;

export type VoucherConfig = {
  clientId: string;
  clientSecret: string;
  organizationId: string;
  creatorEmail: string;
  sandbox: boolean;
};

export function getVoucherConfig(): VoucherConfig | null {
  const clientId = process.env.UBER_VOUCHERS_CLIENT_ID;
  const clientSecret = process.env.UBER_VOUCHERS_CLIENT_SECRET;
  const organizationId = process.env.UBER_ORG_ID;
  if (!clientId || !clientSecret || !organizationId) return null;

  return {
    clientId,
    clientSecret,
    organizationId,
    creatorEmail: process.env.UBER_VOUCHERS_CREATOR_EMAIL ?? "",
    sandbox: process.env.UBER_ENV !== "production",
  };
}

function baseUrl(config: VoucherConfig): string {
  return config.sandbox ? SANDBOX_BASE : PROD_BASE;
}

type CachedToken = { value: string; expiresAt: number };
let cached: CachedToken | null = null;

async function getAccessToken(config: VoucherConfig): Promise<string> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "client_credentials",
      scope: SCOPE,
    }),
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`Uber token request failed: ${response.status}`);

  const body = (await response.json()) as { access_token: string; expires_in: number };
  cached = { value: body.access_token, expiresAt: Date.now() + (body.expires_in - 60) * 1000 };
  return cached.value;
}

export type MealVoucher = {
  voucherProgramId: string;
  /** The code the veteran redeems in Uber Eats. */
  code: string;
  /** Deep link that applies the code for them. */
  link?: string;
  valueUsd: number;
  expiresAt: string;
  /** True when this came from the local stand-in, not from Uber. */
  sample: boolean;
};

/** Sample codes are visibly not real, so no surface can imply funded credit. */
function sampleVoucher(): MealVoucher {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return {
    voucherProgramId: `sample-${suffix}`,
    code: `SAMPLE-MEAL-${suffix}`,
    valueUsd: MEAL_VALUE_USD,
    expiresAt: new Date(Date.now() + VALID_FOR_DAYS * 86400000).toISOString(),
    sample: true,
  };
}

/**
 * Issues a single-redeem Eats voucher capped at the meal value.
 *
 * The cap is per order and excludes nothing on Uber's side — delivery and fees
 * count against a rider's own payment method beyond the covered amount, so the
 * surface must not promise the whole basket is paid for.
 */
export async function issueMealVoucher(veteranName: string): Promise<MealVoucher> {
  const config = getVoucherConfig();
  if (!config) return sampleVoucher();

  const startsAt = Date.now();
  const endsAt = startsAt + VALID_FOR_DAYS * 86400000;

  try {
    const token = await getAccessToken(config);

    const response = await fetch(
      `${baseUrl(config)}/v1/organizations/${config.organizationId}/voucher-programs`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `SUAS meal — ${veteranName}`,
          currency_code: "USD",
          starts_at: startsAt,
          ends_at: endsAt,
          creator_email: config.creatorEmail,
          // One code, redeemed once, for this request.
          code_scheme: "MULTI_CODE_SINGLE_REDEEM",
          number_of_codes: 1,
          redemptions_per_code: 1,
          voucher_type: "EATS",
          value_recurrence_period: "SINGLE",
          value_per_trip_max_amount: MEAL_VALUE_USD,
        }),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error(`Voucher creation failed: ${response.status} ${await response.text()}`);
    }

    const body = (await response.json()) as {
      voucher_program_id: string;
      code_text?: string;
      code_link?: string;
    };

    return {
      voucherProgramId: body.voucher_program_id,
      code: body.code_text ?? "",
      link: body.code_link || undefined,
      valueUsd: MEAL_VALUE_USD,
      expiresAt: new Date(endsAt).toISOString(),
      sample: false,
    };
  } catch (error) {
    console.error("Uber voucher failed", error);
    throw error;
  }
}
