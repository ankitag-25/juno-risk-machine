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
  docs_cleared?: number;          // analyst note: documents already verified source of funds

  // ---- v1.1 signals (all optional, default 0) ----
  // mule network
  shared_device_accounts?: number; // other accounts on the same device
  same_device_signups?: number;    // accounts opened from this device in 24h
  family_cluster?: number;         // same surname + address as 3+ accounts, money moving between them
  new_senders_week?: number;       // first-time senders this week
  pass_through?: number;           // 90%+ of money leaves within 24h
  dormant_reactivated?: number;    // dormant 6+ months, now high volume
  new_recipients_5plus?: number;   // pays 5+ first-time recipients in a week
  new_recipients_usd?: number;     // total sent to those new recipients
  linked_confirmed_ring?: number;  // linked by device or money flow to a confirmed mule
  // scams and victims
  online_investment_tip?: number;  // told support: investing via someone met online
  scam_wallet?: number;            // external wallet linked to a known scam platform
  escalating_out?: number;         // each crypto transfer bigger than the last
  retirement_to_crypto?: number;   // retirement or loan money leaves as crypto within days
  distressed_support?: number;     // urgent / distressed with support
  // seniors
  contact_change_outflow?: number; // phone/email changed, then a large outflow
  third_party_request?: number;    // someone else asked support to move the money
  gift_cards?: number;             // several large gift cards in a week
  first_big_crypto?: number;       // first-ever crypto buy of $5,000+
  senior_new_recipient?: number;   // $2,000+ to a first-time Juno recipient
  receiver_new?: number; receiver_fast_crypto?: number; receiver_many_seniors?: number; receiver_flagged?: number;
  // KYC and AML
  kyc_face_fail?: number;          // Onfido selfie mismatch or liveness fail
  id_state_mismatch?: number;      // ID state differs from usual login state
  structuring?: number;            // deposits just under a reporting limit
  sanctioned_country?: number;     // money from or to a sanctioned / high-risk country
  refuses_docs?: number;           // actively refused to explain source of funds
}

const f = (u: User, k: keyof User) => Number(u[k] || 0);

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
  // v1.1
  senior: 60,              // FinCEN treats 60+ as an older adult
  largeWeekly: 1000,       // "a lot of money" for family clusters and pass-through
  newAccountDays: 30,
  newSenders: 5,
  newRecipientsUsd: 5000,
  sharedDevice: 3,
  deviceSignups: 3,
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

