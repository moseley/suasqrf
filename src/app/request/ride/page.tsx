"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Screen, ScreenHeader } from "@/components/screen";
import { Check } from "@/components/icons";
import { useAccount } from "@/lib/use-account";

/** Kept in step with PROVIDER_NAME in src/lib/veteran-rides.ts. */
const VETERAN_SERVICE = "Veterans To Veterans";

/** Ride flow, step B — Request a ride. Pickup is always as soon as possible. */
export default function Page() {
  const router = useRouter();
  const { account } = useAccount();
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [veteranDriver, setVeteranDriver] = useState(false);

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
          veteranDriver,
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

      <label className="big-check">
        <input
          type="checkbox"
          checked={veteranDriver}
          onChange={(event) => setVeteranDriver(event.target.checked)}
        />
        <span className="check-box">
          <Check size={16} />
        </span>
        <span>
          Request a veteran driver
          <span className="text-muted" style={{ display: "block", fontSize: 13 }}>
            Handled by the {VETERAN_SERVICE}, not Uber.
          </span>
        </span>
      </label>

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
