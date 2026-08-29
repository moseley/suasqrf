import Link from "next/link";
import { notFound } from "next/navigation";
import { Screen } from "@/components/screen";
import { Check } from "@/components/icons";

type Flow = "ride" | "meal" | "shelter";

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
    lede: "Your meal will arrive between 5–6 PM.",
    tint: "var(--color-accent-2-100)",
    stroke: "var(--color-accent-2-700)",
    status: { label: "In progress", className: "tag tag-accent-2" },
    rows: (params: Record<string, string>) => [
      ["Delivery to", params.address],
      ["Dietary", params.diet],
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
