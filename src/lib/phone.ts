/**
 * US phone formatting for input fields.
 *
 * Formatting is derived from the digits alone, so the punctuation can never
 * drift out of step with what was typed.
 */

/** Digits only, capped at a 10-digit US number. */
export function phoneDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 10);
}

/** `(555) 555-5555`, revealing punctuation as enough digits arrive. */
export function formatUsPhone(value: string): string {
  const digits = phoneDigits(value);
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * Formats the next value, given what was there before.
 *
 * Backspacing over punctuation would otherwise delete a character that is
 * immediately re-added, leaving the caret stuck; when the digits have not
 * changed but the text got shorter, drop the last digit instead.
 */
export function nextPhoneValue(next: string, previous: string): string {
  const nextDigits = phoneDigits(next);
  const previousDigits = phoneDigits(previous);

  if (next.length < previous.length && nextDigits === previousDigits) {
    return formatUsPhone(nextDigits.slice(0, -1));
  }
  return formatUsPhone(next);
}

/** E.164 for the API. Returns the input unchanged if it is not 10 digits. */
export function toE164(value: string): string {
  const digits = phoneDigits(value);
  return digits.length === 10 ? `+1${digits}` : value.trim();
}
