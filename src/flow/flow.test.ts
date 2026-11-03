// Every decision agreed in the Q&A, checked through the guided flow.
// If one of these fails, the engine no longer matches the agreed rules.
import { describe, expect, it } from "vitest";
import { decide } from "../engine/rules";
import { buildUser, userBefore, visibleOptions, visibleSteps, STEPS, type Answers } from "./steps";

const normal: Answers = {
  signup: ["us"], age: ["25"], income: ["mid"], tenure: ["year"], kyc: ["none"], location: ["same"], session: ["none"],
  inflow: ["lt500"], sources: ["none"], outflow: ["none"], support: ["none"], mule: ["no"], links: ["none"],
};
const senior: Answers = { ...normal, age: ["60"] };
const run = (a: Answers) => decide(buildUser(a));
const decision = (a: Answers) => run(a).decision;
const ids = (a: Answers) => visibleSteps(a).map(s => s.id);

describe("baseline", () => {
  it("a normal user is not flagged", () => expect(decision(normal)).toBe("Clear"));
  it("outside the US is blocked and skips every other question", () => {
    expect(decision({ signup: ["abroad"] })).toBe("Onboarding block");
    expect(ids({ signup: ["abroad"] })).toEqual(["signup"]);
  });
});

describe("v1 rules still hold", () => {
  it("realistic trip: not flagged", () => expect(decision({ ...normal, location: ["trip"] })).toBe("Clear"));
  it("impossible jump: soft flag, asks about VPN", () => {
    expect(decision({ ...normal, location: ["jump"] })).toBe("Soft flag");
    expect(ids({ ...normal, location: ["jump"] })).toContain("vpn");
  });
  it("VPN note clears IP jumping", () => expect(decision({ ...normal, session: ["ips"], vpn: ["yes"] })).toBe("Clear"));
  it("VPN note does not hide a takeover", () =>
    expect(decision({ ...normal, session: ["ips", "device", "reset"], vpn: ["yes"], outflow: ["ext"], dash: ["days"], wallet: ["none"] })).toBe("Hard flag"));
  it("deposit and dash: hard flag", () => expect(decision({ ...normal, outflow: ["ext"], dash: ["fast"], wallet: ["none"] })).toBe("Hard flag"));
  it("strong mule match: hard flag", () => expect(decision({ ...normal, mule: ["very"] })).toBe("Hard flag"));
  it("same-day crypto buy alone: not flagged", () => expect(decision({ ...normal, outflow: ["buy"] })).toBe("Clear"));
});

describe("round 1: mule networks", () => {
  it("shared device alone is ignored", () => expect(decision({ ...normal, session: ["shared"] })).toBe("Clear"));
  it("shared device adds +1 next to another flag", () => expect(run({ ...normal, session: ["shared"], sources: ["foreign"] }).total).toBe(2));
  it("family cluster with small amounts is ignored", () => expect(decision({ ...normal, links: ["family"], outflow: ["buy"] })).toBe("Clear"));
  it("family cluster moving $1,000+/wk to crypto is a red flag", () =>
    expect(run({ ...normal, links: ["family"], inflow: ["1000"], outflow: ["buy"] }).fired.map(r => r.id)).toContain("family_cashout"));
  it("5+ new senders is a red flag", () => expect(decision({ ...normal, sources: ["senders"] })).toBe("Soft flag"));
});

describe("round 2: mule speed", () => {
  it("pass-through on a new account with high amounts is a red flag", () =>
    expect(decision({ ...normal, tenure: ["new"], inflow: ["1000"], outflow: ["pass"] })).toBe("Soft flag"));
  it("pass-through on an old account is ignored", () => expect(decision({ ...normal, inflow: ["1000"], outflow: ["pass"] })).toBe("Clear"));
  it("dormant then active: soft flag asking for documents", () => {
    const o = run({ ...normal, tenure: ["dormant"] });
    expect(o.decision).toBe("Soft flag");
    expect(o.follow.join(" ")).toMatch(/source of the new funds/);
  });
  it("5+ new recipients under $5,000 is ignored", () => expect(decision({ ...normal, outflow: ["newpeople"], payout: ["small"] })).toBe("Clear"));
  it("5+ new recipients over $5,000 is a red flag with receiver review", () => {
    const o = run({ ...normal, outflow: ["newpeople"], payout: ["big"] });
    expect(o.decision).toBe("Soft flag");
    expect(o.follow.join(" ")).toMatch(/receivers’ account activity/);
  });
});

describe("round 3: mule signups", () => {
  it("3+ signups from one device is a red flag", () => expect(decision({ ...normal, kyc: ["signups"] })).toBe("Soft flag"));
});

