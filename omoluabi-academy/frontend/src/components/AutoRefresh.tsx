"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Refreshes the page every few seconds while background work (a run or a render) is in progress. */
export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 2500);
    return () => clearInterval(id);
  }, [router]);
  return null;
}
