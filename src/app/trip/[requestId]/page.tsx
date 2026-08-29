"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { Screen, ScreenHeader } from "@/components/screen";
import { TripMap } from "@/components/trip-map";
import { Alert } from "@/components/icons";
import { present, tagClass } from "@/lib/trip-labels";
import type { Trip } from "@/lib/uber-rides";

const POLL_MS = 4000;

/** Live status for a booked ride. Polls until the trip reaches a final state. */
export default function Page({ params }: PageProps<"/trip/[requestId]">) {
  const { requestId } = use(params);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const response = await fetch(`/api/rides?requestId=${encodeURIComponent(requestId)}`);
        const body = await response.json();
        if (cancelled) return;

        if (!response.ok) {
          setError(body.reason ?? body.error ?? "Could not read this ride.");
          return;
        }

        setError(null);
        setTrip(body as Trip);

        // Stop polling once nothing more can change on its own.
        if (!present((body as Trip).status).terminal) {
          timer = setTimeout(poll, POLL_MS);
        }
      } catch {
        if (!cancelled) timer = setTimeout(poll, POLL_MS);
      }
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [requestId]);

  if (error) {
    return (
      <Screen>
        <ScreenHeader back="/home" />
        <div className="card elev-sm" style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <Alert size={24} color="var(--color-accent-700)" />
          <span style={{ fontSize: 14 }}>{error}</span>
        </div>
        <div className="grow" />
        <Link className="big-btn big-btn-secondary" href="/request/ride">
          Try again
        </Link>
      </Screen>
    );
  }

  if (!trip) {
    return (
      <Screen>
        <ScreenHeader back="/home" />
        <h2 style={{ margin: 0 }}>Checking your ride…</h2>
        <div className="grow" />
      </Screen>
    );
  }

  const state = present(trip.status);

  return (
    <Screen>
      <ScreenHeader back="/home" />

      <div>
        <span className={tagClass(state.tone)}>{state.label}</span>
        <h2 style={{ margin: "10px 0 6px" }}>
          {trip.etaMinutes ? `${trip.etaMinutes} min away` : state.label}
        </h2>
        <p className="text-muted" style={{ fontSize: 16, margin: 0 }}>
          {state.detail}
        </p>
      </div>

      {trip.pickup && trip.dropoff ? (
        <TripMap
          pickup={trip.pickup}
          dropoff={trip.dropoff}
          driver={trip.driverLocation}
          route={trip.route}
        />
      ) : null}

      {trip.driver ? (
        <div className="card elev-sm" style={{ gap: 16, alignItems: "center", padding: "var(--space-4)" }}>
          <div
            className="icon-circle"
            style={{
              width: 60,
              height: 60,
              background: "var(--color-accent-2-100)",
              fontFamily: "var(--font-heading)",
              fontSize: 24,
              color: "var(--color-accent-2-700)",
            }}
          >
            {trip.driver.name.charAt(0)}
          </div>
          <h4 style={{ margin: 0 }}>{trip.driver.name}</h4>

          {/* Sized to be read at a glance as a car pulls up. */}
          {trip.vehicle ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                textAlign: "center",
              }}
            >
              <span style={{ fontSize: 21, lineHeight: 1.25 }}>
                {[trip.vehicle.color, trip.vehicle.make, trip.vehicle.model]
                  .filter(Boolean)
                  .join(" ")}
              </span>
              {trip.vehicle.licensePlate ? (
                <span
                  style={{
                    fontFamily: "var(--font-body)",
                    fontWeight: 700,
                    fontSize: 30,
                    lineHeight: 1.15,
                    letterSpacing: "0.03em",
                  }}
                >
                  {trip.vehicle.licensePlate}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="card elev-sm" style={{ gap: 10 }}>
        {trip.pickup?.address ? (
          <div className="summary-row">
            <span className="text-muted">Pickup</span>
            <span>{trip.pickup.address}</span>
          </div>
        ) : null}
        {trip.dropoff?.address ? (
          <div className="summary-row">
            <span className="text-muted">Drop-off</span>
            <span>{trip.dropoff.address}</span>
          </div>
        ) : null}
        <div className="summary-row">
          <span className="text-muted">Reference</span>
          <span>{trip.requestId}</span>
        </div>
      </div>

      <div className="grow" />

      <Link className="big-btn big-btn-secondary" href="/home">
        {state.terminal ? "Back to Home" : "Leave this open"}
      </Link>
    </Screen>
  );
}
