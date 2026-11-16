import { describe, expect, it } from "vitest";
import { lagosLocalToIso, publicationTone } from "./publishing";

describe("publishing helpers", () => {
  it("reads a typed time as Lagos time", () => {
    const iso = lagosLocalToIso("2026-11-20T18:00");
    expect(iso).toBe("2026-11-20T18:00:00+01:00");
    expect(new Date(iso!).toISOString()).toBe("2026-11-20T17:00:00.000Z");
    expect(lagosLocalToIso("tomorrow")).toBeNull();
  });
  it("only confirmed uploads are green", () => {
    expect(publicationTone("uploaded")).toBe("green");
    expect(publicationTone("simulated")).toBe("gold");
    expect(publicationTone("unconfirmed")).toBe("gold");
    expect(publicationTone("blocked")).toBe("red");
  });
});
