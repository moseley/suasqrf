"use client";

import { useEffect, useState } from "react";
import { loadAccount, type Account } from "./account";

/**
 * Reads the stored account after mount. Server and first client render both
 * see `null`, so nothing here can cause a hydration mismatch.
 */
export function useAccount(): { account: Account | null; ready: boolean } {
  const [account, setAccount] = useState<Account | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setAccount(loadAccount());
    setReady(true);
  }, []);

  return { account, ready };
}
