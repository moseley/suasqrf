/**
 * The standing meal templates a request is filled from.
 *
 * These are chosen for the veteran rather than browsed: each is plain,
 * balanced, and built to avoid the FDA "big 9" allergens. `contains` lists the
 * allergens a template genuinely carries, so a veteran's own allergy chips can
 * rule one out — an empty list means it clears all of them.
 *
 * Kept deliberately short and specific. A kitchen must be able to read one and
 * make exactly that, with no marinade or sauce improvisation.
 */

export type MealTemplate = {
  id: string;
  name: string;
  /** What the kitchen is told to make, verbatim. */
  instructions: string;
  /** Allergens present, from the ALLERGENS list. */
  contains: string[];
  vegetarian: boolean;
};

export const MEAL_TEMPLATES: MealTemplate[] = [
  {
    id: "chicken-rice-veg",
    name: "Grilled chicken, rice and steamed vegetables",
    instructions:
      "Grilled chicken breast, white or brown rice, steamed broccoli and carrots. " +
      "Olive or vegetable oil, salt and pepper only. No marinade or sauce.",
    contains: [],
    vegetarian: false,
  },
  {
    id: "beef-turkey-rice-beans",
    name: "Plain beef or turkey, rice and green beans",
    instructions:
      "Plain beef or turkey with no soy or teriyaki marinade, rice, and steamed " +
      "green beans. Oil, salt and pepper only.",
    contains: [],
    vegetarian: false,
  },
  {
    id: "beans-rice-veg",
    name: "Black beans or lentils, rice and steamed vegetables",
    instructions:
      "Black beans or lentils, rice, and steamed vegetables. No soy sauce. " +
      "Oil, salt and pepper only.",
    contains: [],
    vegetarian: true,
  },
  {
    id: "chicken-rice-noodles",
    name: "Grilled chicken, rice noodles and steamed vegetables",
    instructions:
      "Grilled chicken with rice noodles — not wheat noodles — and steamed " +
      "vegetables. No soy sauce. Oil, salt and pepper only.",
    contains: [],
    vegetarian: false,
  },
  {
    id: "potato-protein-veg",
    name: "Baked potato, protein and steamed vegetables",
    instructions:
      "Plain baked potato with grilled chicken or beans, and steamed vegetables. " +
      "No butter or dairy topping. Oil, salt and pepper only.",
    contains: [],
    vegetarian: false,
  },
];

/**
 * The first template that carries none of the veteran's allergens.
 *
 * Returns null rather than a guess when every template is ruled out, so the
 * caller can route to a person instead of sending something unsafe.
 */
export function chooseMeal(allergies: string[]): MealTemplate | null {
  const avoid = allergies.map((entry) => entry.toLowerCase().trim());

  return (
    MEAL_TEMPLATES.find(
      (template) =>
        !template.contains.some((allergen) => avoid.includes(allergen.toLowerCase())),
    ) ?? null
  );
}
