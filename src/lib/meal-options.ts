/**
 * The dietary and cuisine choices, shared so a value set on the profile
 * (PRD-002) and a value set on a one-off meal request (PRD-001) come from the
 * same list and look and behave identically.
 */

/** Multi-select on both the profile and the meal request. */
export const DIETARY_RESTRICTIONS = [
  "Vegetarian",
  "Vegan",
  "Halal",
  "Kosher",
  "Gluten-free",
  "Diabetic-friendly",
  "Low-sodium",
  "Dairy-free",
] as const;

/** Single-select; a dispatcher matches one kitchen at a time. */
export const CUISINES = [
  "American",
  "Italian",
  "Mexican",
  "Chinese",
  "Indian",
  "Mediterranean",
  "Soul food",
  "Comfort food",
] as const;
