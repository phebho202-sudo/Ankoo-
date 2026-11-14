import { describe, expect, it } from "vitest";
import { classifySettingError, parseSettingInput } from "./settings";

describe("parseSettingInput", () => {
  it("keeps decimals as strings (no float rounding)", () => {
    expect(parseSettingInput("decimal", " 49.99 ")).toBe("49.99");
  });
  it("parses integers and passes bad input through for server validation", () => {
    expect(parseSettingInput("int", "3")).toBe(3);
    expect(parseSettingInput("int", "3.5")).toBe("3.5");
  });
  it("parses booleans and choices", () => {
    expect(parseSettingInput("bool", "true")).toBe(true);
    expect(parseSettingInput("bool", "false")).toBe(false);
    expect(parseSettingInput("choice", "private")).toBe("private");
  });
});

describe("classifySettingError", () => {
  const base = { ok: false as const, error: "x", httpStatus: 422 };
  it("recognises a spending increase that needs confirmation", () => {
    expect(
      classifySettingError("budget.monthly_limit_usd", {
        ...base,
        code: "blocked_by_policy",
        details: { requires: "confirm_increase" },
      }),
    ).toBe("needs_confirmation");
  });
  it("recognises the auto-publish gate", () => {
    expect(
      classifySettingError("publishing.auto_publish_enabled", { ...base, code: "blocked_by_policy" }),
    ).toBe("auto_publish_blocked");
  });
  it("maps validation and unknown errors", () => {
    expect(classifySettingError("k", { ...base, code: "app_error" })).toBe("invalid");
    expect(classifySettingError("k", { ...base, code: "internal_error" })).toBe("failed");
  });
});
