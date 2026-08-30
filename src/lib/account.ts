/**
 * Mock accounts. There is no backend — signing in with the demo phone number
 * loads a fixture, and the "session" is a localStorage entry on the device.
 */

export type Account = {
  name: string;
  email?: string;
  phone?: string;
  /** Prefills the ride pickup and meal delivery fields. */
  homeAddress?: string;
  // --- Profile fields (PRD-002). All optional, so an account written by the
  // sign-in code alone stays valid and loads without migration. ---
  /** Free text, e.g. "Peanuts, shellfish". Shown read-only on the meal request. */
  allergies?: string;
  /** e.g. ["Diabetic-friendly", "Halal"]. Prefills the meal dietary chips. */
  dietaryRestrictions?: string[];
  /** e.g. "Mediterranean". Prefills the meal cuisine chooser. */
  cuisinePreference?: string;
  /** Always false in this phase — the VA connector is a placeholder. */
  vaConnected?: boolean;
  isMock: boolean;
};

/** The one number that unlocks the demo account. */
export const MOCK_PHONE = "555-555-5555";

export const MOCK_ACCOUNT: Account = {
  name: "Marcus Reyes",
  email: "m.reyes@example.com",
  phone: MOCK_PHONE,
  homeAddress: "855 Maude Ave, Mountain View, CA 94043",
  allergies: "Peanuts, shellfish",
  dietaryRestrictions: ["Diabetic-friendly"],
  cuisinePreference: "Mediterranean",
  vaConnected: false,
  isMock: true,
};

/** Digits only, so (555) 555-5555 and 5555555555 both match. */
export function isMockPhone(value: string): boolean {
  return value.replace(/\D/g, "") === MOCK_PHONE.replace(/\D/g, "");
}

const KEY = "suasqrf.account";

export function saveAccount(account: Account): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(account));
  } catch {
    // Private browsing or blocked site data — the app still works, unpersonalised.
  }
}

export function loadAccount(): Account | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const candidate = parsed as Partial<Account>;
    return typeof candidate.name === "string" ? (candidate as Account) : null;
  } catch {
    return null;
  }
}

export function clearAccount(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
}
