"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Screen, ScreenHeader } from "@/components/screen";
import { ChipGroup } from "@/components/chips";
import { Check, Home as HomeIcon } from "@/components/icons";
import { useAccount } from "@/lib/use-account";
import { CUISINES, DIETARY_RESTRICTIONS } from "@/lib/meal-options";
import { nextPhoneValue, phoneDigits } from "@/lib/phone";

type Coords = { latitude: number; longitude: number };

/** Meal flow, step B — Request a meal delivery. Prefills from the profile. */
export default function Page() {
  const router = useRouter();
  const { account } = useAccount();

  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Allergies and preferences stay tucked away until the veteran opts in, so
  // the common request is short.
  const [hasDietary, setHasDietary] = useState(false);
  const [diets, setDiets] = useState<string[]>([]);
  const [cuisine, setCuisine] = useState("");

  const [phone, setPhone] = useState("");
  const [instructions, setInstructions] = useState("");

  // Seed the fields we already know once, then leave edits alone. When the
  // profile carries allergies or preferences, open that section so the
  // prefill is visible rather than hidden behind an unchecked box.
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (seeded || !account) return;
    if (account.homeAddress) setAddress(account.homeAddress);
    if (account.phone) setPhone(account.phone);
    if (account.dietaryRestrictions?.length) setDiets(account.dietaryRestrictions);
    if (account.cuisinePreference) setCuisine(account.cuisinePreference);
    if (account.allergies?.length || account.dietaryRestrictions?.length || account.cuisinePreference) {
      setHasDietary(true);
    }
    setSeeded(true);
  }, [account, seeded]);

  const usingHome =
    !coords && address !== "" && address === account?.homeAddress;

  function chooseHome() {
    setGeoError(null);
    setCoords(null);
    setAddress(account?.homeAddress ?? "");
  }

  /** Asks the browser where the veteran is, mirroring the shelter screen. */
  function useCurrentLocation() {
    if (!("geolocation" in navigator)) {
      setGeoError("This device cannot share a location. Type an address instead.");
      return;
    }
    if (!window.isSecureContext) {
      setGeoError("Location needs a secure (https) connection. Type an address instead.");
      return;
    }

    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setAddress("");
        setLocating(false);
      },
      (failure) => {
        setGeoError(
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

  function toggleDiet(option: string) {
    setDiets((current) =>
      current.includes(option)
        ? current.filter((value) => value !== option)
        : [...current, option],
    );
  }

  // Address and a complete phone number are both required. Errors surface once
  // a field has been touched, so the prefilled defaults never nag on load.
  const [addressTouched, setAddressTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const hasAddress = coords !== null || address.trim() !== "";
  const hasPhone = phoneDigits(phone).length === 10;
  const canSubmit = hasAddress && hasPhone;
  const addressError = addressTouched && !hasAddress;
  const phoneError = phoneTouched && !hasPhone;

  function submit() {
    const deliveryAddress = coords ? "Current location" : address.trim();

    const params = new URLSearchParams();
    params.set("address", deliveryAddress);
    if (hasDietary) {
      if (diets.length) params.set("diet", diets.join(","));
      if (cuisine) params.set("cuisine", cuisine);
      if (account?.allergies?.length) params.set("allergies", account.allergies.join(", "));
    }
    if (phone.trim()) params.set("phone", phone.trim());
    if (instructions.trim()) params.set("instructions", instructions.trim());

    router.push(`/confirmation/meal?${params}`);
  }

  return (
    <Screen>
      <ScreenHeader back="/home" />

      <h2 style={{ margin: 0 }}>Request a meal delivery</h2>

      <div className="big-field">
        <label>Delivery address</label>

        <div className="addr-opts">
          <button
            type="button"
            className={coords ? "addr-opt addr-opt-on" : "addr-opt"}
            disabled={locating}
            onClick={useCurrentLocation}
            aria-pressed={coords !== null}
          >
            {locating ? "Finding you…" : "Current location"}
          </button>
          <button
            type="button"
            className={usingHome ? "addr-opt addr-opt-on" : "addr-opt"}
            onClick={chooseHome}
            aria-pressed={usingHome}
          >
            <HomeIcon size={18} />
            Home of record
          </button>
        </div>

        {coords ? (
          <div
            className="card elev-sm"
            style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 }}
          >
            <Check size={20} color="var(--color-accent-2-700)" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16 }}>Using your current location</div>
              <div className="text-muted" style={{ fontSize: 13 }}>
                {coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)}
              </div>
            </div>
            <button className="btn btn-ghost" type="button" onClick={() => setCoords(null)}>
              Change
            </button>
          </div>
        ) : (
          <input
            id="address"
            className="big-input"
            value={address}
            onChange={(event) => {
              setAddress(event.target.value);
              setAddressTouched(true);
              setGeoError(null);
            }}
            onBlur={() => setAddressTouched(true)}
            placeholder="Or enter a delivery address"
            aria-invalid={addressError}
            style={{ marginTop: 12, ...(addressError ? { borderColor: "var(--color-danger)" } : {}) }}
          />
        )}

        {geoError ? (
          <p style={{ fontSize: 14, color: "var(--color-accent-700)", margin: "8px 0 0" }}>
            {geoError}
          </p>
        ) : addressError ? (
          <p style={{ fontSize: 14, color: "var(--color-danger)", margin: "8px 0 0" }}>
            Enter a delivery address so we know where to send the meal.
          </p>
        ) : null}
      </div>

      <label className="big-check" style={{ alignItems: "center" }}>
        <input
          type="checkbox"
          checked={hasDietary}
          onChange={(event) => setHasDietary(event.target.checked)}
        />
        <span className="check-box">
          <Check size={16} />
        </span>
        <span style={{ fontSize: 20, fontWeight: 700 }}>I have allergies or dietary needs</span>
      </label>

      {hasDietary ? (
        <>
          {account?.allergies?.length ? (
            <div className="card" style={{ background: "var(--color-accent-100)", gap: 2 }}>
              <span
                style={{
                  fontFamily: "var(--font-heading)",
                  color: "var(--color-accent-700)",
                  fontSize: 18,
                }}
              >
                Allergies on file
              </span>
              <span style={{ fontSize: 16 }}>{account.allergies.join(", ")}</span>
            </div>
          ) : null}

          <div className="big-field">
            <label>Dietary restrictions</label>
            <ChipGroup
              options={DIETARY_RESTRICTIONS}
              isSelected={(option) => diets.includes(option)}
              onToggle={toggleDiet}
            />
          </div>

          <div className="big-field">
            <label>Preferred cuisine</label>
            <ChipGroup
              options={CUISINES}
              isSelected={(option) => cuisine === option}
              onToggle={(option) => setCuisine((current) => (current === option ? "" : option))}
            />
            <p className="text-muted" style={{ fontSize: 13, margin: "10px 0 0" }}>
              Your preferred cuisine is not guaranteed, but we prioritize it when matching a kitchen.
            </p>
          </div>
        </>
      ) : null}

      <div className="big-field">
        <label htmlFor="phone">Delivery phone number</label>
        <input
          id="phone"
          className="big-input"
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(event) => {
            setPhone(nextPhoneValue(event.target.value, phone));
            setPhoneTouched(true);
          }}
          onBlur={() => setPhoneTouched(true)}
          placeholder="555-555-5555"
          aria-invalid={phoneError}
          style={phoneError ? { borderColor: "var(--color-danger)" } : undefined}
        />
        {phoneError ? (
          <p style={{ fontSize: 14, color: "var(--color-danger)", margin: "8px 0 0" }}>
            {phone.trim() === ""
              ? "Enter a phone number so the driver can reach you."
              : "Enter a complete 10-digit phone number."}
          </p>
        ) : null}
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

      <div className="grow" />

      <button
        className="big-btn big-btn-primary"
        type="button"
        disabled={!canSubmit}
        onClick={submit}
      >
        Request Meal
      </button>
    </Screen>
  );
}
