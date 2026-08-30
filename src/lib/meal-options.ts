/**
 * Fixed choices shared by the meal request (PRD-001) and the veteran profile
 * (PRD-002). Kept in one place so a value set on the profile and one set on a
 * one-off request are always drawn from the same list.
 */

/** Multi-select on both screens. */
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

/** Single-select on both screens. */
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
