/**
 * Fixed choices shared by the meal request (PRD-001) and the veteran profile
 * (PRD-002). Kept in one place so a value set on the profile and one set on a
 * one-off request are always drawn from the same list.
 */

/** Multi-select allergens (the FDA "big 9"). */
export const ALLERGENS = [
  "Milk",
  "Eggs",
  "Fish",
  "Shellfish",
  "Tree nuts",
  "Peanuts",
  "Wheat",
  "Soy",
  "Sesame",
] as const;

