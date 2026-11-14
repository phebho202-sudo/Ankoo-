import { describe, expect, it } from "vitest";
import { en, yo } from "./dictionaries";
import { fmt, isLocale } from "./format";
import { NAV } from "../nav";

type Leaf = [path: string, value: string];

function leaves(obj: unknown, prefix = ""): Leaf[] {
  if (typeof obj === "string") return [[prefix, obj]];
  if (Array.isArray(obj)) return obj.flatMap((v, i) => leaves(v, `${prefix}[${i}]`));
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    leaves(v, prefix ? `${prefix}.${k}` : k),
  );
}

const enLeaves = new Map(leaves(en));
const yoLeaves = new Map(leaves(yo));
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("dictionaries", () => {
  it("have exactly the same keys in English and Yoruba", () => {
    expect([...yoLeaves.keys()].sort()).toEqual([...enLeaves.keys()].sort());
  });

  it("have no empty strings", () => {
    for (const [path, value] of [...enLeaves, ...yoLeaves]) {
      expect(value.trim(), path).not.toBe("");
    }
  });

  it("use the same {placeholders} in both languages", () => {
    for (const [path, value] of enLeaves) {
      expect(placeholders(yoLeaves.get(path)!), path).toEqual(placeholders(value));
    }
  });

  it("store Yoruba text in NFC form so tone marks render and compare consistently", () => {
    for (const [path, value] of yoLeaves) {
      expect(value, path).toBe(value.normalize("NFC"));
    }
  });

  it("actually translate the interface (not English copied into Yoruba)", () => {
    const same = [...enLeaves].filter(([p, v]) => yoLeaves.get(p) === v).map(([p]) => p);
    // Only proper names and technical terms may stay identical.
    expect(same.sort()).toEqual(
      [
        "common.appName",
        "common.english",
        "common.yoruba",
        "overview.api",
        "rights.platformNames.youtube",
        "rights.platformNames.facebook",
        "rights.platformNames.instagram",
        "rights.platformNames.tiktok",
      ].sort(),
    );
  });

  it("label every navigation entry and describe every placeholder page", () => {
    for (const item of NAV) {
      expect(en.nav[item.key]).toBeTruthy();
      expect(yo.nav[item.key]).toBeTruthy();
      if (!["overview", "settings", "episodes", "research", "rights"].includes(item.key)) {
        const k = item.key as keyof typeof en.pages;
        expect(yo.pages[k].safeguards.length).toBe(en.pages[k].safeguards.length);
      }
    }
  });

  it("label every backend setting in both languages", () => {
    const keys = [
      "budget.monthly_limit_usd",
      "budget.alert_threshold_percent",
      "budget.max_cost_per_video_usd",
      "budget.max_avatar_minutes_per_month",
      "budget.max_retries_per_job",
      "storage.max_storage_gb",
      "publishing.auto_publish_enabled",
      "publishing.required_approved_videos",
      "publishing.default_visibility",
      "production.default_video_format",
      "discovery.max_videos_per_scan",
    ];
    for (const k of keys) {
      expect(en.settings.labels[k], k).toBeTruthy();
      expect(yo.settings.labels[k], k).toBeTruthy();
      expect(yo.settings.help[k], k).toBeTruthy();
    }
  });
});

describe("format helpers", () => {
  it("fills placeholders and leaves unknown ones visible", () => {
    expect(fmt("Ìpele {n}", { n: 3 })).toBe("Ìpele 3");
    expect(fmt("{a} {b}", { a: "x" })).toBe("x {b}");
  });

  it("validates locales", () => {
    expect(isLocale("yo")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe("formatDateTime", () => {
  it("shows Lagos time with a readable date in both languages", async () => {
    const { formatDateTime } = await import("./format");
    const iso = "2026-11-14T06:56:00Z"; // 07:56 in Lagos (UTC+1)
    expect(formatDateTime(iso, "yo")).toBe("14/11/2026, 07:56");
    expect(formatDateTime(iso, "en")).toContain("07:56");
    expect(formatDateTime(iso, "en")).toContain("Nov");
  });
});
