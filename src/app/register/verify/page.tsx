"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Screen, ScreenHeader } from "@/components/screen";

const LENGTH = 6;

/** Screen 4 — Verify. Six single-character cells that advance as you type. */
export default function Page() {
  const router = useRouter();
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(""));
  const cells = useRef<(HTMLInputElement | null)[]>([]);

  function setDigit(index: number, raw: string) {
    const digit = raw.replace(/\D/g, "").slice(-1);
    setDigits((previous) => {
      const next = [...previous];
      next[index] = digit;
      return next;
    });
    if (digit && index < LENGTH - 1) cells.current[index + 1]?.focus();
  }

  function onKeyDown(index: number, key: string) {
    if (key === "Backspace" && digits[index] === "" && index > 0) {
      cells.current[index - 1]?.focus();
    }
  }

  const complete = digits.every((digit) => digit !== "");

  return (
    <Screen>
      <ScreenHeader back="/register/attestation" steps={{ total: 3, current: 3 }} />

      <div>
        <h2 style={{ marginBottom: 8 }}>Verify your email</h2>
        <p className="text-muted" style={{ fontSize: 16 }}>
          Enter the {LENGTH}-digit code we sent you.
        </p>
      </div>

      <div className="code-row">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(element) => {
              cells.current[index] = element;
            }}
            className="code-cell"
            style={index === 0 && digit === "" ? { borderColor: "var(--color-accent)" } : undefined}
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={1}
            aria-label={`Digit ${index + 1}`}
            value={digit}
            onChange={(event) => setDigit(index, event.target.value)}
            onKeyDown={(event) => onKeyDown(index, event.key)}
          />
        ))}
      </div>

      <div className="grow" />

      <button
        className="big-btn big-btn-primary"
        type="button"
        disabled={!complete}
        onClick={() => router.push("/home")}
      >
        Verify &amp; Continue
      </button>
      <button
        className="btn btn-ghost"
        type="button"
        style={{ alignSelf: "center", fontSize: 15, color: "var(--color-accent-700)" }}
      >
        Resend code
      </button>
    </Screen>
  );
}
