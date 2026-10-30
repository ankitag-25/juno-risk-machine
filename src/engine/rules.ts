// ============================================================
// Juno Risk Machine: rules engine (v1)
// Every decision on screen comes from this file. Nothing is hard-coded in the UI.
// ============================================================

export type Truth = "Legit" | "Fraud" | "At risk" | "";
export type Decision = "Clear" | "Soft flag" | "Hard flag" | "Onboarding block";
export type Result = "Caught" | "Missed" | "Wrongly flagged" | "Correctly cleared";

export interface User {
  user_id: string;
  persona: string;
  truth: Truth;
  // who they are
  signup_country: string;
  age: number;
  income_band: "Low" | "Mid" | "High";
  account_age_days: number;
  // logins
  prev_city: string;
  login_city: string;
  gap_hours: number;
  ips_last_hour: number;
  new_device: number;
  password_reset: number;
  // money in
  weekly_inflow_usd: number;
  ach_banks: number;
  foreign_inbound: number;
  cashapp_loops: number;
  same_amount_repeats: number;
  ach_crypto_same_day: number;
  // money out
  j2j_large_out: number;
  receiver_crypto_mins: number;
  ext_crypto_out: number;
  ext_wallet_new: number;
  deposit_to_ext_mins: number;
  // network
  similarity_pct: number;
  // risk team
  vpn_note: number;
}

/** All thresholds in one place. Illustrative values, not Juno's production numbers. */
export const T = {
  similarity: 60,          // mule similarity red flag
  similaritySevere: 80,    // mule similarity instant hard flag
  cashapp: 3,
  sameAmount: 3,
  achBanks: 4,
  incomeInflow: 500, incomeAge: 25,
  youngAge: 25, youngInflow: 1000,
  romanceAcctAge: 14, romanceAge: 45, romanceJ2J: 3, romanceMins: 10,
  ipJumps: 4,              // distinct IPs within one hour
  depositDashMins: 30,     // external crypto out within N minutes of a deposit
  flightKmh: 800, airportHours: 2,
  hardAt: 3,               // v1: 3+ counted red flags = hard flag
} as const;

export const CITIES: Record<string, [number, number, string]> = {
  "New York, US": [40.71, -74.01, "US"],
  "Chicago, US": [41.88, -87.63, "US"],
  "Austin, US": [30.27, -97.74, "US"],
  "Miami, US": [25.76, -80.19, "US"],
  "Seattle, US": [47.61, -122.33, "US"],
  "San Francisco, US": [37.77, -122.42, "US"],
  "Toronto, CA": [43.65, -79.38, "CA"],
  "Mexico City, MX": [19.43, -99.13, "MX"],
  "London, UK": [51.51, -0.13, "UK"],
  "Lagos, NG": [6.52, 3.38, "NG"],
  "Nairobi, KE": [-1.29, 36.82, "KE"],
  "Mumbai, IN": [19.08, 72.88, "IN"],
  "Dubai, AE": [25.2, 55.27, "AE"],
  "Manila, PH": [14.6, 120.98, "PH"],
  "São Paulo, BR": [-23.55, -46.63, "BR"],
};
export const US_CITIES = Object.keys(CITIES).filter(c => CITIES[c][2] === "US");

export const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
export const fmtMins = (m: number) =>
  m >= 1440 ? "24h+" : m >= 60 ? (m / 60).toFixed(m % 60 ? 1 : 0) + "h" : m + " min";

