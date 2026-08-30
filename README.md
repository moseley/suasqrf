# S.U.A.S. Q.R.F.

Veteran support coordination — a ride, a meal, or a safe place to stay.

A mobile-first Next.js app built from the *Veterans assistance app design specs*
canvas. It coordinates the shortest path between a veteran's need and a real
service: a ride from a driver or a fellow veteran, a meal, or a hotel room for
tonight.

## Getting started

```bash
npm install && npm run dev
```

Then open http://localhost:3000. Copy `.env.example` to `.env.local` first if
you want to connect any real service — everything runs without credentials, on
labelled sample data.

Sign in with **555-555-5555** for the demo account (Marcus Reyes, with a saved
home address), or connect the SUAS API for real passwordless sign-in.

## Screens

| Route | What it does |
|---|---|
| `/` | Register or sign in |
| `/home` | Choose a ride, a meal, or emergency shelter |
| `/profile` | Contact details, home address, allergies |
| `/request/ride` | Pickup, destination type-ahead, veteran-driver option |
| `/trip/[requestId]` | Live status, map, driver and vehicle |
| `/request/meal` | Delivery address and allergies |
| `/request/shelter` | Location, party size, nearby rooms, booking |

## External services

Every integration is built against the real API shapes and falls back to a
labelled stand-in when its credentials are absent, so the whole app is usable
before anything is connected.

**[docs/INTEGRATIONS.md](docs/INTEGRATIONS.md)** lists every service, what it
needs to go live, and what it does until then. In short: Veterans To Veterans is
live; Uber Direct and Amadeus are self-serve whenever you want them; Uber Guest
Rides and Vouchers are waiting on Uber approval; Yelp is the only one that costs
money.

## How it holds together

- **Nothing is claimed that is not recorded.** A status label only appears when
  the fact behind it exists — no driver is shown before one accepts, and
  contact options appear only when a reachable number does. This follows
  `MVP_REFERENCE.md` §7.2 in the SUAS specs.
- **Credentials stay server-side.** Every client module is `server-only` and is
  reached through a route under `src/app/api/`.
- **Trips carry their own state.** A trip id encodes what is needed to rebuild
  it, so a poll landing on a different serverless instance still resolves.
- **Built for the audience.** Large type, 44px-plus targets, and short paths —
  a request is meant to be a few taps under stress.

## Known gaps

The app does not yet meet the SUAS specifications it is named for. Most
significantly there are no Consent Grants, registration is self-service where
the specs mark it `FUTURE`, and location is disclosed to third-party geocoders
without a recorded basis. Treat this as a working prototype rather than the
pilot build.
