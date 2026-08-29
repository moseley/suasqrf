import Link from "next/link";
import { Screen, ScreenHeader } from "@/components/screen";
import { Greeting } from "@/components/greeting";
import { AccountButton } from "@/components/account-button";
import { Car, ChevronRight, Home as HomeIcon, Utensils } from "@/components/icons";

const SERVICES = [
  {
    href: "/request/ride",
    title: "Ride",
    body: "Get a ride to an appointment or errand.",
    Icon: Car,
    tint: "var(--color-accent-100)",
    stroke: "var(--color-accent-700)",
    badge: null,
  },
  {
    href: "/request/meal",
    title: "Meal",
    body: "Request a food delivery.",
    Icon: Utensils,
    tint: "var(--color-accent-2-100)",
    stroke: "var(--color-accent-2-700)",
    badge: null,
  },
  {
    href: "/request/shelter",
    title: "Emergency Shelter",
    body: "Find a safe place tonight.",
    Icon: HomeIcon,
    tint: "var(--color-accent-100)",
    stroke: "var(--color-accent-700)",
    badge: "24/7",
  },
] as const;

/** Home — the shared entry point for the Ride, Meal and Shelter flows. */
export default function Page() {
  return (
    <Screen>
      <ScreenHeader brand right={<AccountButton />} />

      <Greeting />

      {SERVICES.map(({ href, title, body, Icon, tint, stroke, badge }) => (
        <Link className="svc-card" href={href} key={href}>
          <div className="icon-circle" style={{ background: tint }}>
            <Icon size={26} color={stroke} />
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: "0 0 2px" }}>{title}</h4>
            <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>
              {body}
            </p>
          </div>
          {badge ? (
            <span className="tag tag-outline" style={{ fontSize: 10 }}>
              {badge}
            </span>
          ) : (
            <ChevronRight size={16} />
          )}
        </Link>
      ))}
    </Screen>
  );
}
