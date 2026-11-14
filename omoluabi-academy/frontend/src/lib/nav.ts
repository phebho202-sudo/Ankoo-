// Single source of truth for dashboard pages: route, menu group and delivery phase.
export type PageKey =
  | "overview"
  | "episodes"
  | "rights"
  | "research"
  | "scripts"
  | "voice"
  | "video"
  | "calendar"
  | "accounts"
  | "analytics"
  | "monetisation"
  | "settings";

export type PlaceholderKey = Exclude<PageKey, "overview" | "settings">;

export type NavGroup = "main" | "content" | "production" | "distribution" | "business" | "system";

export const NAV: { key: PageKey; href: string; group: NavGroup; phase: number }[] = [
  { key: "overview", href: "/", group: "main", phase: 2 },
  { key: "episodes", href: "/episodes", group: "content", phase: 3 },
  { key: "research", href: "/research", group: "content", phase: 3 },
  { key: "rights", href: "/rights", group: "content", phase: 4 },
  { key: "scripts", href: "/scripts", group: "content", phase: 5 },
  { key: "voice", href: "/voice", group: "production", phase: 6 },
  { key: "video", href: "/video", group: "production", phase: 7 },
  { key: "calendar", href: "/calendar", group: "distribution", phase: 8 },
  { key: "accounts", href: "/accounts", group: "distribution", phase: 8 },
  { key: "analytics", href: "/analytics", group: "business", phase: 9 },
  { key: "monetisation", href: "/monetisation", group: "business", phase: 9 },
  { key: "settings", href: "/settings", group: "system", phase: 2 },
];

export const BUILT_PAGES: PageKey[] = ["overview", "settings"];

export function phaseOf(key: PageKey): number {
  return NAV.find((n) => n.key === key)!.phase;
}
