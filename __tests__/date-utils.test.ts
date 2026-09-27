import { describe, expect, it } from "vitest";
import { addDays, daysBetween, enumerateDates, getComparisonRange, isSingleDay } from "@/lib/date-utils";

describe("addDays / daysBetween", () => {
  it("shifts a date forward and backward correctly across month boundaries", () => {
    expect(addDays("2026-09-26", -7)).toBe("2026-09-19");
    expect(addDays("2026-09-01", -1)).toBe("2026-08-31");
  });

  it("computes exactly 365 days between the spec's YoY example dates", () => {
    expect(daysBetween("2025-09-26", "2026-09-26")).toBe(365);
  });
});

describe("getComparisonRange — single day (spec section 5 example)", () => {
  const day = { start: "2026-09-26", end: "2026-09-26" };

  it("D-7 of 26 Sep 2026 is 19 Sep 2026", () => {
    expect(getComparisonRange(day, "d7")).toEqual({ start: "2026-09-19", end: "2026-09-19" });
  });

  it("D-365 (YoY) of 26 Sep 2026 is 26 Sep 2025", () => {
    expect(getComparisonRange(day, "d365")).toEqual({ start: "2025-09-26", end: "2025-09-26" });
  });

  it("'none' returns null (no comparison requested)", () => {
    expect(getComparisonRange(day, "none")).toBeNull();
  });
});

describe("getComparisonRange — multi-day range", () => {
  const range = { start: "2026-09-20", end: "2026-09-26" };

  it("shifts both endpoints by the same offset, preserving range length", () => {
    const d7 = getComparisonRange(range, "d7")!;
    expect(d7).toEqual({ start: "2026-09-13", end: "2026-09-19" });
    expect(daysBetween(d7.start, d7.end)).toBe(daysBetween(range.start, range.end));
  });

  it("D-365 shifts both endpoints back exactly 365 days", () => {
    const d365 = getComparisonRange(range, "d365")!;
    expect(d365).toEqual({ start: "2025-09-20", end: "2025-09-26" });
  });
});

describe("isSingleDay", () => {
  it("is true only when start equals end", () => {
    expect(isSingleDay({ start: "2026-09-26", end: "2026-09-26" })).toBe(true);
    expect(isSingleDay({ start: "2026-09-20", end: "2026-09-26" })).toBe(false);
  });
});

describe("enumerateDates", () => {
  it("returns every date inclusive of both endpoints", () => {
    expect(enumerateDates({ start: "2026-09-25", end: "2026-09-27" })).toEqual([
      "2026-09-25",
      "2026-09-26",
      "2026-09-27",
    ]);
  });

  it("returns a single-element array for a single-day range", () => {
    expect(enumerateDates({ start: "2026-09-26", end: "2026-09-26" })).toEqual(["2026-09-26"]);
  });
});
