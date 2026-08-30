"use client";

import { useEffect, useRef, useState } from "react";

export type Coords = { latitude: number; longitude: number };

/**
 * An address field with an optional device-location shortcut.
 *
 * A device fix is turned into a street address before it is shown: coordinates
 * tell a veteran nothing about whether we have the right place. The caller
 * still receives the coordinates, so a request can be precise even when the
 * text is approximate.
 *
 * Shared by the ride, meal and shelter forms so all three behave the same.
 */
type Suggestion = {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  distanceMiles: number;
};

export function AddressField({
  id,
  label,
  value,
  onChange,
  placeholder = "Street address",
  invalid = false,
  errorText,
  allowCurrentLocation = true,
  suggestNear,
}: {
  id: string;
  label: string;
  value: string;
  /** Coordinates are null when the veteran typed the address themselves. */
  onChange: (address: string, coords: Coords | null) => void;
  placeholder?: string;
  invalid?: boolean;
  errorText?: string;
  allowCurrentLocation?: boolean;
  /** Enables type-ahead, ranked by distance from this point or address. */
  suggestNear?: { coords?: Coords | null; address?: string } | null;
}) {
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);

  // Suppressed right after a pick, so choosing does not immediately re-search
  // the text it just inserted.
  const skipNextSearch = useRef(false);

  useEffect(() => {
    if (!suggestNear) return;
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }
    if (value.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    // Debounced: the geocoder asks for at most one request a second.
    const timer = setTimeout(async () => {
      const params = new URLSearchParams({ q: value.trim() });
      if (suggestNear.coords) {
        params.set("lat", String(suggestNear.coords.latitude));
        params.set("lng", String(suggestNear.coords.longitude));
      } else if (suggestNear.address) {
        params.set("near", suggestNear.address);
      } else {
        return;
      }

      setSearching(true);
      try {
        const response = await fetch(`/api/places?${params}`);
        const body = await response.json();
        setSuggestions(Array.isArray(body.places) ? body.places : []);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [value, suggestNear]);

  function choose(suggestion: Suggestion) {
    skipNextSearch.current = true;
    setSuggestions([]);
    onChange(suggestion.address, {
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
    });
  }

  function useCurrentLocation() {
    if (!("geolocation" in navigator)) {
      setGeoError("This device cannot share a location. Type an address instead.");
      return;
    }
    // Geolocation is refused outright off HTTPS, with a bare permission error
    // that would otherwise look like the veteran declined.
    if (!window.isSecureContext) {
      setGeoError("Location needs a secure (https) connection. Type an address instead.");
      return;
    }

    setLocating(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        let address = "";
        try {
          const response = await fetch("/api/geocode", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(coords),
          });
          const body = await response.json();
          address = typeof body.address === "string" ? body.address : "";
        } catch {
          // Fall through: the fix is still usable even unnamed.
        }

        if (address) {
          onChange(address, coords);
        } else {
          setGeoError("Found you, but could not name the address. Type it instead.");
        }
        setLocating(false);
      },
      (failure) => {
        // Each cause needs different advice; one message for all three leaves
        // someone retrying a button that will never work.
        setGeoError(
          failure.code === failure.PERMISSION_DENIED
            ? "Location is blocked for this site. Allow it in your browser settings, or type an address."
            : failure.code === failure.TIMEOUT
              ? "Finding your location took too long. Try again, or type an address."
              : "Your location is unavailable right now. Type an address instead.",
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }

  return (
    <div className="big-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="big-input"
        value={value}
        onChange={(event) => {
          // Typing replaces the device fix, so the two can never disagree.
          onChange(event.target.value, null);
          setGeoError(null);
        }}
        placeholder={placeholder}
        aria-invalid={invalid}
        style={invalid ? { borderColor: "var(--color-danger)" } : undefined}
      />
      {suggestions.length > 0 ? (
        <ul className="suggest-list">
          {suggestions.map((suggestion) => (
            <li key={`${suggestion.latitude},${suggestion.longitude}`}>
              <button type="button" className="suggest-item" onClick={() => choose(suggestion)}>
                <span className="suggest-name">{suggestion.name}</span>
                <span className="suggest-meta">
                  <span className="suggest-distance">{suggestion.distanceMiles} mi</span>
                  {" · "}
                  {suggestion.address}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : searching && value.trim().length >= 3 ? (
        <p className="text-muted" style={{ fontSize: 13, margin: "8px 0 0" }}>
          Searching…
        </p>
      ) : null}

      {allowCurrentLocation ? (
        <button
          className="btn btn-ghost"
          type="button"
          style={{ marginTop: 8, fontSize: 15 }}
          disabled={locating}
          onClick={useCurrentLocation}
        >
          {locating ? "Finding you…" : "Use my current location"}
        </button>
      ) : null}

      {geoError ? (
        <p style={{ fontSize: 14, color: "var(--color-accent-700)", margin: "8px 0 0" }}>
          {geoError}
        </p>
      ) : invalid && errorText ? (
        <p style={{ fontSize: 14, color: "var(--color-danger)", margin: "8px 0 0" }}>
          {errorText}
        </p>
      ) : null}
    </div>
  );
}