describe("rounds 4 and 5: scams and victims", () => {
  it("online investment tip: soft flag plus warning call", () => {
    const o = run({ ...normal, support: ["tip"] });
    expect(o.decision).toBe("Soft flag");
    expect(o.follow.join(" ")).toMatch(/warn them/);
  });
  it("scam-linked wallet: soft flag and the user is told", () => {
    const o = run({ ...normal, outflow: ["ext"], dash: ["days"], wallet: ["scam"] });
    expect(o.decision).toBe("Soft flag");
    expect(o.follow.join(" ")).toMatch(/linked to a known scam/);
  });
  it("escalating payments: red flag asking for source of funds", () =>
    expect(run({ ...normal, outflow: ["ext"], dash: ["days"], wallet: ["escalate"] }).follow.join(" ")).toMatch(/source of funds/));
  it("retirement money to crypto counts only at 60+", () => {
    expect(visibleOptions(STEPS.find(s => s.id === "sources")!, userBefore(normal, "sources")).map(o => o.id)).not.toContain("retire");
    expect(decision({ ...senior, sources: ["retire"] })).toBe("Soft flag");
  });
  it("distressed user: no flag, but support follows up", () => {
    const o = run({ ...normal, support: ["urgent"] });
    expect(o.decision).toBe("Clear");
    expect(o.follow.join(" ")).toMatch(/distressed/);
  });
  it("victim-only signals never reach a hard flag", () => {
    const o = run({ ...senior, support: ["tip"], sources: ["retire"], outflow: ["ext", "gift"], dash: ["days"], wallet: ["scam", "escalate"] });
    expect(o.total).toBeGreaterThanOrEqual(3);
    expect(o.decision).toBe("Soft flag");
    expect(o.victimCapped).toBe(true);
  });
  it("victim signals plus a fraudster signal follow normal counting", () =>
    expect(decision({ ...normal, support: ["tip"], sources: ["banks", "senders"] })).toBe("Hard flag"));
});

describe("rounds 6 to 8: seniors", () => {
  it("romance pattern at 60+ asks support to call", () => {
    const o = run({ ...senior, tenure: ["new"], outflow: ["j2j"], receiver: ["fast"] });
    expect(o.decision).toBe("Soft flag");
    expect(o.follow.join(" ")).toMatch(/60\+: support calls/);
  });
  it("romance pattern at 45 to 59 is still a red flag", () =>
    expect(decision({ ...normal, age: ["45"], tenure: ["new"], outflow: ["j2j"], receiver: ["fast"] })).toBe("Soft flag"));
  it("senior contact change then outflow: hard flag", () => expect(decision({ ...senior, session: ["contact"] })).toBe("Hard flag"));
  it("someone else moving a senior's money: soft flag, email on-file contact", () => {
    const o = run({ ...senior, support: ["third"] });
    expect(o.decision).toBe("Soft flag");
    expect(o.follow.join(" ")).toMatch(/contact on file/);
  });
  it("senior gift cards: soft flag plus call", () => expect(decision({ ...senior, outflow: ["gift"] })).toBe("Soft flag"));
  it("senior first big crypto buy alone is ignored", () => expect(decision({ ...senior, outflow: ["bigcrypto"] })).toBe("Clear"));
  it("senior paying a new recipient with no receiver risks is ignored", () =>
    expect(decision({ ...senior, outflow: ["senior_new"], senior_receiver: ["none"] })).toBe("Clear"));
  for (const t of ["new", "fast", "seniors", "flagged"]) {
    it(`senior paying a receiver who is "${t}" is a red flag`, () =>
      expect(decision({ ...senior, outflow: ["senior_new"], senior_receiver: [t] })).toBe("Soft flag"));
  }
  it("senior-only questions never show for under-60s", () => {
    const opts = (id: string) => visibleOptions(STEPS.find(s => s.id === id)!, userBefore(normal, id)).map(o => o.id);
    expect(opts("outflow")).not.toContain("gift");
    expect(opts("support")).not.toContain("third");
    expect(opts("session")).not.toContain("contact");
  });
});

describe("round 8: KYC", () => {
  it("Onfido face check failure: hard flag", () => expect(decision({ ...normal, kyc: ["face"] })).toBe("Hard flag"));
  it("ID state mismatch: red flag", () => expect(decision({ ...normal, kyc: ["state"] })).toBe("Soft flag"));
});

describe("rounds 9 and 10: AML and after the flag", () => {
  it("structuring: soft flag asking for source of funds", () => {
    const o = run({ ...normal, sources: ["struct"] });
    expect(o.decision).toBe("Soft flag");
    expect(o.follow.join(" ")).toMatch(/source of funds/);
  });
  it("sanctioned country: hard flag, compliance review, no tipping off", () => {
    const o = run({ ...normal, links: ["sanctions"] });
    expect(o.decision).toBe("Hard flag");
    expect(o.follow.join(" ")).toMatch(/never told about any report/);
  });
  it("refusing to explain funds: hard flag", () => expect(decision({ ...normal, support: ["refused"] })).toBe("Hard flag"));
  it("linked to a confirmed mule: hard flag", () => expect(decision({ ...normal, links: ["ring"] })).toBe("Hard flag"));
  it("documents already verified cover money signals", () => {
    expect(ids({ ...normal, sources: ["foreign"] })).toContain("docs");
    expect(decision({ ...normal, sources: ["foreign"], docs: ["yes"] })).toBe("Clear");
  });
  it("documents note does not cover a sanctions hit", () => expect(decision({ ...normal, sources: ["foreign"], links: ["sanctions"], docs: ["yes"] })).toBe("Hard flag"));
  it("confirmed fraud closes the account and mails the balance", () =>
    expect(run({ ...normal, kyc: ["face"] }).follow.join(" ")).toMatch(/mail a check/));
});

describe("flow length", () => {
  it("a normal user answers 13 questions", () => expect(ids(normal).length).toBe(13));
  it("follow-ups only appear when relevant", () => {
    for (const id of ["dash", "wallet", "payout", "receiver", "senior_receiver", "vpn", "docs"]) expect(ids(normal)).not.toContain(id);
  });
});
