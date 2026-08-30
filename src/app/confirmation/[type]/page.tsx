import Link from "next/link";
import { notFound } from "next/navigation";
import { Screen } from "@/components/screen";
import { Check } from "@/components/icons";

type Flow = "ride" | "meal" | "shelter";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Renders the meal `when` parameter. Empty or "ASAP" reads as immediate;
 * otherwise it is an ISO local date-time (e.g. 2026-09-02T18:00), formatted
 * from its parts so no timezone can shift the hour the veteran picked.
 */
function formatWhen(value: string): string {
  if (!value || value === "ASAP") return "As soon as possible";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return value;
  const [, year, month, day, hourText, minute] = match;
  let hour = Number(hourText);
  const meridiem = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${MONTHS[Number(month) - 1]} ${Number(day)}, ${year}, ${hour}:${minute} ${meridiem}`;
}

const FLOWS = {
  ride: {
    prefix: "RQ",
    heading: "Ride requested",
    lede: "A driver will contact you within 30 minutes.",
    tint: "var(--color-accent-2-100)",
    stroke: "var(--color-accent-2-700)",
    status: { label: "In progress", className: "tag tag-accent-2" },
    rows: (params: Record<string, string>) => [
      ["Pickup", params.pickup],
      ["Drop-off", params.dropoff],
    ],
  },
  meal: {
    prefix: "MD",
    heading: "Meal requested",
    lede: "We'll confirm your delivery time shortly.",
    tint: "var(--color-accent-2-100)",
    stroke: "var(--color-accent-2-700)",
    status: { label: "In progress", className: "tag tag-accent-2" },
    rows: (params: Record<string, string>) => [
      ["Delivery to", params.address],
      ["When", formatWhen(params.when)],
      ["Dietary", params.diet ? params.diet.split(",").join(", ") : ""],
      ["Cuisine", params.cuisine],
      ["Allergies", params.allergies],
      ["Phone", params.phone],
      ["Instructions", params.instructions],
    ],
  },
  shelter: {
    prefix: "ES",
    heading: "Shelter request received",
    lede: "A caseworker will call you within 15 minutes to confirm shelter for tonight.",
    tint: "var(--color-accent-100)",
    stroke: "var(--color-accent-700)",
    status: { label: "Urgent", className: "tag tag-accent" },
    rows: (params: Record<string, string>) => [
      ["Location", params.location],
      ["People", params.people],
      ["Property", params.hotel],
    ],
  },
} satisfies Record<Flow, unknown>;

function isFlow(value: string): value is Flow {
  return value in FLOWS;
}

/** Step C for every flow — the request receipt. */
export default async function Page({
  params,
  searchParams,
}: PageProps<"/confirmation/[type]">) {
  const { type } = await params;
  if (!isFlow(type)) notFound();

  const flow = FLOWS[type];
  const query = await searchParams;
  const values = Object.fromEntries(
    Object.entries(query).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value ?? ""]),
  ) as Record<string, string>;

  const reference = `#${flow.prefix}-${1000 + Math.floor(Math.random() * 9000)}`;

  return (
    <Screen centered>
      <div className="grow" />

      <div className="icon-circle" style={{ width: 88, height: 88, background: flow.tint }}>
        <Check size={40} color={flow.stroke} />
      </div>

      <h2 style={{ margin: "18px 0 4px" }}>{flow.heading}</h2>
      <p className="text-muted" style={{ fontSize: 16, maxWidth: 280 }}>
        {flow.lede}
      </p>

      <div
        className="card elev-sm"
        style={{ width: "100%", textAlign: "left", gap: 10, marginTop: 8 }}
      >
        {flow.rows(values).map(([label, value]) =>
          value ? (
            <div className="summary-row" key={label}>
              <span className="text-muted">{label}</span>
              <span>{value}</span>
            </div>
          ) : null,
        )}
        <div className="summary-row">
          <span className="text-muted">Reference</span>
          <span>{reference}</span>
        </div>
        <span className={flow.status.className} style={{ alignSelf: "flex-start" }}>
          {flow.status.label}
        </span>
      </div>

      <div className="grow" />

      <Link className="big-btn big-btn-secondary" href="/home">
        Back to Home
      </Link>
    </Screen>
  );
}
