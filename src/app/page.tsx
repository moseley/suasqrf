"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Screen } from "@/components/screen";
import { Check, ShieldCheck } from "@/components/icons";
import { MOCK_ACCOUNT, MOCK_PHONE, isMockPhone, saveAccount } from "@/lib/account";
import { requestCode, verifyCode } from "@/app/actions/signin";

type Mode = "register" | "signin";

const COPY = {
  register: {
    heading: "Create your account",
    lede: "A ride, a meal, or a safe place to stay.",
    submit: "Create Account",
    footnote: "All fields and both attestations are required.",
  },
  signin: {
    heading: "Welcome back",
    lede: "Sign in with the email or phone you registered.",
    submit: "Sign In",
    footnote: "We'll send a one-time code — no password needed.",
  },
} as const;

/**
 * Home — mock registration / sign-in form. Nothing is submitted anywhere;
 * either mode hands off to /home once its required fields are set.
 */
export default function Page() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("register");
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<"email" | "phone">("email");
  const [contact, setContact] = useState("");
  const [isVeteran, setIsVeteran] = useState(false);
  const [inPilot, setInPilot] = useState(false);

  const registering = mode === "register";
  const copy = COPY[mode];

  const ready =
    contact.trim() !== "" &&
    (!registering || (name.trim() !== "" && isVeteran && inPilot));

  const mockMatch = !registering && channel === "phone" && isMockPhone(contact);

  // Sign-in against the SUAS API is two-stage: request a code, then verify it.
  const [stage, setStage] = useState<"entry" | "code">("entry");
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * The demo account short-circuits, and so does an unconfigured API. Anything
   * else goes to the real challenge endpoint.
   */
  async function startSignIn() {
    setBusy(true);
    setError(null);

    try {
      const result = await requestCode(contact.trim(), channel);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      if (!result.configured) {
        submit();
        return;
      }

      setNotice(result.message);
      setStage("code");
    } finally {
      setBusy(false);
    }
  }

  async function finishSignIn() {
    setBusy(true);
    setError(null);

    try {
      const result = await verifyCode(contact.trim(), code);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // The credential is in an httpOnly cookie; nothing to keep here.
      saveAccount({ name: "Veteran", [channel]: contact.trim(), isMock: false });
      router.push("/home");
    } finally {
      setBusy(false);
    }
  }

  function submit() {
    if (mockMatch) {
      saveAccount(MOCK_ACCOUNT);
    } else if (registering) {
      saveAccount({
        name: name.trim(),
        [channel]: contact.trim(),
        isMock: false,
      });
    } else {
      saveAccount({ name: "Veteran", [channel]: contact.trim(), isMock: false });
    }
    router.push("/home");
  }

  if (stage === "code") {
    return (
      <Screen>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div className="icon-circle" style={{ background: "var(--color-accent-100)" }}>
            <ShieldCheck size={26} color="var(--color-accent-700)" />
          </div>
          <div>
            <span className="tag tag-outline">VETERAN SUPPORT</span>
            <h4 style={{ margin: "6px 0 0" }}>S.U.A.S. Q.R.F.</h4>
          </div>
        </div>

        <div>
          <h2 style={{ marginBottom: 4 }}>Enter your code</h2>
          <p className="text-muted" style={{ fontSize: 16 }}>
            {notice}
          </p>
        </div>

        <div className="big-field">
          <label htmlFor="code">One-time code</label>
          <input
            id="code"
            className="big-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </div>

        {error ? (
          <p style={{ fontSize: 14, color: "var(--color-accent-700)", margin: 0 }}>{error}</p>
        ) : null}

        <div className="grow" />

        <button
          className="big-btn big-btn-primary"
          type="button"
          disabled={code.trim() === "" || busy}
          onClick={finishSignIn}
        >
          {busy ? "Checking…" : "Verify & Continue"}
        </button>
        <button
          className="btn btn-ghost"
          type="button"
          style={{ alignSelf: "center", fontSize: 15, color: "var(--color-accent-700)" }}
          onClick={() => {
            setStage("entry");
            setCode("");
            setError(null);
          }}
        >
          Use a different address
        </button>
      </Screen>
    );
  }

  return (
    <Screen>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div className="icon-circle" style={{ background: "var(--color-accent-100)" }}>
          <ShieldCheck size={26} color="var(--color-accent-700)" />
        </div>
        <div>
          <span className="tag tag-outline">VETERAN SUPPORT</span>
          <h4 style={{ margin: "6px 0 0" }}>S.U.A.S. Q.R.F.</h4>
        </div>
      </div>

      <div className="seg" style={{ width: "100%", display: "flex" }}>
        {(["register", "signin"] as const).map((option) => (
          <label
            key={option}
            className="seg-opt"
            style={{ flex: 1, justifyContent: "center", padding: 12, fontSize: 15 }}
          >
            <input
              type="radio"
              name="mode"
              checked={mode === option}
              onChange={() => setMode(option)}
            />
            {option === "register" ? "Register" : "Sign in"}
          </label>
        ))}
      </div>

      <div>
        <h2 style={{ marginBottom: 4 }}>{copy.heading}</h2>
        <p className="text-muted" style={{ fontSize: 16 }}>
          {copy.lede}
        </p>
      </div>

      {registering ? (
        <div className="big-field">
          <label htmlFor="name">Full name</label>
          <input
            id="name"
            className="big-input"
            autoComplete="name"
            placeholder="First and last name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
      ) : null}

      <div className="big-field">
        <label>How can we reach you?</label>
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
                  setContact("");
                }}
              />
              {option === "email" ? "Email" : "Phone"}
            </label>
          ))}
        </div>
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
          value={contact}
          onChange={(event) => setContact(event.target.value)}
        />
      </div>

      {registering ? (
        <div className="card elev-sm" style={{ gap: 14 }}>
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
      ) : null}

      {error ? (
        <p style={{ fontSize: 14, color: "var(--color-accent-700)", margin: 0 }}>{error}</p>
      ) : null}

      <div className="grow" />

      <button
        className="big-btn big-btn-primary"
        type="button"
        disabled={!ready || busy}
        onClick={registering || mockMatch ? submit : startSignIn}
      >
        {busy ? "Working…" : mockMatch ? `Continue as ${MOCK_ACCOUNT.name}` : copy.submit}
      </button>
      <p className="text-muted" style={{ fontSize: 12, textAlign: "center", margin: 0 }}>
        {registering ? copy.footnote : `Demo account: ${MOCK_PHONE}`}
      </p>
    </Screen>
  );
}
