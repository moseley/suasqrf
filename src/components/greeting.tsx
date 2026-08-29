"use client";

import { useAccount } from "@/lib/use-account";

/**
 * Client island on the otherwise static Home screen. Renders the generic
 * heading until the stored account is read, so the markup stays stable.
 */
export function Greeting() {
  const { account } = useAccount();
  const firstName = account?.name.split(" ")[0];

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>
        {firstName ? `What do you need, ${firstName}?` : "What do you need?"}
      </h2>
      <p className="text-muted" style={{ fontSize: 16 }}>
        Choose one to get started.
      </p>
    </div>
  );
}
