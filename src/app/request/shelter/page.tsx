"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Screen, ScreenHeader } from "@/components/screen";

/** Shelter flow, step B — Request emergency shelter. */
export default function Page() {
  const router = useRouter();
  const [location, setLocation] = useState("");
  const [people, setPeople] = useState("1");

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

      <div className="grow" />

      <button
        className="big-btn big-btn-primary"
        type="button"
        disabled={location.trim() === ""}
        onClick={() =>
          router.push(
            `/confirmation/shelter?location=${encodeURIComponent(location)}&people=${encodeURIComponent(people)}`,
          )
        }
      >
        Request Shelter
      </button>
    </Screen>
  );
}