export interface RuleDef {
  id: string;
  name: string;
  cond: string;
  vpn?: boolean;     // covered by an analyst's VPN note
  docs?: boolean;    // covered by an analyst note that documents were already verified
  victim?: boolean;  // points at a scam victim, not a fraudster
  follow?: (u: User) => string;
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
  { id: "foreign_inbound", name: "Foreign inbound", cond: "Receives money from abroad", docs: true,
    val: u => (u.foreign_inbound ? "Yes" : "No"), test: u => !!u.foreign_inbound },
  { id: "cashapp_loops", name: "Cash App loops", cond: `≥ ${T.cashapp} per week`,
    val: u => `${u.cashapp_loops} / wk`, test: u => u.cashapp_loops >= T.cashapp },
  { id: "same_amount", name: "Same-amount cycling", cond: `≥ ${T.sameAmount} repeats`,
    val: u => `${u.same_amount_repeats} repeats`, test: u => u.same_amount_repeats >= T.sameAmount },
  { id: "multi_bank_ach", name: "Multi-bank ACH", cond: `≥ ${T.achBanks} banks sending ACH`, docs: true,
    val: u => `${u.ach_banks} banks`, test: u => u.ach_banks >= T.achBanks },
  { id: "income_mismatch", name: "Income mismatch", cond: `≥ ${money(T.incomeInflow)}/wk, Low income, age ≥ ${T.incomeAge}`, docs: true,
    val: u => `${money(u.weekly_inflow_usd)}, ${u.income_band}, ${u.age}`,
    test: u => u.weekly_inflow_usd >= T.incomeInflow && u.income_band === "Low" && u.age >= T.incomeAge },
  { id: "young_high_volume", name: "Young + high volume", cond: `≥ ${money(T.youngInflow)}/wk, Low income, age < ${T.youngAge}`, docs: true,
    val: u => `${money(u.weekly_inflow_usd)}, ${u.income_band}, ${u.age}`,
    test: u => u.age < T.youngAge && u.income_band === "Low" && u.weekly_inflow_usd >= T.youngInflow },
  { id: "romance_scam", name: "Romance scam pattern", victim: true,
    follow: u => u.age >= T.senior ? "User is 60+: support calls them about romance scams." : "",
    cond: `Account ≤ ${T.romanceAcctAge}d, age ≥ ${T.romanceAge}, ≥ ${T.romanceJ2J} large J2J out, receiver to crypto ≤ ${T.romanceMins} min`,
    val: u => `${u.account_age_days}d, ${u.age}, ${u.j2j_large_out} out, ${fmtMins(u.receiver_crypto_mins)}`,
    test: u => u.account_age_days <= T.romanceAcctAge && u.age >= T.romanceAge && u.j2j_large_out >= T.romanceJ2J && u.receiver_crypto_mins <= T.romanceMins },
  // ---- v1.1: mule network ----
  { id: "new_senders", name: "Many new senders", cond: `≥ ${T.newSenders} first-time senders in a week`,
    val: u => `${f(u, "new_senders_week")} new senders`, test: u => f(u, "new_senders_week") >= T.newSenders },
  { id: "pass_through", name: "Pass-through on a new account", cond: `90%+ leaves within 24h, account ≤ ${T.newAccountDays}d, ≥ ${money(T.largeWeekly)}/wk`,
    val: u => f(u, "pass_through") ? `${u.account_age_days}d old, ${money(u.weekly_inflow_usd)}/wk` : "No",
    test: u => !!f(u, "pass_through") && u.account_age_days <= T.newAccountDays && u.weekly_inflow_usd >= T.largeWeekly },
  { id: "dormant_reactivated", name: "Dormant account reactivated", cond: "Dormant 6+ months, now high volume", docs: true,
    follow: () => "Ask for documents on the source of the new funds.",
    val: u => f(u, "dormant_reactivated") ? "Yes" : "No", test: u => !!f(u, "dormant_reactivated") },
  { id: "new_recipients", name: "Large payouts to new recipients", cond: `5+ new recipients, over ${money(T.newRecipientsUsd)} in total`,
    follow: () => "Review the receivers’ account activity.",
    val: u => f(u, "new_recipients_5plus") ? money(f(u, "new_recipients_usd")) : "No",
    test: u => !!f(u, "new_recipients_5plus") && f(u, "new_recipients_usd") > T.newRecipientsUsd },
  { id: "device_signups", name: "Signups from one device", cond: `≥ ${T.deviceSignups} accounts opened from this device in 24h`,
    val: u => `${f(u, "same_device_signups")} accounts`, test: u => f(u, "same_device_signups") >= T.deviceSignups },
  { id: "family_cashout", name: "Family cluster cashing out", cond: `Same surname + address as 3+ accounts, ≥ ${money(T.largeWeekly)}/wk, leaving as crypto`,
    val: u => f(u, "family_cluster") ? `${money(u.weekly_inflow_usd)}/wk${u.ext_crypto_out || u.ach_crypto_same_day ? ", to crypto" : ""}` : "No",
    test: u => !!f(u, "family_cluster") && u.weekly_inflow_usd >= T.largeWeekly && !!(u.ext_crypto_out || u.ach_crypto_same_day) },
  // ---- v1.1: scams (victim signals) ----
  { id: "online_tip", name: "Investment tip from online contact", cond: "Told support they invest via someone met online", victim: true,
    follow: () => "Support calls the user to warn them about investment scams.",
    val: u => f(u, "online_investment_tip") ? "Yes" : "No", test: u => !!f(u, "online_investment_tip") },
  { id: "scam_wallet", name: "Scam-linked wallet", cond: "Blockchain analytics links the wallet to a scam platform", victim: true,
    follow: () => "Tell the user the wallet is linked to a known scam.",
    val: u => f(u, "scam_wallet") ? "Linked" : "No", test: u => !!f(u, "scam_wallet") },
  { id: "escalating", name: "Escalating payments", cond: "Each crypto transfer bigger than the last", victim: true, docs: true,
    follow: () => "Ask for the source of funds.",
    val: u => f(u, "escalating_out") ? "Yes" : "No", test: u => !!f(u, "escalating_out") },
  { id: "retirement_crypto", name: "Retirement money to crypto", cond: `Retirement or loan money leaves as crypto, age ≥ ${T.senior}`, victim: true,
    val: u => f(u, "retirement_to_crypto") ? `Yes, age ${u.age}` : "No", test: u => !!f(u, "retirement_to_crypto") && u.age >= T.senior },
  // ---- v1.1: seniors (victim signals) ----
  { id: "third_party", name: "Third party moving a senior’s money", cond: `Someone else asked to move the money, age ≥ ${T.senior}`, victim: true,
    follow: () => "Request refused. Email the user at the contact on file before any recent change.",
    val: u => f(u, "third_party_request") ? "Yes" : "No", test: u => !!f(u, "third_party_request") && u.age >= T.senior },
  { id: "gift_cards", name: "Gift card buying", cond: `Several large gift cards in a week, age ≥ ${T.senior}`, victim: true,
    follow: () => "Support calls the user about gift card scams.",
    val: u => f(u, "gift_cards") ? "Yes" : "No", test: u => !!f(u, "gift_cards") && u.age >= T.senior },
  { id: "senior_receiver", name: "Senior paying a risky receiver", cond: `${money(2000)}+ to a new recipient who is new, cashes out fast, gets money from 3+ seniors, or is flagged`, victim: true,
    val: u => f(u, "senior_new_recipient") ? ["receiver_new", "receiver_fast_crypto", "receiver_many_seniors", "receiver_flagged"].filter(k => f(u, k as keyof User)).length + " receiver risks" : "No",
    test: u => u.age >= T.senior && !!f(u, "senior_new_recipient") && (["receiver_new", "receiver_fast_crypto", "receiver_many_seniors", "receiver_flagged"] as const).some(k => !!f(u, k)) },
  // ---- v1.1: KYC and AML ----
  { id: "id_state", name: "ID state mismatch", cond: "State on ID differs from usual login state",
    val: u => f(u, "id_state_mismatch") ? "Mismatch" : "Match", test: u => !!f(u, "id_state_mismatch") },
  { id: "structuring", name: "Structuring", cond: "Several deposits just under a reporting limit", docs: true,
    follow: () => "Ask for the source of funds.",
    val: u => f(u, "structuring") ? "Yes" : "No", test: u => !!f(u, "structuring") },
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
  { id: "senior_takeover", name: "Senior contact change + outflow", cond: `Phone or email changed, then a large outflow, age ≥ ${T.senior}`,
    val: u => f(u, "contact_change_outflow") ? `Yes, age ${u.age}` : "No", test: u => !!f(u, "contact_change_outflow") && u.age >= T.senior },
  { id: "kyc_fail", name: "Face check failed", cond: "Onfido selfie mismatch or liveness fail",
    val: u => f(u, "kyc_face_fail") ? "Failed" : "Passed", test: u => !!f(u, "kyc_face_fail") },
  { id: "sanctions", name: "Sanctioned country", cond: "Money from or to a sanctioned or high-risk country",
    follow: () => "Compliance reviews the transaction. The user is never told about any report.",
    val: u => f(u, "sanctioned_country") ? "Yes" : "No", test: u => !!f(u, "sanctioned_country") },
  { id: "refused_docs", name: "Refused to explain funds", cond: "Actively refused to explain the source of funds",
    val: u => f(u, "refuses_docs") ? "Refused" : "No", test: u => !!f(u, "refuses_docs") },
  { id: "linked_ring", name: "Linked to a confirmed mule", cond: "Same device or money flow as a confirmed mule account",
    val: u => f(u, "linked_confirmed_ring") ? "Linked" : "No", test: u => !!f(u, "linked_confirmed_ring") },
];

