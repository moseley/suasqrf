import "server-only";

/**
 * Yelp Fusion — finds the nearest place that is open now and in the lower
 * price bands.
 *
 * The veteran does not browse: this picks the closest match so a request is
 * one tap. Server-only, since the key must not reach the browser.
 *
 * Yelp ended free access, so without a key this returns clearly-marked sample
 * places and the surface says they are samples.
 *
 * Docs: https://docs.developer.yelp.com/docs/getting-started
 */

const SEARCH_URL = "https://api.yelp.com/v3/businesses/search";

/** Cheap and moderate only. */
const PRICE_BANDS = "1,2";

/** Metres. Yelp caps radius at 40000. */
const SEARCH_RADIUS_M = 8000;

export type Restaurant = {
  id: string;
  name: string;
  address: string;
  phone?: string;
  /** Miles from the delivery address. */
  distanceMiles?: number;
  price?: string;
  rating?: number;
  categories: string[];
  sample?: boolean;
};

type YelpResponse = {
  businesses?: Array<{
    id: string;
    name: string;
    location?: { display_address?: string[] };
    display_phone?: string;
    phone?: string;
    /** Metres. */
    distance?: number;
    price?: string;
    rating?: number;
    categories?: Array<{ title: string }>;
    is_closed?: boolean;
  }>;
};

/**
 * Categories that can plausibly cook a plain grilled protein with rice and
 * steamed vegetables. A place that cannot is worse than a slightly further one.
 */
const CATEGORIES = "tradamerican,newamerican,mediterranean,greek,halal,hawaiian,latin,peruvian";

const SAMPLE: Restaurant[] = [
  {
    id: "sample-grill",
    name: "Sample Grill & Rice",
    address: "Sample address near you",
    distanceMiles: 0.8,
    price: "$",
    rating: 4.3,
    categories: ["Traditional American"],
    sample: true,
  },
];

/**
 * The nearest open, affordable place. Returns null rather than throwing, so a
 * meal request can fall through to human coordination.
 */
export async function findNearestOpen(
  latitude: number,
  longitude: number,
): Promise<{ configured: boolean; restaurant: Restaurant | null }> {
  const apiKey = process.env.YELP_API_KEY;
  if (!apiKey) return { configured: false, restaurant: SAMPLE[0] };

  try {
    const query = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      radius: String(SEARCH_RADIUS_M),
      categories: CATEGORIES,
      price: PRICE_BANDS,
      open_now: "true",
      // Nearest first: the veteran is waiting, and a shorter trip is a hotter meal.
      sort_by: "distance",
      limit: "5",
    });

    const response = await fetch(`${SEARCH_URL}?${query}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("Yelp search failed", response.status, await response.text());
      return { configured: true, restaurant: null };
    }

    const body = (await response.json()) as YelpResponse;
    const first = (body.businesses ?? []).find((business) => business.is_closed !== true);
    if (!first) return { configured: true, restaurant: null };

    return {
      configured: true,
      restaurant: {
        id: first.id,
        name: first.name,
        address: (first.location?.display_address ?? []).join(", "),
        phone: first.display_phone || first.phone,
        distanceMiles:
          typeof first.distance === "number"
            ? Number((first.distance / 1609.34).toFixed(1))
            : undefined,
        price: first.price,
        rating: first.rating,
        categories: (first.categories ?? []).map((category) => category.title),
      },
    };
  } catch (error) {
    console.error("Yelp search error", error);
    return { configured: true, restaurant: null };
  }
}
