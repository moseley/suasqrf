"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Screen, ScreenHeader } from "@/components/screen";
import { Check } from "@/components/icons";
import { useAccount } from "@/lib/use-account";

type Hotel = {
  hotelId: string;
  name: string;
  distanceMiles?: number;
  sample?: boolean;
};

type Booking = {
  confirmationNumber: string;
  sample: boolean;
  hotelName: string;
  checkInDate?: string;
  checkOutDate?: string;
};

type Stage = "form" | "choose" | "booked";

/** Shelter flow — find a room near the veteran, book it, then offer a ride. */
export default function Page() {
  const router = useRouter();
  const { account } = useAccount();

  const [location, setLocation] = useState("");
  const [people, setPeople] = useState("1");
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const [stage, setStage] = useState<Stage>("form");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [radiusMiles, setRadiusMiles] = useState(25);
  const [liveData, setLiveData] = useState(true);
  const [booking, setBooking] = useState<Booking | null>(null);

  function requestWithoutRoom(note?: string) {
    const params = new URLSearchParams({ location: location || "Current location", people });
    if (note) params.set("note", note);
    router.push(`/confirmation/shelter?${params}`);
  }

  /** Asks the browser where the veteran is, so they need not type an address. */
  function useCurrentLocation() {
    if (!("geolocation" in navigator)) {
      setError("This device cannot share a location. Type an address instead.");
      return;
    }

    setBusy(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocation("Current location");
        setBusy(false);
      },
      () => {
        setError("Could not read your location. Type an address instead.");
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function search() {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/shelter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location, ...(coords ?? {}) }),
      });

      const body = await response.json();

      if (!response.ok) {
        setError(body.error ?? "Could not look for nearby rooms.");
        return;
      }

      if (!body.hotels || body.hotels.length === 0) {
        requestWithoutRoom();
        return;
      }

      setHotels(body.hotels as Hotel[]);
      setRadiusMiles(body.radiusMiles ?? 25);
      setLiveData(body.configured === true);
      setStage("choose");
    } catch {
      // A lookup failure must not block a shelter request.
      requestWithoutRoom();
    } finally {
      setBusy(false);
    }
  }

  async function book(hotel: Hotel) {
    setBusy(true);
    setError(null);

    const [firstName, ...rest] = (account?.name ?? "Veteran Guest").split(" ");

    try {
      const response = await fetch("/api/shelter/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotelId: hotel.hotelId,
          guest: {
            firstName,
            lastName: rest.join(" ") || "Guest",
            phone: account?.phone ?? "+15555555555",
            email: account?.email ?? "guest@example.com",
          },
        }),
      });

      const body = await response.json();

      if (!body.booked) {
        // Say so rather than implying a room is held.
        setError(`${body.reason ?? "The room could not be booked."} A caseworker can still help.`);
        return;
      }

      setBooking({
        confirmationNumber: body.confirmationNumber,
        sample: body.sample === true,
        hotelName: hotel.name,
        checkInDate: body.checkInDate,
        checkOutDate: body.checkOutDate,
      });
      setStage("booked");
    } catch {
      setError("Could not reach the booking service. A caseworker can still help.");
    } finally {
      setBusy(false);
    }
  }

  /** Hands off to the ride form with both ends already filled in. */
  function goToRide() {
    const params = new URLSearchParams({
      pickup: location || "Current location",
      dropoff: booking?.hotelName ?? "",
    });
    router.push(`/request/ride?${params}`);
  }

  if (stage === "booked" && booking) {
    return (
      <Screen centered>
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
          style={{ width: "100%", textAlign: "left", gap: 10, marginTop: 8 }}
        >
          <div className="summary-row">
            <span className="text-muted">Property</span>
            <span>{booking.hotelName}</span>
          </div>
          {booking.checkInDate ? (
            <div className="summary-row">
              <span className="text-muted">Check in</span>
              <span>{booking.checkInDate}</span>
            </div>
          ) : null}
          <div className="summary-row">
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

  if (stage === "choose") {
    return (
      <Screen>
        <ScreenHeader back="/home" />

        <div>
          <h2 style={{ marginBottom: 4 }}>Rooms near you</h2>
          <p className="text-muted" style={{ fontSize: 16 }}>
            Within {radiusMiles} miles of {location}.
          </p>
        </div>

        {!liveData ? (
          <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>
            Sample properties — hotel booking is not connected yet, so these are not
            real rooms.
          </p>
        ) : null}

        {error ? (
          <p style={{ fontSize: 14, color: "var(--color-accent-700)", margin: 0 }}>{error}</p>
        ) : null}

        {hotels.map((hotel) => (
          <button
            key={hotel.hotelId}
            type="button"
            className="svc-card"
            style={{ textAlign: "left", cursor: "pointer", width: "100%" }}
            disabled={busy}
            onClick={() => book(hotel)}
          >
            <div style={{ flex: 1 }}>
              <h4 style={{ margin: "0 0 2px" }}>{hotel.name}</h4>
              {hotel.distanceMiles !== undefined ? (
                <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>
                  {hotel.distanceMiles.toFixed(1)} miles away
                </p>
              ) : null}
            </div>
          </button>
        ))}

        <div className="grow" />

        <button
          className="big-btn big-btn-secondary"
          type="button"
          disabled={busy}
          onClick={() => requestWithoutRoom()}
        >
          {busy ? "Booking…" : "None of these — request shelter"}
        </button>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader back="/home" />

      <h2 style={{ margin: 0 }}>Request emergency shelter</h2>

      <div className="big-field">
        <label htmlFor="location">Current location</label>
        <input
          id="location"
          className="big-input"
          value={location}
          onChange={(event) => {
            setLocation(event.target.value);
            // Typing replaces the fix from the device.
            setCoords(null);
          }}
          placeholder="Cross streets or address"
        />
        <button
          className="btn btn-ghost"
          type="button"
          style={{ marginTop: 8, fontSize: 15 }}
          disabled={busy}
          onClick={useCurrentLocation}
        >
          Use my current location
        </button>
      </div>

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
        onClick={search}
      >
        {busy ? "Looking for a room…" : "Request Shelter"}
      </button>
    </Screen>
  );
}
