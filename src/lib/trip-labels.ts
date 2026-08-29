import type { TripStatus } from "./uber-rides";

/**
 * Maps a recorded trip state to what the veteran is told.
 *
 * Every label is backed by the provider's own state — nothing here promises
 * a driver, a time, or a contact that the system does not actually know about
 * (SUAS-specs MVP_REFERENCE.md §7.2).
 */

export type TripPresentation = {
  /** Short state name, shown as a tag. */
  label: string;
  /** One line saying only what is known. */
  detail: string;
  tone: "pending" | "active" | "done" | "ended";
  /** True once the trip can no longer change on its own. */
  terminal: boolean;
};

const PRESENTATION: Record<TripStatus, TripPresentation> = {
  processing: {
    label: "Searching",
    detail: "Your request was submitted. We are looking for a driver.",
    tone: "pending",
    terminal: false,
  },
  scheduled: {
    label: "Scheduled",
    detail: "Your ride is booked for later. No driver is assigned yet.",
    tone: "pending",
    terminal: false,
  },
  offered: {
    label: "Offered",
    detail: "This ride is available to claim.",
    tone: "pending",
    terminal: false,
  },
  accepted: {
    label: "Driver accepted",
    detail: "A driver accepted and is on the way to you.",
    tone: "active",
    terminal: false,
  },
  arriving: {
    label: "Driver arriving",
    detail: "Your driver is at or near the pickup point.",
    tone: "active",
    terminal: false,
  },
  in_progress: {
    label: "On the way",
    detail: "You are on your way to the destination.",
    tone: "active",
    terminal: false,
  },
  driver_redispatched: {
    label: "New driver assigned",
    detail: "The first driver cancelled. A new driver is on the way.",
    tone: "active",
    terminal: false,
  },
  completed: {
    label: "Completed",
    detail: "You have arrived. This ride is finished.",
    tone: "done",
    terminal: true,
  },
  no_drivers_available: {
    label: "No driver available",
    detail: "No driver could be found. Nothing is on the way — try again or ask for help.",
    tone: "ended",
    terminal: true,
  },
  driver_canceled: {
    label: "Driver cancelled",
    detail: "The driver cancelled. No one is currently coming for you.",
    tone: "ended",
    terminal: true,
  },
  rider_canceled: {
    label: "Cancelled",
    detail: "This ride was cancelled.",
    tone: "ended",
    terminal: true,
  },
  failed: {
    label: "Request failed",
    detail: "The request did not go through. No ride was booked.",
    tone: "ended",
    terminal: true,
  },
  expired: {
    label: "Expired",
    detail: "This ride offer is no longer available.",
    tone: "ended",
    terminal: true,
  },
};

export function present(status: TripStatus): TripPresentation {
  return (
    PRESENTATION[status] ?? {
      label: status,
      detail: "This ride is in an unrecognised state.",
      tone: "pending",
      terminal: false,
    }
  );
}

/** Tag class from the design system, so tone never rests on colour alone. */
export function tagClass(tone: TripPresentation["tone"]): string {
  switch (tone) {
    case "active":
      return "tag tag-accent-2";
    case "done":
      return "tag tag-accent-2";
    case "ended":
      return "tag tag-accent";
    default:
      return "tag tag-neutral";
  }
}
