import "server-only";

import { createMockProvider } from "./mock-trips";

/**
 * Local stand-in for Uber Guest Rides, for use while the guests.trips scope is
 * still pending approval. Same Trip shape and status vocabulary as the real
 * API, so swapping back is a config change rather than a rewrite.
 *
 * Enable with UBER_RIDES_MOCK=1.
 */

export function isMockEnabled(): boolean {
  return process.env.UBER_RIDES_MOCK === "1";
}

export const uberMock = createMockProvider({
  prefix: "mock",
  provider: "Uber",
  drivers: [
    { name: "Dana W.", phone: "+14155550188", make: "Toyota", model: "Prius", plate: "7XKD432", color: "Silver" },
    { name: "Luis R.", phone: "+14155550149", make: "Honda", model: "Accord", plate: "8ABC211", color: "Black" },
    { name: "Priya N.", phone: "+14155550170", make: "Ford", model: "Escape", plate: "6TRW905", color: "Blue" },
  ],
});

export const createMockTrip = uberMock.create;
export const getMockTrip = uberMock.get;
export const setMockStatus = uberMock.setStatus;
export const resumeMockTrip = uberMock.resume;
