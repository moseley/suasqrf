"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Screen, ScreenHeader } from "@/components/screen";

type Hotel = {
  hotelId: string;
  name: string;
  distanceMiles?: number;
  sample?: boolean;
};

/** Shelter flow, step B — Request emergency shelter. */
export default function Page() {
  const router = useRouter();
  const [location, setLocation] = useState("");
  const [people, setPeople] = useState("1");

  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Populated once a search finds rooms within the radius.
  const [hotels, setHotels] = useState<Hotel[] | null>(null);
  const [radiusMiles, setRadiusMiles] = useState(25);
  const [liveData, setLiveData] = useState(true);

  function confirm(hotelName?: string) {
    const params = new URLSearchParams({ location, people });
    if (hotelName) params.set("hotel", hotelName);
    router.push(`/confirmation/shelter?${params}`);
  }

  /**
   * Looks for a room near the veteran first. Nothing nearby is not a failure —
   * it falls through to the ordinary shelter request.
   */
  async function submit() {
    setSearching(true);
    setError(null);

    try {
      const response = await fetch("/api/shelter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location }),
      });

      const body = await response.json();

      if (!response.ok) {
        setError(body.error ?? "Could not look for nearby rooms.");
        return;
      }

      if (!body.hotels || body.hotels.length === 0) {
        confirm();
        return;
      }

      setHotels(body.hotels as Hotel[]);
      setRadiusMiles(body.radiusMiles ?? 25);
      setLiveData(body.configured === true);
    } catch {
      // A lookup failure must not block a shelter request.
      confirm();
    } finally {
      setSearching(false);
    }
  }

  if (hotels) {
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
            Sample properties — hotel search is not connected yet, so these are
            not real rooms.
          </p>
        ) : null}

        {hotels.map((hotel) => (
          <button
            key={hotel.hotelId}
            type="button"
            className="svc-card"
            style={{ textAlign: "left", cursor: "pointer", width: "100%" }}
            onClick={() => confirm(hotel.name)}
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
          onClick={() => confirm()}
        >
          None of these — request shelter
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
          onChange={(event) => setLocation(event.target.value)}
          placeholder="Cross streets or address"
        />
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
        disabled={location.trim() === "" || searching}
        onClick={submit}
      >
        {searching ? "Looking for a room…" : "Request Shelter"}
      </button>
    </Screen>
  );
}
