"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Screen, ScreenHeader } from "@/components/screen";

/** Screen 2 — Contact info. Email or phone; only one is needed. */
export default function Page() {
  const router = useRouter();
  const [channel, setChannel] = useState<"email" | "phone">("email");
  const [value, setValue] = useState("");

  return (
    <Screen>
      <ScreenHeader back="/" steps={{ total: 3, current: 1 }} />

      <div>
        <h2 style={{ marginBottom: 8 }}>How can we reach you?</h2>
        <p className="text-muted" style={{ fontSize: 16 }}>
          Use an email or phone number. You only need one.
        </p>
      </div>

      <div className="seg" style={{ width: "100%", display: "flex" }}>
        {(["email", "phone"] as const).map((option) => (
          <label
            key={option}
            className="seg-opt"
            style={{ flex: 1, justifyContent: "center", padding: 12, fontSize: 15 }}
          >
            <input
              type="radio"
              name="channel"
              checked={channel === option}
              onChange={() => {
                setChannel(option);
                setValue("");
              }}
            />
            {option === "email" ? "Email" : "Phone"}
          </label>
        ))}
      </div>

      <div className="big-field">
        <label htmlFor="contact">
          {channel === "email" ? "Email address" : "Phone number"}
        </label>
        <input
          id="contact"
          className="big-input"
          type={channel === "email" ? "email" : "tel"}
          inputMode={channel === "email" ? "email" : "tel"}
          autoComplete={channel === "email" ? "email" : "tel"}
          placeholder={channel === "email" ? "you@example.com" : "(555) 555-0123"}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </div>

      <div className="grow" />

      <button
        className="big-btn big-btn-primary"
        type="button"
        disabled={value.trim() === ""}
        onClick={() => router.push("/register/attestation")}
      >
        Continue
      </button>
    </Screen>
  );
}
