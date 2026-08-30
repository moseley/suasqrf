import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import { ArrowLeft, ShieldCheck } from "./icons";

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

/**
 * The one header every screen wears: back chevron where there is somewhere to
 * go, then the brand mark, then step dots or a slot on the right.
 */
export function ScreenHeader({
  back,
  steps,
  right,
}: {
  back?: Route;
  steps?: { total: number; current: number };
  right?: ReactNode;
}) {
  return (
    <div className="scr-head">
      {back ? (
        <Link className="back-btn" href={back} aria-label="Go back">
          <ArrowLeft size={18} />
        </Link>
      ) : null}

      <div className="brand">
        <span className="brand-mark">
          <ShieldCheck size={22} color="var(--color-text)" />
        </span>
        <span className="brand-text">
          <span className="tag tag-outline brand-kicker">VETERAN SUPPORT</span>
          <span className="brand-title">S.U.A.S. Q.R.F.</span>
        </span>
      </div>

      <div className="grow" />

      {steps ? (
        <div className="dots" aria-label={`Step ${steps.current} of ${steps.total}`}>
          {Array.from({ length: steps.total }, (_, i) => (
            <span key={i} className={i < steps.current ? "step-dot on" : "step-dot"} />
          ))}
        </div>
      ) : null}

      {right ?? null}
    </div>
  );
}
