import { describe, expect, it } from "vitest";
import { decide } from "../engine/rules";
import { buildProfile } from "./profile";
import { buildUser, type Answers } from "./steps";

const normal: Answers = { signup: ["us"], age: ["25"], income: ["mid"], tenure: ["year"], location: ["same"], session: ["none"], inflow: ["lt500"], sources: ["none"], outflow: ["none"], mule: ["no"] };
const prof = (a: Answers) => { const u = buildUser(a); return buildProfile(u, decide(u), JSON.stringify(a)); };

describe("analyst profile", () => {
  it("shows a crypto-out transaction for deposit and dash", () =>
    expect(prof({ ...normal, outflow: ["ext"], dash: ["fast"] }).txns.some(t => t.label === "Crypto out")).toBe(true));
  it("marks a login from abroad as new", () => expect(prof({ ...normal, location: ["jump"] }).latest.isNew).toBe(true));
  it("adds the machine decision to flag history when flagged", () =>
    expect(prof({ ...normal, mule: ["very"] }).notes[0].who).toBe("Risk Machine"));
  it("has no account or transactions when blocked at signup", () => {
    const p = prof({ signup: ["abroad"] });
    expect(p.hasAccount).toBe(false); expect(p.txns.length).toBe(0);
  });
  it("is stable for the same answers", () => expect(prof(normal).name).toBe(prof(normal).name));
});
