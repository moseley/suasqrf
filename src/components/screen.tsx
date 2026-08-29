import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import { ArrowLeft } from "./icons";

/** The phone-scale page frame every screen sits in. */
export function Screen({
  children,
  centered = false,
}: {
  children: ReactNode;
  centered?: boolean;
}) {
  return (
    <div
      className="phone-shell"
      style={centered ? { alignItems: "center", textAlign: "center" } : undefined}
    >
      {children}
    </div>
  );
}

/** Back chevron on the left, optional step dots centred, 44px balance on the right. */
export function ScreenHeader({
  back,
  steps,
  brand,
  right,
}: {
  back?: Route;
  steps?: { total: number; current: number };
  brand?: boolean;
  right?: ReactNode;
}) {
  return (
    <div className="scr-head">
      {back ? (
        <Link className="back-btn" href={back} aria-label="Go back">
          <ArrowLeft size={18} />
        </Link>
      ) : brand ? (
        <span style={{ fontFamily: "var(--font-heading)", fontSize: 17 }}>
          S.U.A.S. Q.R.F.
        </span>
      ) : (
        <div className="spacer-44" />
      )}

      {steps ? (
        <div className="dots" aria-label={`Step ${steps.current} of ${steps.total}`}>
          {Array.from({ length: steps.total }, (_, i) => (
            <span key={i} className={i < steps.current ? "step-dot on" : "step-dot"} />
          ))}
        </div>
      ) : null}

      {right ?? <div className="spacer-44" />}
    </div>
  );
}
