"use client";

import { useRouter } from "next/navigation";
import { useAccount } from "@/lib/use-account";
import { User } from "./icons";

/** Header avatar. Opens the profile, where the veteran can edit or sign out. */
export function AccountButton() {
  const router = useRouter();
  const { account } = useAccount();

  return (
    <button
      className="back-btn"
      type="button"
      aria-label={account ? `Signed in as ${account.name} — open your profile` : "Your profile"}
      title={account?.name}
      onClick={() => router.push("/profile")}
    >
      <User size={20} />
    </button>
  );
}
