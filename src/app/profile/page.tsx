"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Screen, ScreenHeader } from "@/components/screen";
import { ShieldCheck } from "@/components/icons";
import {
  clearAccount,
  saveAccount,
  type Account,
} from "@/lib/account";
import { useAccount } from "@/lib/use-account";
import { CUISINES, DIETARY_RESTRICTIONS } from "@/lib/meal-options";

/**
 * Veteran Profile (PRD-002).
 *
 * One screen to view and edit the account the meal flow prefills from, plus a
 * clearly labeled Connect to VA placeholder for the eventual sync. Everything
 * persists to the existing localStorage account; nothing here touches a network.
 */
export default function Page() {
  const router = useRouter();
  const { account, ready } = useAccount();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [homeAddress, setHomeAddress] = useState("");
  const [allergies, setAllergies] = useState("");
  const [diet, setDiet] = useState<string[]>([]);
  const [cuisine, setCuisine] = useState("");
  const [saved, setSaved] = useState(false);

  // Populate every field once the stored account is read, treating missing
  // optional fields as empty. Runs once; later edits are the veteran's.
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (seeded || !ready) return;
    if (account) {
      setName(account.name ?? "");
      setPhone(account.phone ?? "");
      setEmail(account.email ?? "");
      setHomeAddress(account.homeAddress ?? "");
      setAllergies(account.allergies ?? "");
      setDiet(account.dietaryRestrictions ?? []);
      setCuisine(account.cuisinePreference ?? "");
    }
    setSeeded(true);
  }, [account, ready, seeded]);

  function toggleDiet(option: string) {
    setSaved(false);
    setDiet((current) =>
      current.includes(option)
        ? current.filter((value) => value !== option)
        : [...current, option],
    );
  }

  function save() {
    // Merge onto the loaded account so fields this screen does not manage
    // (isMock, vaConnected) are preserved. Empty optionals are dropped.
    const merged: Account = {
      ...(account ?? { name: "", isMock: false }),
      name: name.trim() || "Veteran",
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      homeAddress: homeAddress.trim() || undefined,
      allergies: allergies.trim() || undefined,
      dietaryRestrictions: diet.length ? diet : undefined,
      cuisinePreference: cuisine || undefined,
    };
    saveAccount(merged);
    setSaved(true);
  }

  function signOut() {
    clearAccount();
    router.push("/");
  }

  // Stable shell until the stored account is read, matching the hydration-safe
  // pattern used across the app.
  if (!ready) {
    return (
      <Screen>
        <ScreenHeader back="/home" />
        <h2 style={{ margin: 0 }}>Your profile</h2>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader back="/home" />

      <div>
        <h2 style={{ margin: 0 }}>Your profile</h2>
        <p className="text-muted" style={{ fontSize: 15, margin: "4px 0 0" }}>
          Keep this current so a request is one tap.
        </p>
      </div>

      <h6 className="section-label" style={{ margin: 0 }}>
        Contact &amp; basics
      </h6>

      <div className="big-field">
        <label htmlFor="name">Full name</label>
        <input
          id="name"
          className="big-input"
          value={name}
          onChange={(event) => {
            setSaved(false);
            setName(event.target.value);
          }}
          placeholder="First and last name"
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
          onChange={(event) => {
            setSaved(false);
            setPhone(event.target.value);
          }}
          placeholder="(555) 555-5555"
        />
      </div>

      <div className="big-field">
        <label htmlFor="email">Email address</label>
        <input
          id="email"
          className="big-input"
          type="email"
          value={email}
          onChange={(event) => {
            setSaved(false);
            setEmail(event.target.value);
          }}
          placeholder="you@example.com"
        />
      </div>

      <div className="big-field">
        <label htmlFor="homeAddress">Home address</label>
        <input
          id="homeAddress"
          className="big-input"
          value={homeAddress}
          onChange={(event) => {
            setSaved(false);
            setHomeAddress(event.target.value);
          }}
          placeholder="Street address"
        />
      </div>

      <h6 className="section-label" style={{ margin: 0 }}>
        Health &amp; dietary
      </h6>

      <div className="big-field">
        <label htmlFor="allergies">Allergies</label>
        <input
          id="allergies"
          className="big-input"
          value={allergies}
          onChange={(event) => {
            setSaved(false);
            setAllergies(event.target.value);
          }}
          placeholder="e.g. Peanuts, shellfish"
        />
      </div>

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

      <h6 className="section-label" style={{ margin: 0 }}>
        Food preferences
      </h6>

      <div className="big-field">
        <label>Preferred cuisine</label>
        <div className="chip-group">
          {CUISINES.map((option) => (
            <button
              key={option}
              type="button"
              className="chip"
              aria-pressed={cuisine === option}
              onClick={() => {
                setSaved(false);
                setCuisine((current) => (current === option ? "" : option));
              }}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {/* VA connector placeholder — sets nothing, calls no network (AC-1.6). */}
      <div className="card elev-sm" style={{ gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            className="icon-circle"
            style={{ width: 40, height: 40, background: "var(--color-accent-100)" }}
          >
            <ShieldCheck size={20} color="var(--color-accent-700)" />
          </div>
          <div>
            <div className="card-title">Connect to the VA</div>
            <span className="tag tag-outline" style={{ fontSize: 10 }}>
              Coming soon
            </span>
          </div>
        </div>
        <p className="text-muted" style={{ fontSize: 14, margin: 0 }}>
          Once connected, your identity, service history, allergies, and eligibility will sync
          automatically from the VA, so you will not have to enter them here.
        </p>
        <button className="big-btn big-btn-secondary" type="button" disabled aria-disabled="true">
          Connect to VA
        </button>
      </div>

      {saved ? (
        <p style={{ fontSize: 14, color: "var(--color-accent-2-700)", margin: 0 }}>
          Profile saved.
        </p>
      ) : null}

      <div className="grow" />

      <button className="big-btn big-btn-primary" type="button" onClick={save}>
        Save profile
      </button>

      <button
        className="btn btn-ghost"
        type="button"
        style={{ alignSelf: "center", fontSize: 16 }}
        onClick={signOut}
      >
        Sign out
      </button>
    </Screen>
  );
}