/** Boosters: never flag on their own, add +1 only when another red flag already fired. */
export const BOOSTERS: RuleDef[] = [
  { id: "same_day_crypto", name: "Same-day ACH to crypto", cond: "Normal on its own. Juno is built for this.",
    val: u => u.ach_crypto_same_day ? "Yes" : "No", test: u => !!u.ach_crypto_same_day },
  { id: "shared_device", name: "Shared device", cond: `Device also used by ≥ ${T.sharedDevice} other accounts`,
    val: u => `${f(u, "shared_device_accounts")} other accounts`, test: u => f(u, "shared_device_accounts") >= T.sharedDevice },
  { id: "senior_first_crypto", name: "Senior’s first big crypto buy", cond: `First-ever crypto buy of $5,000+, age ≥ ${T.senior}`,
    val: u => f(u, "first_big_crypto") ? "Yes" : "No", test: u => !!f(u, "first_big_crypto") && u.age >= T.senior },
];

export interface Access { deposits: boolean; withdrawals: boolean; j2j: boolean; crypto: boolean }
export const ACCESS: Record<Decision, Access | null> = {
  "Clear":            { deposits: true,  withdrawals: true,  j2j: true,  crypto: true },
  "Soft flag":        { deposits: true,  withdrawals: false, j2j: true,  crypto: false },
  "Hard flag":        { deposits: false, withdrawals: false, j2j: false, crypto: false },
  "Onboarding block": null,
};

export interface RuleResult { id: string; name: string; cond: string; value: string; fired: boolean; noted: boolean; victim?: boolean; follow?: string }

export interface Outcome {
  decision: Decision;
  reason: string;
  rules: RuleResult[];
  fired: RuleResult[];
  severe: RuleResult[];
  severeFired: RuleResult[];
  booster: { present: boolean; counted: boolean };
  boosters: RuleResult[];
  victimCapped: boolean;
  total: number;
  travel: Travel;
  follow: string[];
  access: Access | null;
  blocked: boolean;
}

