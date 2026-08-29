"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Screen, ScreenHeader } from "@/components/screen";
import { useAccount } from "@/lib/use-account";

const DIETS = ["None", "Vegetarian", "Diabetic-friendly", "Food allergy"] as const;

/** Meal flow, step B — Request a meal delivery. */
export default function Page() {
  const router = useRouter();
  const { account } = useAccount();
  const [address, setAddress] = useState("");
  const [diet, setDiet] = useState<(typeof DIETS)[number]>("None");
  const [notes, setNotes] = useState("");

  // Seed the delivery address from the saved one once, leaving later edits alone.
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (!seeded && account?.homeAddress) {
      setAddress(account.homeAddress);
      setSeeded(true);
    }
  }, [account, seeded]);

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
      </div>

      <div className="big-field">
        <label>Dietary needs</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {DIETS.map((option) => (
            <label key={option} className="radio" style={{ fontSize: 16 }}>
              <input
                type="radio"
                name="diet"
                checked={diet === option}
                onChange={() => setDiet(option)}
              />
              <span className="dot" />
              {option}
            </label>
          ))}
        </div>
      </div>

      <div className="big-field">
        <label htmlFor="notes">Notes (optional)</label>
        <textarea
          id="notes"
          className="big-input"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Anything else we should know"
        />
      </div>

      <div className="grow" />

      <button
        className="big-btn big-btn-primary"
        type="button"
        disabled={address.trim() === ""}
        onClick={() =>
          router.push(
            `/confirmation/meal?address=${encodeURIComponent(address)}&diet=${encodeURIComponent(diet)}`,
          )
        }
      >
        Request Meal
      </button>
    </Screen>
  );
}
