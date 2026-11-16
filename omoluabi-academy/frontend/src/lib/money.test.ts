import { describe, expect, it } from "vitest";
import { formatMoney, toMinor } from "./money";

describe("money", () => {
  it("formats minor units without floating-point drift", () => {
    expect(formatMoney(250000, "NGN", "en")).toBe("₦2,500.00");
    expect(formatMoney(123, "USD", "en")).toBe("$1.23");
  });
  it("parses owner-typed amounts exactly", () => {
    expect(toMinor("2,500")).toBe(250000);
    expect(toMinor("₦2,500.5")).toBe(250050);
    expect(toMinor("0.07")).toBe(7);
    expect(toMinor("-5")).toBeNull();
    expect(toMinor("1.234")).toBeNull();
    expect(toMinor("abc")).toBeNull();
  });
});
