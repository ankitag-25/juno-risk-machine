// Acceptance test: run with `npm test`. If these fail, the data or the logic is wrong.
import { describe, expect, it } from "vitest";
import { decide, resultOf } from "./rules";
import { makeScenarios, makeUsers } from "./users";

describe("v1 on the 50 synthetic users", () => {
  const users = makeUsers();
  const results = users.map(u => resultOf(u.truth, decide(u).decision));
  const count = (r: string) => results.filter(x => x === r).length;

  it("has 16 bad and 34 good users", () => {
    expect(users.filter(u => u.truth !== "Legit").length).toBe(16);
    expect(users.length).toBe(50);
  });
  it("catches 15, wrongly flags 8, misses 1", () => {
    expect(count("Caught")).toBe(15);
    expect(count("Wrongly flagged")).toBe(8);
    expect(count("Missed")).toBe(1);
  });
});

describe("scenarios match the agreed decisions", () => {
  const expected: Record<string, string> = {
    "S-01": "Clear", "S-02": "Clear", "S-03": "Soft flag", "S-04": "Soft flag", "S-05": "Clear",
    "S-06": "Hard flag", "S-07": "Hard flag", "S-08": "Hard flag", "S-09": "Soft flag", "S-10": "Clear",
    "S-11": "Clear", "S-12": "Clear", "S-13": "Hard flag",
  };
  for (const s of makeScenarios()) {
    it(`${s.user_id} ${s.persona} → ${expected[s.user_id]}`, () => {
      expect(decide(s).decision).toBe(expected[s.user_id]);
    });
  }
});
