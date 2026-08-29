"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Screen, ScreenHeader } from "@/components/screen";
import { Alert } from "@/components/icons";

/** Shelter flow, step B — Request emergency shelter. */
export default function Page() {
  const router = useRouter();
  const [location, setLocation] = useState("");
  const [people, setPeople] = useState("1");
  const [immediate, setImmediate] = useState<"yes" | "no">("yes");

  return (
    <Screen>
      <ScreenHeader back="/home" />

      <h2 style={{ margin: 0 }}>Request emergency shelter</h2>

      <div
        className="card elev-sm"
        style={{
          border: "1.5px solid var(--color-accent)",
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Alert size={24} color="var(--color-accent-700)" />
        <span style={{ fontSize: 14 }}>
          If this is a life-threatening emergency,{" "}
          <a href="tel:911" style={{ color: "var(--color-accent-700)" }}>
            call 911
          </a>{" "}
          now.
        </span>
      </div>

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

      <div className="big-field">
        <label>Is this an immediate safety concern?</label>
        <div className="seg" style={{ width: "100%", display: "flex" }}>
          {(["yes", "no"] as const).map((option) => (
            <label
              key={option}
              className="seg-opt"
              style={{ flex: 1, justifyContent: "center", padding: 12, fontSize: 15 }}
            >
              <input
                type="radio"
                name="immediate"
                checked={immediate === option}
                onChange={() => setImmediate(option)}
              />
              {option === "yes" ? "Yes" : "No"}
            </label>
          ))}
        </div>
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