export function decide(u: User): Outcome {
  const travel = travelCheck(u);
  const run = (r: RuleDef): RuleResult => {
    const raw = r.test(u, travel);
    const noted = raw && ((!!r.vpn && !!u.vpn_note) || (!!r.docs && !!u.docs_cleared));
    const fired = raw && !noted;
    return { id: r.id, name: r.name, cond: r.cond, value: r.val(u, travel), noted, fired, victim: r.victim, follow: fired && r.follow ? r.follow(u) || undefined : undefined };
  };

  const rules = RULES.map(run);
  const fired = rules.filter(r => r.fired);
  const k = fired.length;

  // Boosters only add weight when something else already fired.
  const boosters = BOOSTERS.map(b => { const r = run(b); return { ...r, fired: r.fired && k >= 1, value: r.fired && k < 1 ? r.value + " (alone, not counted)" : r.value }; });
  const boostCount = boosters.filter(b => b.fired).length;
  const total = k + boostCount;
  const sameDay = boosters[0];
  const booster = { present: !!u.ach_crypto_same_day, counted: sameDay.fired };

  const severe = SEVERE.map(run);
  const severeFired = severe.filter(s => s.fired);
  const blocked = u.signup_country !== "US";

  // Victim cap: if every counted red flag points at a victim, never go past a soft flag.
  const victimOnly = k > 0 && fired.every(r => r.victim);
  const victimCapped = victimOnly && !severeFired.length && total >= T.hardAt;

  let decision: Decision, reason: string;
  if (blocked) {
    decision = "Onboarding block";
    reason = `Signed up from ${u.signup_country}. Juno is US-only, so signup stops here.`;
  } else if (severeFired.length) {
    decision = "Hard flag";
    reason = `Severe signal: ${severeFired.map(s => s.name).join(", ")}. One is enough for a hard flag.`;
  } else if (victimCapped) {
    decision = "Soft flag";
    reason = `${total} red flags counted, but every one points to a scam victim. Victims get a soft flag and a call, never a hard flag.`;
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
  const noted = [...rules, ...boosters].filter(r => r.noted);
  const ruleFollow = [...severeFired, ...fired].map(r => r.follow).filter((x): x is string => !!x);
  if (decision === "Onboarding block") {
    follow.push("Signup is stopped before an account exists.");
  } else if (decision === "Hard flag") {
    follow.push("Deposits and withdrawals are blocked.");
    follow.push("Risk team reviews the account manually.");
    follow.push(...ruleFollow);
    follow.push("If fraud is confirmed: close the account, file a report and mail a check for the remaining balance. Sanctions money stays frozen, and money traced to a victim goes back to them.");
    if (fired.some(r => ["mule_similarity", "new_senders", "pass_through", "device_signups", "family_cashout"].includes(r.id)) || severeFired.some(s => s.id === "strong_mule" || s.id === "linked_ring")) {
      follow.push("If confirmed as a mule, every account linked by device or money flow is hard flagged too.");
    }
  } else if (decision === "Soft flag") {
    const ids = fired.map(r => r.id);
    const ipOnly = ids.length === 1 && ids[0] === "ip_jumping" && !boostCount;
    const lightOnly = ids.every(id => id === "impossible_travel" || id === "ip_jumping") && !boostCount;
    if (ids.includes("ip_jumping")) {
      follow.push("Support reaches out about unfamiliar login activity. If the user confirms a VPN, an analyst adds a note.");
    }
    if (victimOnly) follow.push("Support calls the user. This looks like a scam targeting them, not fraud by them.");
    follow.push(...ruleFollow);
    if (ipOnly) follow.push("Released once the user explains the activity. No documents needed.");
    else if (!victimOnly) follow.push(lightOnly ? "Ask for light docs, like an ID selfie or a travel confirmation." : "Ask for documents, like ID and source of funds. Refusing to explain escalates to a hard flag.");
    follow.push(ipOnly ? "Money can come in. Nothing leaves Juno until then." : "Money can come in. Nothing leaves Juno until this is resolved.");
  }
  if (f(u, "distressed_support") && decision !== "Onboarding block") {
    follow.push("User seemed distressed with support, so support follows up by chat or call.");
  }
  if (noted.length && decision !== "Onboarding block") {
    follow.push(`${noted.map(r => r.name).join(" and ")} ${noted.length > 1 ? "are" : "is"} covered by an analyst note, so ${noted.length > 1 ? "they aren’t" : "it isn’t"} counted.`);
  }

  return { decision, reason, rules, fired, severe, severeFired, booster, boosters, victimCapped, total, travel, follow: [...new Set(follow)], access: ACCESS[decision], blocked };
}

export function resultOf(truth: Truth, decision: Decision): Result {
  const bad = truth === "Fraud" || truth === "At risk";
  const flagged = decision !== "Clear";
  if (bad) return flagged ? "Caught" : "Missed";
  return flagged ? "Wrongly flagged" : "Correctly cleared";
}
