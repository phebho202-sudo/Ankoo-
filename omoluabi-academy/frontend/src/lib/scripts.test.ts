import { describe, expect, it } from "vitest";
import { en, yo } from "./i18n/dictionaries";
import { describeIssue, minutesSeconds } from "./scripts";

describe("describeIssue", () => {
  it("fills lists and numbers", () => {
    expect(describeIssue({ code: "numbers_missing", segment: 2, numbers: ["25000", "5"] }, en.scripts)).toBe(
      "Segment 2: these figures are in the English but not the Yoruba: 25000, 5.",
    );
    expect(describeIssue({ code: "tone_marks_missing", unmarked_percent: 72 }, yo.scripts)).toBe(
      "Ọ̀rọ̀ 72% kò ní àmì ohùn. Ó ṣeé ṣe kí àmì ohùn ti sọnù.",
    );
  });
  it("covers every issue code the backend can send, in both languages", () => {
    const codes = [
      "no_segments", "missing_yoruba", "missing_english", "misplaced_marks", "tone_marks_missing",
      "copied_source_wording", "length_mismatch", "numbers_missing", "english_in_yoruba",
      "glossary_term_not_used", "line_below_used",
    ];
    for (const c of codes) {
      expect(describeIssue({ code: c }, en.scripts)).not.toBe(c);
      expect(describeIssue({ code: c }, yo.scripts)).not.toBe(c);
    }
  });
  it("labels every review checklist item in both languages", () => {
    for (const k of ["tone_marks", "natural_phrasing", "terminology", "numbers_and_naira", "cultural_fit", "source_handling"]) {
      expect((en.scripts.checklist as Record<string, string>)[k]).toBeTruthy();
      expect((yo.scripts.checklist as Record<string, string>)[k]).toBeTruthy();
    }
  });
});

describe("minutesSeconds", () => {
  it("splits seconds", () => expect(minutesSeconds(125.4)).toEqual({ min: 2, sec: 5 }));
});
