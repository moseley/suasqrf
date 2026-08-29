"use client";

type Point = { latitude: number; longitude: number };

/**
 * Schematic route map. Positions are the real coordinates, projected into a
 * fixed viewport — but there is no street data behind it, so it shows relative
 * positions and progress rather than an actual road route.
 *
 * Drawn inline so the app needs no tile provider, no maps key, and no extra
 * dependency. Swap for a real map later without changing the caller.
 */
export function TripMap({
  pickup,
  dropoff,
  driver,
}: {
  pickup: Point;
  dropoff: Point;
  driver?: Point;
}) {
  const width = 340;
  const height = 190;
  const pad = 34;

  const points = [pickup, dropoff, ...(driver ? [driver] : [])];
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);

  // Pad the bounds so markers never sit on the frame edge, and guard the
  // degenerate case where every point shares a coordinate.
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const spanLat = Math.max(maxLat - minLat, 0.0025);
  const spanLng = Math.max(maxLng - minLng, 0.0025);

  function project(point: Point): { x: number; y: number } {
    const x = pad + ((point.longitude - minLng) / spanLng) * (width - pad * 2);
    // Latitude increases northward, which is up the screen.
    const y = height - pad - ((point.latitude - minLat) / spanLat) * (height - pad * 2);
    return { x, y };
  }

  const from = project(pickup);
  const to = project(dropoff);
  const car = driver ? project(driver) : null;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      role="img"
      aria-label={
        driver
          ? "Schematic map showing pickup, destination and the driver's position"
          : "Schematic map showing pickup and destination"
      }
      style={{
        display: "block",
        borderRadius: 24,
        background: "var(--color-neutral-200)",
        border: "1px solid var(--color-divider)",
      }}
    >
      <defs>
        <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse">
          <path
            d="M28 0H0V28"
            fill="none"
            stroke="var(--color-neutral-300)"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect width={width} height={height} fill="url(#grid)" />

      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke="var(--color-accent)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="1 9"
        opacity="0.55"
      />

      {/* Pickup — hollow ring. */}
      <circle cx={from.x} cy={from.y} r="9" fill="var(--color-bg)" stroke="var(--color-accent-700)" strokeWidth="3" />
      <text
        x={from.x}
        y={from.y - 16}
        textAnchor="middle"
        fontSize="11"
        fontFamily="var(--font-body)"
        fill="var(--color-text)"
      >
        Pickup
      </text>

      {/* Destination — solid. */}
      <circle cx={to.x} cy={to.y} r="9" fill="var(--color-accent-2-600)" />
      <text
        x={to.x}
        y={to.y + 24}
        textAnchor="middle"
        fontSize="11"
        fontFamily="var(--font-body)"
        fill="var(--color-text)"
      >
        Destination
      </text>

      {car ? (
        <g>
          <circle cx={car.x} cy={car.y} r="15" fill="var(--color-accent)" opacity="0.18" />
          <circle cx={car.x} cy={car.y} r="8" fill="var(--color-accent)" stroke="var(--color-bg)" strokeWidth="2.5" />
        </g>
      ) : null}
    </svg>
  );
}
