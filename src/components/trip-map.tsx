"use client";

type Point = { latitude: number; longitude: number };

/**
 * Route map over OpenStreetMap tiles — real roads and buildings, no API key
 * and no mapping library.
 *
 * Tiles are plain <img> elements laid out by Web Mercator maths and anchored
 * to the container's centre, so the component needs no width measurement and
 * works at any screen size. The map is deliberately not pannable: this is a
 * status view, not an explorer.
 *
 * Note: tile.openstreetmap.org is fine for development and a small pilot, but
 * the OSMF usage policy rules out heavy or commercial traffic. Move to a paid
 * tile provider (or your own cache) before this carries real load — only the
 * TILE_URL below needs to change.
 */

const TILE_SIZE = 256;
const MIN_ZOOM = 10;
const MAX_ZOOM = 17;

/** Tiles either side of centre. 5 across × 3 down covers ~1280×768 px. */
const SPAN_X = 2;
const SPAN_Y = 1;

const TILE_URL = (z: number, x: number, y: number) =>
  `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;

/** Fractional tile coordinates — the whole-number part is the tile, the rest the offset. */
function project(point: Point, zoom: number): { x: number; y: number } {
  const n = 2 ** zoom;
  const lat = (point.latitude * Math.PI) / 180;
  return {
    x: ((point.longitude + 180) / 360) * n,
    y: ((1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2) * n,
  };
}

/** Largest zoom at which every point still fits inside the visible box. */
function fitZoom(points: Point[], boxWidth: number, boxHeight: number): number {
  for (let zoom = MAX_ZOOM; zoom > MIN_ZOOM; zoom--) {
    const projected = points.map((point) => project(point, zoom));
    const xs = projected.map((p) => p.x);
    const ys = projected.map((p) => p.y);
    const width = (Math.max(...xs) - Math.min(...xs)) * TILE_SIZE;
    const height = (Math.max(...ys) - Math.min(...ys)) * TILE_SIZE;
    if (width <= boxWidth && height <= boxHeight) return zoom;
  }
  return MIN_ZOOM;
}

export function TripMap({
  pickup,
  dropoff,
  driver,
}: {
  pickup: Point;
  dropoff: Point;
  driver?: Point;
}) {
  const height = 220;
  const points = [pickup, dropoff, ...(driver ? [driver] : [])];

  const zoom = fitZoom(points, 250, height - 80);
  const centre: Point = {
    latitude: (Math.min(...points.map((p) => p.latitude)) + Math.max(...points.map((p) => p.latitude))) / 2,
    longitude: (Math.min(...points.map((p) => p.longitude)) + Math.max(...points.map((p) => p.longitude))) / 2,
  };

  const centreTile = project(centre, zoom);

  /** Pixel offset of a point from the container's centre. */
  function offset(point: Point): { dx: number; dy: number } {
    const projected = project(point, zoom);
    return {
      dx: (projected.x - centreTile.x) * TILE_SIZE,
      dy: (projected.y - centreTile.y) * TILE_SIZE,
    };
  }

  const originTile = { x: Math.floor(centreTile.x), y: Math.floor(centreTile.y) };
  const tiles: Array<{ key: string; url: string; dx: number; dy: number }> = [];

  for (let ix = -SPAN_X; ix <= SPAN_X; ix++) {
    for (let iy = -SPAN_Y; iy <= SPAN_Y; iy++) {
      const tileX = originTile.x + ix;
      const tileY = originTile.y + iy;
      const limit = 2 ** zoom;
      if (tileY < 0 || tileY >= limit) continue;
      // Wrap horizontally so the map still renders across the date line.
      const wrappedX = ((tileX % limit) + limit) % limit;

      tiles.push({
        key: `${tileX}-${tileY}`,
        url: TILE_URL(zoom, wrappedX, tileY),
        dx: (tileX - centreTile.x) * TILE_SIZE,
        dy: (tileY - centreTile.y) * TILE_SIZE,
      });
    }
  }

  const from = offset(pickup);
  const to = offset(dropoff);
  const car = driver ? offset(driver) : null;

  const marker = (dx: number, dy: number): React.CSSProperties => ({
    position: "absolute",
    left: "50%",
    top: "50%",
    transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`,
  });

  return (
    <div
      role="img"
      aria-label={
        driver
          ? "Map showing pickup, destination and the driver's position"
          : "Map showing pickup and destination"
      }
      style={{
        position: "relative",
        height,
        borderRadius: 24,
        overflow: "hidden",
        border: "1px solid var(--color-divider)",
        background: "var(--color-neutral-200)",
      }}
    >
      {tiles.map((tile) => (
        // eslint-disable-next-line @next/next/no-img-element -- remote tiles, no optimisation wanted
        <img
          key={tile.key}
          src={tile.url}
          alt=""
          width={TILE_SIZE}
          height={TILE_SIZE}
          // The map is the top of the screen, so lazy loading only delays it.
          loading="eager"
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: `translate(${tile.dx}px, ${tile.dy}px)`,
            // Warms the tiles toward the app's palette without hiding detail.
            filter: "saturate(0.75) contrast(0.95)",
          }}
        />
      ))}

      {/* Straight line between the two ends — not a driven route. */}
      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        aria-hidden="true"
      >
        <line
          x1={`calc(50% + ${from.dx}px)`}
          y1={`calc(50% + ${from.dy}px)`}
          x2={`calc(50% + ${to.dx}px)`}
          y2={`calc(50% + ${to.dy}px)`}
          stroke="var(--color-accent)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="1 10"
          opacity="0.9"
        />
      </svg>

      {/* Pickup — hollow ring. */}
      <div
        style={{
          ...marker(from.dx, from.dy),
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "var(--color-bg)",
          border: "4px solid var(--color-accent-700)",
          boxShadow: "var(--shadow-sm)",
        }}
      />

      {/* Destination — solid. */}
      <div
        style={{
          ...marker(to.dx, to.dy),
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "var(--color-accent-2-600)",
          border: "3px solid var(--color-bg)",
          boxShadow: "var(--shadow-sm)",
        }}
      />

      {car ? (
        <div
          style={{
            ...marker(car.dx, car.dy),
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: "color-mix(in srgb, var(--color-accent) 30%, transparent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: "var(--color-accent)",
              border: "3px solid var(--color-bg)",
              boxShadow: "var(--shadow-md)",
            }}
          />
        </div>
      ) : null}

      <span
        style={{
          position: "absolute",
          right: 0,
          bottom: 0,
          padding: "2px 7px",
          fontSize: 10,
          color: "var(--color-neutral-800)",
          background: "color-mix(in srgb, var(--color-bg) 82%, transparent)",
          borderTopLeftRadius: 8,
        }}
      >
        © OpenStreetMap
      </span>
    </div>
  );
}
