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

  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seed the pickup from the saved address once, leaving later edits alone.
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (!seeded && account?.homeAddress) {
      setPickup(account.homeAddress);
      setSeeded(true);
    }
  }, [account, seeded]);

  /**
   * Addresses go to the server as text; it geocodes them, so no maps key is
   * needed here. On success we hand off to the live status screen.
   */
  async function book() {
    setBooking(true);
    setError(null);

    const [firstName, ...rest] = (account?.name ?? "Veteran").split(" ");

    try {
      const response = await fetch("/api/rides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guest: {
            firstName,
            lastName: rest.join(" "),
            phoneNumber: account?.phone ?? "+15555555555",
          },
          pickupAddress: pickup,
          dropoffAddress: dropoff,
          note: notes || undefined,
          scheduled: when === "schedule",
        }),
      });

      const body = await response.json();

      if (!response.ok) {
        setError(body.reason ?? body.error ?? "Could not request the ride.");
        return;
      }

      router.push(`/trip/${encodeURIComponent(body.requestId)}`);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBooking(false);
    }
  }

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

      {error ? (
        <p style={{ fontSize: 14, color: "var(--color-accent-700)", margin: 0 }}>{error}</p>
      ) : null}

      <div className="grow" />

      <button
        className="big-btn big-btn-primary"
        type="button"
        disabled={pickup.trim() === "" || dropoff.trim() === "" || booking}
        onClick={book}
      >
        {booking ? "Requesting…" : "Request Ride"}
      </button>
    </Screen>
  );
}
