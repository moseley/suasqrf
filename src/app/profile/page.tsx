"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Screen, ScreenHeader } from "@/components/screen";
import { ChipGroup } from "@/components/chips";
import { clearAccount, saveAccount, type Account } from "@/lib/account";
import { useAccount } from "@/lib/use-account";
import { ALLERGENS } from "@/lib/meal-options";
import { nextPhoneValue } from "@/lib/phone";

const SECTION_LABEL: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "color-mix(in srgb, var(--color-text) 55%, transparent)",
  margin: "10px 0 0",
};

/** Profile — view and edit the on-device account the request flows prefill from. */
export default function Page() {
  const router = useRouter();
  const { account } = useAccount();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [homeAddress, setHomeAddress] = useState("");
  // Known allergens are chips; anything else the veteran types goes in the
  // free-text "other" field. Both feed the one stored allergies list.
  const [allergenChips, setAllergenChips] = useState<string[]>([]);
  const [otherAllergies, setOtherAllergies] = useState("");

  // Populate from the stored account once it is read (null on the server and
  // first client render, so the shell stays hydration-safe).
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (seeded || !account) return;
    setName(account.name ?? "");
    setPhone(account.phone ?? "");
    setEmail(account.email ?? "");
    setHomeAddress(account.homeAddress ?? "");
    const storedAllergies = account.allergies ?? [];
    const known = ALLERGENS as readonly string[];
    setAllergenChips(storedAllergies.filter((entry) => known.includes(entry)));
    setOtherAllergies(storedAllergies.filter((entry) => !known.includes(entry)).join(", "));
    setSeeded(true);
  }, [account, seeded]);

  // Auto-save: every edit writes straight back to the account, merged onto the
  // loaded one so fields this screen does not manage (isMock, vaConnected) are
  // preserved. Runs only after seeding, so it never writes the empty shell over
  // a stored account before it loads.
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!seeded) return;
    // Merge the chips and the free-text allergens into one list, dropping any
    // typed entry that just repeats a chip.
    const custom = otherAllergies
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .filter((entry) => !allergenChips.some((chip) => chip.toLowerCase() === entry.toLowerCase()));
    const base: Account = account ?? { name: "", isMock: false };
    saveAccount({
      ...base,
      name: name.trim() || base.name,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      homeAddress: homeAddress.trim() || undefined,
      allergies: [...allergenChips, ...custom],
    });
    setSaved(true);
  }, [seeded, account, name, phone, email, homeAddress, allergenChips, otherAllergies]);

  function toggle(list: string[], setList: (next: string[]) => void, option: string) {
    setList(list.includes(option) ? list.filter((value) => value !== option) : [...list, option]);
  }

  function signOut() {
    clearAccount();
    router.push("/");
  }

  return (
    <Screen>
      <ScreenHeader back="/home" />

      <div>
        <h2 style={{ margin: 0 }}>Your profile</h2>
        <p className="text-muted" style={{ fontSize: 16, margin: "4px 0 0" }}>
          Keep this current so a request is one tap.
        </p>
      </div>

      <p style={SECTION_LABEL}>Contact &amp; basics</p>

      <div className="big-field">
        <label htmlFor="name">Full name</label>
        <input
          id="name"
          className="big-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Your name"
        />
      </div>

      <div className="big-field">
        <label htmlFor="phone">Phone number</label>
        <input
          id="phone"
          className="big-input"
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(event) => setPhone(nextPhoneValue(event.target.value, phone))}
          placeholder="555-555-5555"
        />
      </div>

      <div className="big-field">
        <label htmlFor="email">Email address</label>
        <input
          id="email"
          className="big-input"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
        />
      </div>

      <div className="big-field">
        <label htmlFor="home">Home address</label>
        <input
          id="home"
          className="big-input"
          value={homeAddress}
          onChange={(event) => setHomeAddress(event.target.value)}
          placeholder="Street address"
        />
      </div>

      <p style={SECTION_LABEL}>Health</p>

      <div className="big-field">
        <label>Allergies</label>
        <ChipGroup
          options={ALLERGENS}
          isSelected={(option) => allergenChips.includes(option)}
          onToggle={(option) => toggle(allergenChips, setAllergenChips, option)}
        />
        <input
          className="big-input"
          value={otherAllergies}
          onChange={(event) => setOtherAllergies(event.target.value)}
          placeholder="Other allergies (e.g. Mustard, Sulfites)"
          aria-label="Other allergies"
          style={{ marginTop: 12 }}
        />
        <p className="text-muted" style={{ fontSize: 13, margin: "8px 0 0" }}>
          Not listed above? Add it here, separating each with a comma.
        </p>
      </div>

      <div className="grow" />

      <p
        className="text-muted"
        style={{ fontSize: 14, textAlign: "center", margin: 0 }}
      >
        {saved ? "Changes are saved automatically." : "Your changes save as you make them."}
      </p>

      <button
        className="btn btn-ghost"
        type="button"
        onClick={signOut}
        style={{ alignSelf: "center", fontSize: 16 }}
      >
        Sign out
      </button>
    </Screen>
  );
}
