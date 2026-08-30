"use client";

import Link from "next/link";
import { useAccount } from "@/lib/use-account";
import { User } from "./icons";

/** Header avatar. Opens the profile, where sign out now lives as its own action. */
export function AccountButton() {
  const { account } = useAccount();

  return (
    <Link
      className="back-btn"
      href="/profile"
      aria-label={account ? `${account.name} — open your profile` : "Your profile"}
      title={account?.name}
    >
      <User size={20} />
    </Link>
  );
}
