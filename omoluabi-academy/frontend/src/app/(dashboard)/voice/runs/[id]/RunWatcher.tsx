"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Refreshes the run page every few seconds while it is queued or producing. */
export function RunWatcher() {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 2500);
    return () => clearInterval(id);
  }, [router]);
  return null;
}
