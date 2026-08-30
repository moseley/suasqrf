"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Screen, ScreenHeader } from "@/components/screen";
import { useAccount } from "@/lib/use-account";
import { CUISINES, DIETARY_RESTRICTIONS } from "@/lib/meal-options";

type When = "asap" | "schedule";

/**
 * Meal flow, step B — Request a meal delivery (PRD-001).
 *
 * Captures the fields an operator needs to dispatch a real meal: when, dietary
 * restrictions, cuisine, delivery instructions, and a delivery phone. Every
 * field but the address is optional, and everything we already know from the
 * profile (PRD-002) is prefilled once, so the common case is one tap.
 */
export default function Page() {
  const router = useRouter();
  const { account } = useAccount();

  const [address, setAddress] = useState("");
  const [when, setWhen] = useState<When>("asap");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [diet, setDiet] = useState<string[]>([]);
  const [cuisine, setCuisine] = useState("");
  const [phone, setPhone] = useState("");
  const [instructions, setInstructions] = useState("");

  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allergies = account?.allergies ?? "";

  // Seed once from the saved profile, leaving later edits alone. The guard runs
  // per mount and never overwrites a field the veteran has since changed.
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (seeded || !account) return;
    if (account.homeAddress) setAddress(account.homeAddress);
    if (account.phone) setPhone(account.phone);
    if (account.dietaryRestrictions?.length) setDiet(account.dietaryRestrictions);
    if (account.cuisinePreference) setCuisine(account.cuisinePreference);
    setSeeded(true);
  }, [account, seeded]);

  function toggleDiet(option: string) {
    setDiet((current) =>
      current.includes(option)
        ? current.filter((value) => value !== option)
        : [...current, option],
    );
  }

  /** Fills the delivery address from the veteran's Home of Record. */
  function useHomeOfRecord() {
    if (account?.homeAddress) {
      setAddress(account.homeAddress);
      setError(null);
    }
  }

  /**
   * Drops a pin at the veteran's current location. Delivery apps accept a pin,
   * so the coordinates go straight into the address as text; no maps key needed.
   */
  function useCurrentLocation() {
    if (!("geolocation" in navigator)) {
      setError("This device cannot share a location. Type an address instead.");
      return;
    }
    // Geolocation is refused outright off HTTPS with a bare permission error
    // that would otherwise look like the veteran declined.
    if (!window.isSecureContext) {
      setError("Location needs a secure (https) connection. Type an address instead.");
      return;
    }

    setLocating(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setAddress(`Current location — ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        setLocating(false);
      },
      (failure) => {
        setError(
          failure.code === failure.PERMISSION_DENIED
            ? "Location is blocked for this site. Allow it in your browser settings, or type an address."
            : failure.code === failure.TIMEOUT
              ? "Finding your location took too long. Try again, or type an address."
              : "Your location is unavailable right now. Type an address instead.",
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }

  function submit() {
    // "when" is ASAP unless both a date and time are set, then their ISO join.
    const whenValue = when === "schedule" && date && time ? `${date}T${time}` : "ASAP";

    const params = new URLSearchParams();
    params.set("address", address);
    params.set("when", whenValue);
    if (diet.length) params.set("diet", diet.join(","));
    if (cuisine) params.set("cuisine", cuisine);
    if (phone.trim()) params.set("phone", phone.trim());
    if (instructions.trim()) params.set("instructions", instructions.trim());
    if (allergies) params.set("allergies", allergies);

    router.push(`/confirmation/meal?${params}`);
  }

  return (
    <Screen>
      <ScreenHeader back="/home" />

      <h2 style={{ margin: 0 }}>Request a meal delivery</h2>

      <div className="big-field">
        <label htmlFor="address">Delivery address</label>
        <input
          id="address"
          className="big-input"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          placeholder="Street address"
        />
        <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
          <button
            className="btn btn-ghost"
            type="button"
            style={{ fontSize: 15 }}
            disabled={!account?.homeAddress}
            onClick={useHomeOfRecord}
          >
            Veteran&rsquo;s HOR (Home of Record)
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            style={{ fontSize: 15 }}
            disabled={locating}
            onClick={useCurrentLocation}
          >
            {locating ? "Finding you…" : "Use current location"}
          </button>
        </div>
      </div>

      <div className="big-field">
        <label>When should it arrive?</label>
        <div className="seg" role="group" aria-label="When should it arrive?">
          <label className="seg-opt">
            <input
              type="radio"
              name="when"
              checked={when === "asap"}
              onChange={() => setWhen("asap")}
            />
            As soon as possible
          </label>
          <label className="seg-opt">
            <input
              type="radio"
              name="when"
              checked={when === "schedule"}
              onChange={() => setWhen("schedule")}
            />
            Schedule
          </label>
        </div>

        {when === "schedule" ? (
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <input
              className="big-input"
              type="date"
              aria-label="Delivery date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
            <input
              className="big-input"
              type="time"
              aria-label="Delivery time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
            />
          </div>
        ) : null}
      </div>

      {allergies ? (
        <div className="note-card">
          <div className="note-title">Allergies on file</div>
          <div>{allergies}</div>
        </div>
      ) : null}

      <div className="big-field">
        <label>Dietary restrictions</label>
        <div className="chip-group">
          {DIETARY_RESTRICTIONS.map((option) => (
            <button
              key={option}
              type="button"
              className="chip"
              aria-pressed={diet.includes(option)}
              onClick={() => toggleDiet(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="big-field">
        <label>Preferred cuisine</label>
        <div className="chip-group">
          {CUISINES.map((option) => (
            <button
              key={option}
              type="button"
              className="chip"
              aria-pressed={cuisine === option}
              onClick={() => setCuisine((current) => (current === option ? "" : option))}
            >
              {option}
            </button>
          ))}
        </div>
        <p className="text-muted" style={{ fontSize: 13, margin: "8px 0 0" }}>
          Your preferred cuisine is not guaranteed, but we prioritize it when matching a kitchen.
        </p>
      </div>

      <div className="big-field">
        <label htmlFor="phone">Delivery phone number</label>
        <input
          id="phone"
          className="big-input"
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="(555) 555-5555"
        />
      </div>

      <div className="big-field">
        <label htmlFor="instructions">Delivery instructions</label>
        <textarea
          id="instructions"
          className="big-input"
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
          placeholder="Gate code, building or door, where to leave the food"
        />
      </div>

      {error ? (
        <p style={{ fontSize: 14, color: "var(--color-accent-700)", margin: 0 }}>{error}</p>
      ) : null}

      <div className="grow" />

      <button
        className="big-btn big-btn-primary"
        type="button"
        disabled={address.trim() === ""}
        onClick={submit}
      >
        Request Meal
      </button>
    </Screen>
  );
}
