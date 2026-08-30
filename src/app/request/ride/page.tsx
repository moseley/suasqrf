"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Screen, ScreenHeader } from "@/components/screen";
import { Check } from "@/components/icons";
import { useAccount } from "@/lib/use-account";

/** Kept in step with PROVIDER_NAME in src/lib/veteran-rides.ts. */
const VETERAN_SERVICE = "Veterans To Veterans";

/** `datetime-local` wants local wall-clock time, not an ISO instant. */
function toLocalInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** Ride flow, step B — Request a ride. */
export default function Page() {
  const router = useRouter();
  const { account } = useAccount();
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [when, setWhen] = useState<"now" | "schedule">("now");
  const [veteranDriver, setVeteranDriver] = useState(false);

  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickupTime, setPickupTime] = useState("");

  // Computed after mount: the server's clock would differ from the browser's
  // and cause a hydration mismatch.
  const [earliest, setEarliest] = useState("");
  useEffect(() => {
    setEarliest(toLocalInputValue(new Date(Date.now() + 15 * 60 * 1000)));
  }, []);

  const scheduling = when === "schedule";
  const scheduledFor = pickupTime ? new Date(pickupTime) : null;
  const scheduleReady = !scheduling || (scheduledFor !== null && !Number.isNaN(scheduledFor.getTime()));

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
          // Epoch milliseconds, which is what the provider's scheduling takes.
          pickupTime: scheduling && scheduledFor ? scheduledFor.getTime() : undefined,
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

      {scheduling ? (
        <div className="big-field">
          <label htmlFor="pickup-time">Pickup date and time</label>
          <input
            id="pickup-time"
            className="big-input"
            type="datetime-local"
            value={pickupTime}
            min={earliest || undefined}
            onChange={(event) => setPickupTime(event.target.value)}
          />
          <p className="text-muted" style={{ fontSize: 13, margin: "8px 0 0" }}>
            {scheduledFor && !Number.isNaN(scheduledFor.getTime())
              ? `Pickup ${scheduledFor.toLocaleString(undefined, {
                  weekday: "long",
                  hour: "numeric",
                  minute: "2-digit",
                })}. A driver is assigned closer to the time.`
              : "Choose at least 15 minutes from now."}
          </p>
        </div>
      ) : null}

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
        disabled={pickup.trim() === "" || dropoff.trim() === "" || !scheduleReady || booking}
        onClick={book}
      >
        {booking ? "Requesting…" : scheduling ? "Schedule Ride" : "Request Ride"}
      </button>
    </Screen>
  );
}
