import "server-only";

import type { LatLng } from "./uber-rides";

/**
 * Driving route geometry between two points.
 *
 * Uses the public OSRM demo server, which needs no API key. Like the OSM tile
 * service it is fine for development and a small pilot but not for real load —
 * swap ENDPOINT for a hosted OSRM, Valhalla, or a commercial routing API when
 * that day comes. Nothing outside this module needs to change.
 *
 * Returns null on any failure: a missing route degrades the map to a straight
 * line rather than breaking the screen.
 */

const ENDPOINT = "https://router.project-osrm.org/route/v1/driving";

/** Routes are stable for a given pair, so one lookup serves every poll. */
const cache = new Map<string, LatLng[]>();

function key(from: LatLng, to: LatLng): string {
  return `${from.latitude},${from.longitude};${to.latitude},${to.longitude}`;
}

export async function getRoute(from: LatLng, to: LatLng): Promise<LatLng[] | null> {
  const cached = cache.get(key(from, to));
  if (cached) return cached;

  const path = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
  const url = `${ENDPOINT}/${path}?overview=full&geometries=geojson`;

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;

    const body = (await response.json()) as {
      routes?: Array<{ geometry?: { coordinates?: [number, number][] } }>;
    };

    const coordinates = body.routes?.[0]?.geometry?.coordinates;
    if (!coordinates || coordinates.length === 0) return null;

    // GeoJSON is [longitude, latitude]; the rest of the app is the other way.
    const route = coordinates.map(([longitude, latitude]) => ({ latitude, longitude }));
    cache.set(key(from, to), route);
    return route;
  } catch {
    return null;
  }
}

/**
 * A point a given fraction along the route, measured by accumulated distance
 * so the pace is even rather than jumping between densely mapped corners.
 */
export function pointAlong(route: LatLng[], fraction: number): LatLng {
  if (route.length === 1) return route[0];

  const legs: number[] = [];
  let total = 0;
  for (let i = 1; i < route.length; i++) {
    const dx = route[i].longitude - route[i - 1].longitude;
    const dy = route[i].latitude - route[i - 1].latitude;
    const length = Math.hypot(dx, dy);
    legs.push(length);
    total += length;
  }

  if (total === 0) return route[0];

  let target = Math.min(1, Math.max(0, fraction)) * total;
  for (let i = 0; i < legs.length; i++) {
    if (target <= legs[i]) {
      const t = legs[i] === 0 ? 0 : target / legs[i];
      return {
        latitude: route[i].latitude + (route[i + 1].latitude - route[i].latitude) * t,
        longitude: route[i].longitude + (route[i + 1].longitude - route[i].longitude) * t,
      };
    }
    target -= legs[i];
  }

  return route[route.length - 1];
}
