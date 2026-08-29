"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Screen, ScreenHeader } from "@/components/screen";
import { useAccount } from "@/lib/use-account";

/** Ride flow, step B — Request a ride. */
export default function Page() {
  const router = useRouter();
  const { account } = useAccount();
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [when, setWhen] = useState<"now" | "schedule">("now");
  const [notes, setNotes] = useState("");

  // Seed the pickup from the saved address once, leaving later edits alone.
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (!seeded && account?.homeAddress) {
      setPickup(account.homeAddress);
      setSeeded(true);
    }
  }, [account, seeded]);

  return (
    <Screen>
      <ScreenHeader back="/home" />

      <h2 style={{ margin: 0 }}>Request a ride</h2>

      <div className="big-field">
        <label htmlFor="pickup">Pickup location</label>
        <input
          id="pickup"
          className="big-input"
          value={pickup}
          onChange={(event) => setPickup(event.target.value)}
          placeholder="Street address"
        />
      </div>

      <div className="big-field">
        <label htmlFor="dropoff">Where are you going?</label>
        <input
          id="dropoff"
          className="big-input"
          value={dropoff}
          onChange={(event) => setDropoff(event.target.value)}
          placeholder="Destination"
        />
      </div>

      <div className="big-field">
        <label>When</label>
        <div className="seg" style={{ width: "100%", display: "flex" }}>
          {(["now", "schedule"] as const).map((option) => (
            <label
              key={option}
              className="seg-opt"
              style={{ flex: 1, justifyContent: "center", padding: 12, fontSize: 15 }}
            >
              <input
                type="radio"
                name="when"
                checked={when === option}
                onChange={() => setWhen(option)}
              />
              {option === "now" ? "Now" : "Schedule"}
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
          placeholder="Anything the driver should know"
        />
      </div>

      <div className="grow" />

      <button
        className="big-btn big-btn-primary"
        type="button"
        disabled={pickup.trim() === "" || dropoff.trim() === ""}
        onClick={() =>
          router.push(
            `/confirmation/ride?pickup=${encodeURIComponent(pickup)}&dropoff=${encodeURIComponent(dropoff)}`,
          )
        }
      >
        Request Ride
      </button>
    </Screen>
  );
}
