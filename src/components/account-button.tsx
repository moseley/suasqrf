"use client";

import { useRouter } from "next/navigation";
import { clearAccount } from "@/lib/account";
import { useAccount } from "@/lib/use-account";
import { User } from "./icons";

/** Header avatar. Signing out drops the stored account and returns to the form. */
export function AccountButton() {
  const router = useRouter();
  const { account } = useAccount();

  return (
    <button
      className="back-btn"
      type="button"
      aria-label={account ? `Signed in as ${account.name} — sign out` : "Your account"}
      title={account?.name}
      onClick={() => {
        clearAccount();
        router.push("/");
      }}
    >
      <User size={20} />
    </button>
  );
}
