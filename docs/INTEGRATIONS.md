# Integrations

Every external service this app talks to, what it needs to go live, and what it
does until then.

## The pattern

Each integration is built against the **real request and response shapes** and
falls back to a stand-in when its credentials are absent. Connecting a service
is a matter of setting environment variables — no code changes.

Three rules hold everywhere:

1. **Credentials never reach the browser.** Every client module is marked
   `server-only` and is reached through a route under `src/app/api/`.
2. **A stand-in says so.** Sample data is labelled in the response (`sample:
   true`, `mock: true`, `configured: false`) and the surface repeats it in
   words. Nothing invented is ever presented as real.
3. **Failure routes to a person.** No rooms, no driver, a refused booking, an
   unresolvable address — each falls through to human coordination rather than
   guessing or blocking.

## Status at a glance

| Service | Purpose | Access | Now |
|---|---|---|---|
| [Veterans To Veterans](#veterans-to-veterans) | Veteran-driver rides | Internal | **Live** |
| [SUAS API](#suas-api) | Passwordless sign-in | Self-hosted | Ready — needs a base URL |
| [Uber Guest Rides](#uber-guest-rides) | Rides for non-account holders | **Uber approval** | Stand-in |
| [Uber Direct](#uber-direct) | Courier for meal delivery | Self-serve | Not connected |
| [Uber Vouchers](#uber-vouchers) | Funds a meal | **Uber approval** | Stand-in |
| [Amadeus](#amadeus) | Hotel search and booking | Self-serve (free test) | Stand-in |
| [Yelp Fusion](#yelp-fusion) | Nearest open kitchen | **Paid, no free tier** | Stand-in |
| [Nominatim](#openstreetmap-services) | Geocoding | Keyless | Live |
| [Photon](#openstreetmap-services) | Destination type-ahead | Keyless | Live |
| [OSRM](#openstreetmap-services) | Driving route geometry | Keyless | Live |
| [OSM tiles](#openstreetmap-services) | Map imagery | Keyless | Live |

**Blocked on someone else:** Guest Rides and Vouchers both need scopes granted
by an Uber representative — the same conversation. **Costs money:** Yelp only.
**Free and self-serve:** Uber Direct and Amadeus, today.

---

## Veterans To Veterans

Matches a veteran driver when *Request a veteran driver* is ticked.

- **Module** `src/lib/veteran-rides.ts` · **Route** `POST /api/rides`
- `POST {base}/api/v1/ride-requests` with an `Idempotency-Key`, carrying
  `rider`, `currentAddress`, `destinationAddress`, `durationMinutes`,
  `maxDistanceKm`. Returns `status`, `veteran` (name, `carModel`,
  `licensePlate`) and `booking.status`.
- **Env** `VETERAN_RIDES_API_URL`, `VETERAN_RIDES_API_KEY` (optional)

Two constraints worth knowing. The API returns **no id of its own and has no
read endpoint**, so the match is encoded into the trip id and the status screen
shows what was recorded at match time — it does not update afterwards. And a
match depends on a veteran having an **open availability slot**; without one the
response is `no_match`, which the UI reports as "no driver available".

## SUAS API

Passwordless sign-in against `scrimshawlife-ctrl/suas`.

- **Module** `src/lib/suas-api.ts` · **Actions** `src/app/actions/signin.ts`
- `POST /api/v0/auth/challenges` then
  `POST /api/v0/auth/challenges/commands/verify`
- **Env** `SUAS_API_BASE_URL`, `SUAS_TENANT_ID`

The session credential lives in an httpOnly cookie and never reaches client
JavaScript. The challenge response is deliberately uniform so the surface cannot
be used to enumerate veterans — only a 503 channel failure is reported
differently.

Unset, sign-in falls back to the demo account on `555-555-5555`.

## Uber Guest Rides

Books a ride for someone without an Uber account.

- **Module** `src/lib/uber-rides.ts`, sandbox controls in `uber-sandbox.ts`
- `POST /v1/guests/trips/estimates`, `POST /v1/guests/trips`,
  `GET /v1/guests/trips/{id}`
- **Env** `UBER_RIDES_CLIENT_ID`, `UBER_RIDES_CLIENT_SECRET`,
  `UBER_RIDES_ORG_ID`, `UBER_RIDES_SANDBOX_RUN_ID`

> **Needs approval.** The `guests.trips` scope is not self-serve. Uber support
> must grant it *and* whitelist the app, or `sandbox-api.uber.com` answers 401.

Until then `UBER_RIDES_MOCK=1` serves a local stand-in that advances a trip
through Uber's own status vocabulary on a clock, with the driver following real
road geometry. Set that variable in every environment, including Vercel.

## Uber Direct

Courier dispatch — moves food someone has already bought.

- **Module** `src/lib/uber.ts` · **Route** `POST /api/deliveries`
- `POST /v1/customers/{customer_id}/deliveries`
- **Env** `UBER_CUSTOMER_ID`, `UBER_CLIENT_ID`, `UBER_CLIENT_SECRET`,
  `UBER_PICKUP_NAME`, `UBER_PICKUP_ADDRESS`, `UBER_PICKUP_PHONE`

Self-serve: sign up at [direct.uber.com](https://direct.uber.com) and take the
credentials from Management → Developer. Sandbox credentials never dispatch a
real courier, and **Robocourier** (`test_specifications`) simulates a delivery
end to end in about two and a half minutes.

Two cautions. Direct uses the **same host for sandbox and production** — only the
credentials differ, so nothing in a URL tells you which world you are in. And it
needs a **pickup address**: Direct is a courier network, not a restaurant.

## Uber Vouchers

Funds a capped meal credit.

- **Module** `src/lib/uber-vouchers.ts` · **Route** `POST /api/meals/voucher`
- `POST /v1/organizations/{org}/voucher-programs` with `voucher_type: "EATS"`,
  `code_scheme: "MULTI_CODE_SINGLE_REDEEM"`, `value_per_trip_max_amount`
- **Env** `UBER_VOUCHERS_CLIENT_ID`, `UBER_VOUCHERS_CLIENT_SECRET`,
  `UBER_ORG_ID`, `UBER_VOUCHERS_CREATOR_EMAIL`

> **Needs approval.** The `organizations.voucher_programs` scope requires
> approved u4b organization access through an Uber representative.

Unset, it issues codes prefixed `SAMPLE-MEAL-`. Note a voucher hands the
*choice* to the recipient — it funds a meal, it does not order one.

## Amadeus

Hotels near a shelter request, and booking a room for tonight.

- **Module** `src/lib/amadeus.ts` · **Routes** `POST /api/shelter`,
  `POST /api/shelter/book`
- `GET /v1/reference-data/locations/hotels/by-geocode` (25-mile radius),
  `GET /v3/shopping/hotel-offers`, `POST /v2/booking/hotel-orders`
- **Env** `AMADEUS_CLIENT_ID`, `AMADEUS_CLIENT_SECRET`, `AMADEUS_ENV`

Self-serve and free to test: a key from
[developers.amadeus.com](https://developers.amadeus.com) works immediately
against `test.api.amadeus.com`.

**Booking needs a payment card**, even in test. Card details are read from
`AMADEUS_PAYMENT_VENDOR` / `_CARD` / `_EXPIRY` / `_HOLDER` and are never
committed; without them booking is **refused rather than faked**. Use Amadeus
test card values only. Whether a real pilot pays by card or by voucher is an
open product decision.

The Booking v2 leaf field names were taken from Amadeus's own SDKs rather than
their docs, which are JavaScript-rendered and could not be read directly. Verify
`guests[]` and `paymentCard` on the first real call.

## Yelp Fusion

The nearest open, affordable kitchen for a meal request.

- **Module** `src/lib/yelp.ts` · **Route** `POST /api/meals/plan`
- `GET /v3/businesses/search` with `sort_by=distance`, `price=1,2`,
  `open_now=true`, and categories that can cook a plain grilled protein
- **Env** `YELP_API_KEY`

> **Paid.** Yelp ended free API access; plans start around $8 per 1000 calls.

Unset, the plan returns one clearly-labelled sample property.

## OpenStreetMap services

Keyless, no signup, used directly.

| Service | Used for | Module |
|---|---|---|
| Nominatim | Address → coordinates, and back | `src/lib/geocode.ts` |
| Photon | Destination type-ahead, distance-ranked | `src/lib/geocode.ts` |
| OSRM demo | Driving geometry for the trip map | `src/lib/route.ts` |
| Tile server | Map imagery | `src/components/trip-map.tsx` |

> **All four are donated infrastructure.** Their usage policies cover
> development and a small pilot, not production load. Each has a single constant
> to change when moving to a paid provider or a self-hosted instance.

Geocoding results are cached, and type-ahead is debounced, to stay within
Nominatim's one-request-per-second guidance.

## What no API does

**No public API places a consumer food order.** Uber Eats and DoorDash
Marketplace are merchant-side, Drive and Direct are courier-side, and ezCater's
public API is for restaurants. A person places the order, or the organisation
becomes the kitchen.

This matters for the meal templates in `src/lib/meal-menu.ts`, which specify no
soy marinade, rice noodles rather than wheat, oil and salt only. **None of that
can be guaranteed from an arbitrary restaurant** through a delivery API, or even
verified. A partner kitchen is the only route that makes those instructions
real.

## Environment variables

`.env.example` lists every variable with notes. Copy it to `.env.local` for
local work and set the same keys in Vercel — remembering that **Vercel reads
environment variables at build time**, so a change needs a redeploy.