function haversineKm(a: [number, number, string], b: [number, number, string]) {
  const R = 6371, r = (x: number) => (x * Math.PI) / 180;
  const dLat = r(b[0] - a[0]), dLon = r(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface Travel { km: number; needHours: number; impossible: boolean; abroad: boolean }

/** Is the jump between the last two login locations physically possible? */
export function travelCheck(u: User): Travel {
  const a = CITIES[u.prev_city], b = CITIES[u.login_city];
  if (!a || !b || u.prev_city === u.login_city) {
    return { km: 0, needHours: 0, impossible: false, abroad: b ? b[2] !== "US" : false };
  }
  const km = haversineKm(a, b);
  const needHours = km / T.flightKmh + T.airportHours;
  return { km: Math.round(km), needHours, impossible: u.gap_hours < needHours, abroad: b[2] !== "US" };
}

interface RuleDef {
  id: string;
  name: string;
  cond: string;
  vpn?: boolean; // covered by an analyst's VPN note
  val: (u: User, t: Travel) => string;
  test: (u: User, t: Travel) => boolean;
}

/** Red flags. Each one counts toward the total. */
export const RULES: RuleDef[] = [
  { id: "impossible_travel", name: "Impossible travel", cond: "Gap between logins is shorter than travel time", vpn: true,
    val: (u, t) => t.km ? `${t.km.toLocaleString("en-US")} km, needs ${t.needHours.toFixed(1)}h, had ${u.gap_hours}h` : "Same city",
    test: (_u, t) => t.impossible },
  { id: "ip_jumping", name: "IP jumping", cond: `≥ ${T.ipJumps} different IPs in 1 hour`, vpn: true,
    val: u => `${u.ips_last_hour} IPs`, test: u => u.ips_last_hour >= T.ipJumps },
  { id: "mule_similarity", name: "Mule similarity", cond: `≥ ${T.similarity}% similar to known mules`,
    val: u => `${u.similarity_pct}%`, test: u => u.similarity_pct >= T.similarity },
  { id: "foreign_inbound", name: "Foreign inbound", cond: "Receives money from abroad",
    val: u => (u.foreign_inbound ? "Yes" : "No"), test: u => !!u.foreign_inbound },
  { id: "cashapp_loops", name: "Cash App loops", cond: `≥ ${T.cashapp} per week`,
    val: u => `${u.cashapp_loops} / wk`, test: u => u.cashapp_loops >= T.cashapp },
  { id: "same_amount", name: "Same-amount cycling", cond: `≥ ${T.sameAmount} repeats`,
    val: u => `${u.same_amount_repeats} repeats`, test: u => u.same_amount_repeats >= T.sameAmount },
  { id: "multi_bank_ach", name: "Multi-bank ACH", cond: `≥ ${T.achBanks} banks sending ACH`,
    val: u => `${u.ach_banks} banks`, test: u => u.ach_banks >= T.achBanks },
  { id: "income_mismatch", name: "Income mismatch", cond: `≥ ${money(T.incomeInflow)}/wk, Low income, age ≥ ${T.incomeAge}`,
    val: u => `${money(u.weekly_inflow_usd)}, ${u.income_band}, ${u.age}`,
    test: u => u.weekly_inflow_usd >= T.incomeInflow && u.income_band === "Low" && u.age >= T.incomeAge },
  { id: "young_high_volume", name: "Young + high volume", cond: `≥ ${money(T.youngInflow)}/wk, Low income, age < ${T.youngAge}`,
    val: u => `${money(u.weekly_inflow_usd)}, ${u.income_band}, ${u.age}`,
    test: u => u.age < T.youngAge && u.income_band === "Low" && u.weekly_inflow_usd >= T.youngInflow },
  { id: "romance_scam", name: "Romance scam pattern",
    cond: `Account ≤ ${T.romanceAcctAge}d, age ≥ ${T.romanceAge}, ≥ ${T.romanceJ2J} large J2J out, receiver to crypto ≤ ${T.romanceMins} min`,
    val: u => `${u.account_age_days}d, ${u.age}, ${u.j2j_large_out} out, ${fmtMins(u.receiver_crypto_mins)}`,
    test: u => u.account_age_days <= T.romanceAcctAge && u.age >= T.romanceAge && u.j2j_large_out >= T.romanceJ2J && u.receiver_crypto_mins <= T.romanceMins },
];

/** Severe signals: any one of these is a hard flag on its own, no counting needed. */
export const SEVERE: RuleDef[] = [
  { id: "account_takeover", name: "Account takeover", cond: "New device + password reset + external crypto out",
    val: u => [u.new_device && "new device", u.password_reset && "reset", u.ext_crypto_out && "crypto out"].filter(Boolean).join(" + ") || "None of the three",
    test: u => !!(u.new_device && u.password_reset && u.ext_crypto_out) },
  { id: "deposit_dash", name: "Deposit and dash", cond: `External crypto out ≤ ${T.depositDashMins} min after a deposit`,
    val: u => (u.ext_crypto_out ? fmtMins(u.deposit_to_ext_mins) + " after deposit" : "No external crypto out"),
    test: u => !!u.ext_crypto_out && u.deposit_to_ext_mins <= T.depositDashMins },
  { id: "strong_mule", name: "Strong mule match", cond: `≥ ${T.similaritySevere}% similar to known mules`,
    val: u => `${u.similarity_pct}%`, test: u => u.similarity_pct >= T.similaritySevere },
];

export interface Access { deposits: boolean; withdrawals: boolean; j2j: boolean; crypto: boolean }
export const ACCESS: Record<Decision, Access | null> = {
  "Clear":            { deposits: true,  withdrawals: true,  j2j: true,  crypto: true },
  "Soft flag":        { deposits: true,  withdrawals: false, j2j: true,  crypto: false },
  "Hard flag":        { deposits: false, withdrawals: false, j2j: false, crypto: false },
  "Onboarding block": null,
};

export interface RuleResult { id: string; name: string; cond: string; value: string; fired: boolean; noted: boolean }

export interface Outcome {
  decision: Decision;
  reason: string;
  rules: RuleResult[];
  fired: RuleResult[];
  severe: RuleResult[];
  severeFired: RuleResult[];
  booster: { present: boolean; counted: boolean };
  total: number;
  travel: Travel;
  follow: string[];
  access: Access | null;
  blocked: boolean;
}

export function decide(u: User): Outcome {
  const travel = travelCheck(u);

  const rules: RuleResult[] = RULES.map(r => {
    const raw = r.test(u, travel);
    const noted = raw && !!r.vpn && !!u.vpn_note;
    return { id: r.id, name: r.name, cond: r.cond, value: r.val(u, travel), noted, fired: raw && !noted };
  });
  const fired = rules.filter(r => r.fired);
  const k = fired.length;

  // ACH -> same-day crypto buy is the product. It only adds weight when something else already fired.
  const booster = { present: !!u.ach_crypto_same_day, counted: !!u.ach_crypto_same_day && k >= 1 };
  const total = k + (booster.counted ? 1 : 0);

  const severe: RuleResult[] = SEVERE.map(s => ({ id: s.id, name: s.name, cond: s.cond, value: s.val(u, travel), noted: false, fired: s.test(u, travel) }));
  const severeFired = severe.filter(s => s.fired);
  const blocked = u.signup_country !== "US";

  let decision: Decision, reason: string;
  if (blocked) {
    decision = "Onboarding block";
    reason = `Signed up from ${u.signup_country}. Juno is US-only, so signup stops here.`;
  } else if (severeFired.length) {
    decision = "Hard flag";
    reason = `Severe signal: ${severeFired.map(s => s.name).join(", ")}. One is enough for a hard flag.`;
  } else if (total >= T.hardAt) {
    decision = "Hard flag";
    reason = `${total} red flags counted, hard flag starts at ${T.hardAt}.`;
  } else if (total >= 1) {
    decision = "Soft flag";
    reason = `${total} red flag${total > 1 ? "s" : ""} counted. In v1, any single red flag is enough for a soft flag.`;
  } else {
    decision = "Clear";
    reason = "No red flags counted.";
  }

  const follow: string[] = [];
  const noted = rules.filter(r => r.noted);
  if (decision === "Onboarding block") {
    follow.push("Signup is stopped before an account exists.");
  } else if (decision === "Hard flag") {
    follow.push("Deposits and withdrawals are blocked.");
    follow.push("Risk team reviews the account manually.");
  } else if (decision === "Soft flag") {
    const ids = fired.map(r => r.id);
    const ipOnly = ids.length === 1 && ids[0] === "ip_jumping" && !booster.counted;
    const lightOnly = ids.every(id => id === "impossible_travel" || id === "ip_jumping") && !booster.counted;
    if (ids.includes("ip_jumping")) {
      follow.push("Support reaches out about unfamiliar login activity. If the user confirms a VPN, an analyst adds a note.");
    }
    if (ipOnly) follow.push("Released once the user explains the activity. No documents needed.");
    else follow.push(lightOnly ? "Ask for light docs, like an ID selfie or a travel confirmation." : "Ask for documents, like ID and source of funds.");
    follow.push(ipOnly ? "Money can come in. Nothing leaves Juno until then." : "Money can come in. Nothing leaves Juno until the documents arrive.");
  }
  if (noted.length && decision !== "Onboarding block") {
    follow.push(`${noted.map(r => r.name).join(" and ")} matches the analyst’s VPN note, so it isn’t counted.`);
  }

  return { decision, reason, rules, fired, severe, severeFired, booster, total, travel, follow, access: ACCESS[decision], blocked };
}

export function resultOf(truth: Truth, decision: Decision): Result {
  const bad = truth === "Fraud" || truth === "At risk";
  const flagged = decision !== "Clear";
  if (bad) return flagged ? "Caught" : "Missed";
  return flagged ? "Wrongly flagged" : "Correctly cleared";
}
