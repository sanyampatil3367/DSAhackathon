import { describe, expect, it } from "vitest";
import { MedianEngine, parseScores } from "./engine";

describe("two heap median fallback", () => {
  it("matches the sample after every insertion", () => {
    const e = new MedianEngine();
    expect([5, 1, 9, 3].map((x) => e.insert(x).median)).toEqual([5, 3, 5, 4]);
  });
  it("handles safe wide addition and fractional medians", () => {
    const e = new MedianEngine();
    e.insert(2147483647);
    expect(e.insert(-2147483648).median).toBe(-0.5);
  });
  it("keeps heap invariants over a long stream", () => {
    const e = new MedianEngine();
    for (let i = 0; i < 10000; i++) {
      const r = e.insert(((i * 7919) >>> 0) - 2147483648);
      expect(r.orderingValid && r.balanceValid).toBe(true);
    }
    expect(e.result().count).toBe(10000);
  });
});
describe("file parsing", () => {
  it("accepts score header and negative values", () =>
    expect(parseScores("score\n12\n-5\n12")).toEqual({
      scores: [12, -5, 12],
      errors: [],
    }));
  it("rejects decimals and out of range values", () =>
    expect(parseScores("3.5\n2147483648").errors).toHaveLength(2));
});
