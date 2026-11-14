import { describe, expect, it } from "vitest";
import { en, yo } from "./i18n/dictionaries";
import { describeProblem, describeReason, toDateInput } from "./rights";

describe("describeReason", () => {
  it("fills right, state and licence in English", () => {
    const r = { code: "right_missing", right: "commercial", state: "not_granted", licence: "AH-1" };
    expect(describeReason(r, en.rights)).toBe("Licence AH-1: Commercial use is “Not granted”.");
  });
  it("fills the same reason in Yoruba", () => {
    const r = { code: "right_missing", right: "commercial", state: "unclear", licence: "AH-1" };
    expect(describeReason(r, yo.rights)).toBe("Ìwé àṣẹ AH-1: Lílò fún òwò jẹ́ “Kò ṣe kedere”.");
  });
  it("names platforms", () => {
    expect(describeReason({ code: "platform_not_permitted", platform: "tiktok", licence: "X" }, en.rights)).toBe(
      "Licence X does not permit TikTok.",
    );
  });
  it("covers every reason code the backend can send", () => {
    const codes = [
      "no_licence", "research_only_channel", "sample_episode", "licence_draft", "licence_revoked",
      "licence_expired", "licence_not_yet_effective", "right_missing", "language_not_permitted",
      "platform_not_permitted", "platform_unknown", "episode_missing",
    ];
    for (const c of codes) {
      expect(describeReason({ code: c }, en.rights)).not.toBe(c);
      expect(describeReason({ code: c }, yo.rights)).not.toBe(c);
    }
  });
  it("shows unknown codes instead of hiding them", () => {
    expect(describeReason({ code: "new_rule" }, en.rights)).toBe("new_rule");
  });
});

describe("describeProblem", () => {
  it("covers every verification problem", () => {
    const codes = [
      "document_missing", "scope_missing", "translation_unclear", "adaptation_unclear", "commercial_unclear",
      "distribution_unclear", "platforms_missing", "languages_missing", "already_expired", "attribution_text_missing",
    ];
    for (const c of codes) expect(describeProblem(c, yo.rights)).not.toBe(c);
  });
});

describe("toDateInput", () => {
  it("uses the Lagos calendar date", () => {
    expect(toDateInput("2026-11-30T23:00:00+00:00")).toBe("2026-12-01");
    expect(toDateInput(null)).toBe("");
  });
});
