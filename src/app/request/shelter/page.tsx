"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Screen, ScreenHeader } from "@/components/screen";
import { Check } from "@/components/icons";
import { AddressField, type Coords } from "@/components/address-field";
import { useAccount } from "@/lib/use-account";

type Booking = {
  hotelName: string;
  hotelAddress: string | null;
  distanceMiles?: number;
  confirmationNumber: string;
  checkInDate?: string;
  sample: boolean;
};

/** Shelter flow — books the nearest room outright, then offers a ride to it. */
export default function Page() {
  const router = useRouter();
  const { account } = useAccount();

  const [location, setLocation] = useState("");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [people, setPeople] = useState("1");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);

  // Default to the address on file. Device location is an override, not a
  // dependency — it is refused often enough that a shelter request must not
  // rest on it.
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (!seeded && account?.homeAddress) {
      setLocation(account.homeAddress);
      setSeeded(true);
    }
  }, [account, seeded]);

  function requestWithoutRoom() {
    const params = new URLSearchParams({ location: location || "Current location", people });
    router.push(`/confirmation/shelter?${params}`);
  }

  /** One tap: find the nearest room and take it. */
  async function submit() {
    setBusy(true);
    setError(null);

    const [firstName, ...rest] = (account?.name ?? "Veteran Guest").split(" ");

    try {
      const response = await fetch("/api/shelter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location,
          ...(coords ?? {}),
          guest: {
            firstName,
            lastName: rest.join(" ") || "Guest",
            phone: account?.phone ?? "+15555555555",
            email: account?.email ?? "guest@example.com",
          },
        }),
      });

      const body = await response.json();

      if (!response.ok) {
        setError(body.error ?? "Could not arrange a room.");
        return;
      }

      if (!body.booked) {
        // Say so plainly rather than implying a room is held.
        setError(`${body.reason ?? "Could not book a room."} A caseworker can still help.`);
        return;
      }

      setBooking({
        hotelName: body.hotel.name,
        hotelAddress: body.hotel.address ?? null,
        distanceMiles: body.hotel.distanceMiles,
        confirmationNumber: body.confirmationNumber,
        checkInDate: body.checkInDate,
        sample: body.sample === true,
      });
    } catch {
      // A lookup failure must not block a shelter request.
      requestWithoutRoom();
    } finally {
      setBusy(false);
    }
  }

  /** Hands off to the ride form with both ends already filled in. */
  function goToRide() {
    const params = new URLSearchParams({
      pickup: location || "Current location",
      // The address, not the hotel name — a ride needs somewhere to drive to.
      dropoff: booking?.hotelAddress ?? booking?.hotelName ?? "",
    });
    router.push(`/request/ride?${params}`);
  }

  if (booking) {
    return (
      <Screen centered>
        <ScreenHeader />

        <div className="grow" />

        <div
          className="icon-circle"
          style={{ width: 88, height: 88, background: "var(--color-accent-2-100)" }}
        >
          <Check size={40} color="var(--color-accent-2-700)" />
        </div>

        <h2 style={{ margin: "18px 0 4px" }}>Room booked</h2>
        <p className="text-muted" style={{ fontSize: 16, maxWidth: 300 }}>
          {booking.sample
            ? "This is a sample booking — hotel booking is not connected yet, so no real room is held."
            : "A room is held for you tonight."}
        </p>

        <div
          className="card elev-sm"
          style={{ width: "100%", textAlign: "left", gap: 6, marginTop: 8 }}
        >
          <span style={{ fontSize: 21, lineHeight: 1.25 }}>{booking.hotelName}</span>
          {booking.hotelAddress ? (
            <span className="text-muted" style={{ fontSize: 16 }}>
              {booking.hotelAddress}
            </span>
          ) : null}
          {booking.distanceMiles !== undefined ? (
            <span className="text-muted" style={{ fontSize: 14 }}>
              {booking.distanceMiles} miles away
            </span>
          ) : null}

          <div className="summary-row" style={{ marginTop: 8 }}>
            <span className="text-muted">Confirmation</span>
            <span>{booking.confirmationNumber}</span>
          </div>
        </div>

        <div className="grow" />

        <h4 style={{ margin: "0 0 4px" }}>Do you need a ride there?</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
          <button className="big-btn big-btn-primary" type="button" onClick={goToRide}>
            Yes, request a ride
          </button>
          <button
            className="big-btn big-btn-secondary"
            type="button"
            onClick={() => router.push("/home")}
          >
            No, I can get there
          </button>
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader back="/home" />

      <h2 style={{ margin: 0 }}>Request emergency shelter</h2>

      <AddressField
        id="location"
        label="Current location"
        value={location}
        onChange={(next, nextCoords) => {
          setLocation(next);
          setCoords(nextCoords);
        }}
        placeholder="Cross streets or address"
      />

      <div className="big-field">
        <label htmlFor="people">How many people need shelter?</label>
        <input
          id="people"
          className="big-input"
          type="number"
          inputMode="numeric"
          min={1}
          value={people}
          onChange={(event) => setPeople(event.target.value)}
        />
      </div>

      {error ? (
        <p style={{ fontSize: 14, color: "var(--color-accent-700)", margin: 0 }}>{error}</p>
      ) : null}

      <div className="grow" />

      <button
        className="big-btn big-btn-primary"
        type="button"
        disabled={(location.trim() === "" && !coords) || busy}
        onClick={submit}
      >
        {busy ? "Finding a room…" : "Request Shelter"}
      </button>
    </Screen>
  );
}
