"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Screen, ScreenHeader } from "@/components/screen";
import { Check } from "@/components/icons";

/** Screen 3 — Attestation & consent. Both boxes are required to continue. */
export default function Page() {
  const router = useRouter();
  const [isVeteran, setIsVeteran] = useState(false);
  const [inPilot, setInPilot] = useState(false);

  return (
    <Screen>
      <ScreenHeader back="/register/contact" steps={{ total: 3, current: 2 }} />

      <h2 style={{ marginBottom: 0 }}>Confirm a few things</h2>

      <div className="card elev-sm" style={{ gap: 14 }}>
        <h4 style={{ margin: 0 }}>Veteran status</h4>
        <label className="big-check">
          <input
            type="checkbox"
            checked={isVeteran}
            onChange={(event) => setIsVeteran(event.target.checked)}
          />
          <span className="check-box">
            <Check size={16} />
          </span>
          <span>I attest that I am a U.S. veteran.</span>
        </label>
      </div>

      <div className="card elev-sm" style={{ gap: 14 }}>
        <h4 style={{ margin: 0 }}>Pilot program</h4>
        <p className="text-muted" style={{ fontSize: 14, margin: 0 }}>
          This app is part of a limited pilot. Your feedback may be used to improve
          services for other veterans.
        </p>
        <label className="big-check">
          <input
            type="checkbox"
            checked={inPilot}
            onChange={(event) => setInPilot(event.target.checked)}
          />
          <span className="check-box">
            <Check size={16} />
          </span>
          <span>I agree to participate in the pilot program.</span>
        </label>
      </div>

      <div className="grow" />

      <button
        className="big-btn big-btn-primary"
        type="button"
        disabled={!isVeteran || !inPilot}
        onClick={() => router.push("/register/verify")}
      >
        Continue
      </button>
      <p className="text-muted" style={{ fontSize: 12, textAlign: "center", margin: 0 }}>
        Both boxes are required to continue.
      </p>
    </Screen>
  );
}
