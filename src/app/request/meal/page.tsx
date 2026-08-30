"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Screen, ScreenHeader } from "@/components/screen";
import { ChipGroup } from "@/components/chips";
import { Check } from "@/components/icons";
import { useAccount } from "@/lib/use-account";
import { ALLERGENS } from "@/lib/meal-options";
import { nextPhoneValue, phoneDigits } from "@/lib/phone";


/** Meal flow, step B — Request a meal delivery. Prefills from the profile. */
export default function Page() {
  const router = useRouter();
  const { account } = useAccount();

  const [address, setAddress] = useState("");

  // Allergies stay tucked away until the veteran opts in, so the common
  // request is short.
  const [hasDietary, setHasDietary] = useState(false);
  const [allergies, setAllergies] = useState<string[]>([]);

  const [phone, setPhone] = useState("");
  const [instructions, setInstructions] = useState("");

  // Seed the fields we already know once, then leave edits alone. When the
  // profile carries allergies, open that section so the prefill is visible
  // rather than hidden behind an unchecked box.
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (seeded || !account) return;
    if (account.homeAddress) setAddress(account.homeAddress);
    if (account.phone) setPhone(account.phone);
    if (account.allergies?.length) {
      setAllergies(account.allergies);
      setHasDietary(true);
    }
    setSeeded(true);
  }, [account, seeded]);

  function toggleAllergy(option: string) {
    setAllergies((current) =>
      current.includes(option)
        ? current.filter((value) => value !== option)
        : [...current, option],
    );
  }

  // Anything stored on the profile that is not a known allergen still needs a
  // chip, or a veteran would silently lose it from this request.
  const allergenOptions = [
    ...ALLERGENS,
    ...allergies.filter((entry) => !(ALLERGENS as readonly string[]).includes(entry)),
  ];

  // Address and a complete phone number are both required. Errors surface once
  // a field has been touched, so the prefilled defaults never nag on load.
  const [addressTouched, setAddressTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const hasAddress = address.trim() !== "";
  const hasPhone = phoneDigits(phone).length === 10;
  const canSubmit = hasAddress && hasPhone;
  const addressError = addressTouched && !hasAddress;
  const phoneError = phoneTouched && !hasPhone;

  function submit() {
    const deliveryAddress = address.trim();

    const params = new URLSearchParams();
    params.set("address", deliveryAddress);
    if (hasDietary) {
      if (allergies.length) params.set("allergies", allergies.join(", "));
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

        <input
          id="address"
          className="big-input"
          value={address}
          onChange={(event) => {
            setAddress(event.target.value);
            setAddressTouched(true);
          }}
          onBlur={() => setAddressTouched(true)}
          placeholder="Street address"
          aria-invalid={addressError}
          style={addressError ? { borderColor: "var(--color-danger)" } : undefined}
        />

        {addressError ? (
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
        <span style={{ fontSize: 20, fontWeight: 700 }}>I have allergies</span>
      </label>

      {hasDietary ? (
        <div className="big-field">
          <label>Allergies</label>
          <ChipGroup
            options={allergenOptions}
            isSelected={(option) => allergies.includes(option)}
            onToggle={toggleAllergy}
          />
          <p className="text-muted" style={{ fontSize: 13, margin: "10px 0 0" }}>
            Prefilled from your profile. Change it here for this delivery only.
          </p>
        </div>
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
