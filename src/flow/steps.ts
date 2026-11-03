// The guided flow: one question per screen.
// Each answer changes a few fields on a baseline user. The engine never sees the questions, only the user.
import { RULES, travelCheck, type User } from "../engine/rules";

export type IconName =
  | "flag" | "globe" | "user" | "wallet" | "calendar" | "pin" | "plane" | "zap"
  | "device" | "key" | "wifi" | "shield" | "x" | "dollar" | "bank" | "repeat"
  | "cycle" | "bitcoin" | "send" | "users" | "home" | "clock" | "network" | "check"
  | "face" | "id" | "alert" | "gift" | "chat" | "phone" | "link" | "ban" | "doc" | "trend";

export interface Option {
  id: string;
  label: string;
  sub?: string;
  icon: IconName;
  exclusive?: boolean;            // multi-select: "none of these"
  apply: Partial<User>;
  show?: (u: User) => boolean;    // only offer this option when it applies
}

export interface Step {
  id: string;
  title: string;
  hint?: string;
  multi?: boolean;
  options: Option[];
  show?: (u: User) => boolean;    // decided from the user built so far
}

export const BASE: User = {
  user_id: "YOU", persona: "Your user", truth: "",
  signup_country: "US", age: 32, income_band: "Mid", account_age_days: 240,
  prev_city: "New York, US", login_city: "New York, US", gap_hours: 20, ips_last_hour: 1,
  new_device: 0, password_reset: 0,
  weekly_inflow_usd: 300, ach_banks: 1, foreign_inbound: 0, cashapp_loops: 0, same_amount_repeats: 0, ach_crypto_same_day: 0,
  j2j_large_out: 0, receiver_crypto_mins: 720, ext_crypto_out: 0, ext_wallet_new: 0, deposit_to_ext_mins: 1440,
  similarity_pct: 10, vpn_note: 0,
};

const inUS = (u: User) => u.signup_country === "US";
const senior = (u: User) => inUS(u) && u.age >= 60;
/** Show the "documents already verified" question only when a money signal it could cover has fired. */
const docSignal = (u: User) => inUS(u) && RULES.some(r => r.docs && r.test(u, travelCheck(u)));

export const STEPS: Step[] = [
  // ---------- who they are ----------
  { id: "signup", title: "Where are they signing up from?", options: [
    { id: "us", label: "United States", sub: "Juno’s home market", icon: "flag", apply: {} },
    { id: "abroad", label: "Outside the US", sub: "For example Kenya or Nigeria", icon: "globe", apply: { signup_country: "KE", prev_city: "Nairobi, KE", login_city: "Nairobi, KE" } },
  ]},
  { id: "age", title: "How old are they?", show: inUS, options: [
    { id: "18", label: "18 to 24", icon: "user", apply: { age: 22 } },
    { id: "25", label: "25 to 44", icon: "user", apply: { age: 32 } },
    { id: "45", label: "45 to 59", icon: "user", apply: { age: 52 } },
    { id: "60", label: "60 or older", sub: "Senior citizen checks apply", icon: "user", apply: { age: 68 } },
  ]},
  { id: "income", title: "What’s their income band?", show: inUS, options: [
    { id: "low", label: "Low", sub: "Student or entry-level income", icon: "wallet", apply: { income_band: "Low" } },
    { id: "mid", label: "Mid", sub: "Typical salaried income", icon: "wallet", apply: { income_band: "Mid" } },
    { id: "high", label: "High", sub: "Well above average", icon: "wallet", apply: { income_band: "High" } },
  ]},
  { id: "tenure", title: "How long have they had a Juno account?", show: inUS, options: [
    { id: "new", label: "Less than 2 weeks", sub: "Brand new account", icon: "calendar", apply: { account_age_days: 7 } },
    { id: "month", label: "2 to 4 weeks", icon: "calendar", apply: { account_age_days: 21 } },
    { id: "year", label: "Over a year, active", icon: "calendar", apply: { account_age_days: 400 } },
    { id: "dormant", label: "Over a year, dormant until now", sub: "No activity for 6+ months", icon: "clock", apply: { account_age_days: 500, dormant_reactivated: 1 } },
  ]},
  { id: "kyc", title: "How did identity checks go?", hint: "Pick all that apply.", multi: true, show: inUS, options: [
    { id: "face", label: "Onfido selfie or liveness check failed", icon: "face", apply: { kyc_face_fail: 1 } },
    { id: "state", label: "ID state differs from where they log in", icon: "id", apply: { id_state_mismatch: 1 } },
    { id: "signups", label: "3+ accounts opened from this device in 24h", icon: "device", apply: { same_device_signups: 3 } },
    { id: "none", label: "Everything checked out", icon: "check", exclusive: true, apply: {} },
  ]},

  // ---------- logins ----------
  { id: "location", title: "Where are they logging in from?", hint: "Compared with where they last logged in, New York.", show: inUS, options: [
    { id: "same", label: "Same city as usual", icon: "pin", apply: {} },
    { id: "trip", label: "Abroad, after a realistic trip", sub: "London, 14 hours later", icon: "plane", apply: { login_city: "London, UK", gap_hours: 14 } },
    { id: "jump", label: "Abroad, an hour after a US login", sub: "London, 1 hour later", icon: "zap", apply: { login_city: "London, UK", gap_hours: 1 } },
  ]},
  { id: "session", title: "Anything unusual about their logins?", hint: "Pick all that apply.", multi: true, show: inUS, options: [
    { id: "device", label: "New phone or laptop", sub: "Passed OTP or biometric", icon: "device", apply: { new_device: 1 } },
    { id: "reset", label: "Password was just reset", icon: "key", apply: { password_reset: 1 } },
    { id: "ips", label: "IP address keeps changing", sub: "6 different IPs in an hour", icon: "wifi", apply: { ips_last_hour: 6 } },
    { id: "shared", label: "Device also used by 3+ other accounts", icon: "users", apply: { shared_device_accounts: 3 } },
    { id: "contact", label: "Phone or email changed, then a large outflow", icon: "phone", show: senior, apply: { contact_change_outflow: 1 } },
    { id: "none", label: "Nothing unusual", icon: "check", exclusive: true, apply: {} },
  ]},
  { id: "vpn", title: "Has support confirmed they use a VPN?", hint: "If yes, an analyst has added a note to their profile.",
    show: u => inUS(u) && (u.ips_last_hour >= 4 || travelCheck(u).impossible), options: [
    { id: "yes", label: "Yes, there’s an analyst note", icon: "shield", apply: { vpn_note: 1 } },
    { id: "no", label: "No", icon: "x", apply: {} },
  ]},

  // ---------- money in ----------
  { id: "inflow", title: "How much money comes in each week?", show: inUS, options: [
    { id: "lt500", label: "Under $500", icon: "dollar", apply: { weekly_inflow_usd: 300 } },
    { id: "500", label: "$500 to $999", icon: "dollar", apply: { weekly_inflow_usd: 700 } },
    { id: "1000", label: "$1,000 to $2,499", icon: "dollar", apply: { weekly_inflow_usd: 1500 } },
    { id: "2500", label: "$2,500 or more", icon: "dollar", apply: { weekly_inflow_usd: 3000 } },
  ]},
  { id: "sources", title: "How does that money arrive?", hint: "Pick all that apply.", multi: true, show: inUS, options: [
    { id: "banks", label: "From 4 or more different banks", icon: "bank", apply: { ach_banks: 5 } },
    { id: "senders", label: "From 5+ people they’ve never received from", sub: "In one week", icon: "users", apply: { new_senders_week: 6 } },
    { id: "foreign", label: "From abroad", icon: "globe", apply: { foreign_inbound: 1 } },
    { id: "cashapp", label: "Cash App back and forth", sub: "4 times a week", icon: "repeat", apply: { cashapp_loops: 4 } },
    { id: "same", label: "The same amount, over and over", sub: "4 times in a row", icon: "cycle", apply: { same_amount_repeats: 4 } },
    { id: "struct", label: "Several deposits just under $10,000", sub: "e.g. $9,500, then $9,800", icon: "alert", apply: { structuring: 1 } },
    { id: "retire", label: "From a retirement account or loan", icon: "bank", show: senior, apply: { retirement_to_crypto: 1 } },
    { id: "none", label: "Nothing unusual", sub: "Paycheck or 1 or 2 banks", icon: "check", exclusive: true, apply: {} },
  ]},

  // ---------- money out ----------
  { id: "outflow", title: "What do they do with the money?", hint: "Pick all that apply.", multi: true, show: inUS, options: [
    { id: "buy", label: "Buy crypto the same day", sub: "Kept inside Juno", icon: "bitcoin", apply: { ach_crypto_same_day: 1 } },
    { id: "bigcrypto", label: "First-ever crypto buy, $5,000+", icon: "bitcoin", show: senior, apply: { first_big_crypto: 1, ach_crypto_same_day: 1 } },
    { id: "ext", label: "Send crypto to an outside wallet", icon: "send", apply: { ext_crypto_out: 1, ext_wallet_new: 1 } },
    { id: "j2j", label: "Send large amounts to other Juno users", icon: "users", apply: { j2j_large_out: 4 } },
    { id: "newpeople", label: "Pay 5+ people they’ve never paid before", sub: "In one week", icon: "users", apply: { new_recipients_5plus: 1 } },
    { id: "senior_new", label: "Send $2,000+ to a new Juno user", icon: "send", show: senior, apply: { senior_new_recipient: 1 } },
    { id: "gift", label: "Buy several large gift cards", sub: "In one week", icon: "gift", show: senior, apply: { gift_cards: 1 } },
    { id: "pass", label: "Most of it leaves within 24 hours", sub: "90%+ passes straight through", icon: "zap", apply: { pass_through: 1 } },
    { id: "none", label: "Keep it or spend it normally", icon: "home", exclusive: true, apply: {} },
  ]},
  { id: "dash", title: "How soon after a deposit does the crypto leave?", show: u => inUS(u) && !!u.ext_crypto_out, options: [
    { id: "fast", label: "Within 30 minutes", icon: "zap", apply: { deposit_to_ext_mins: 10 } },
    { id: "day", label: "Later the same day", icon: "clock", apply: { deposit_to_ext_mins: 300 } },
    { id: "days", label: "Days later", icon: "calendar", apply: { deposit_to_ext_mins: 1440 } },
  ]},
  { id: "wallet", title: "What do we know about that outside wallet?", hint: "Pick all that apply.", multi: true, show: u => inUS(u) && !!u.ext_crypto_out, options: [
    { id: "scam", label: "Linked to a known scam platform", sub: "Flagged by blockchain analytics", icon: "alert", apply: { scam_wallet: 1 } },
    { id: "escalate", label: "Each transfer is bigger than the last", icon: "trend", apply: { escalating_out: 1 } },
    { id: "none", label: "Nothing unusual", icon: "check", exclusive: true, apply: {} },
  ]},
  { id: "payout", title: "How much went to those new people in total?", show: u => inUS(u) && !!u.new_recipients_5plus, options: [
    { id: "small", label: "Under $5,000", sub: "Bills, rent, splitting costs", icon: "home", apply: { new_recipients_usd: 1200 } },
    { id: "big", label: "Over $5,000", icon: "dollar", apply: { new_recipients_usd: 8000 } },
  ]},
  { id: "receiver", title: "How fast do the receivers turn it into crypto?", show: u => inUS(u) && u.j2j_large_out > 0, options: [
    { id: "fast", label: "Within 10 minutes", icon: "zap", apply: { receiver_crypto_mins: 5 } },
    { id: "hours", label: "Within a few hours", icon: "clock", apply: { receiver_crypto_mins: 180 } },
    { id: "slow", label: "Not quickly", icon: "calendar", apply: { receiver_crypto_mins: 720 } },
  ]},
  { id: "senior_receiver", title: "What do we know about the person they paid?", hint: "Pick all that apply.", multi: true, show: u => senior(u) && !!u.senior_new_recipient, options: [
    { id: "new", label: "Their account is under 30 days old", icon: "calendar", apply: { receiver_new: 1 } },
    { id: "fast", label: "They turn it into crypto within an hour", icon: "zap", apply: { receiver_fast_crypto: 1 } },
    { id: "seniors", label: "They get money from 3+ users aged 60+", icon: "users", apply: { receiver_many_seniors: 1 } },
    { id: "flagged", label: "They’re already flagged", icon: "alert", apply: { receiver_flagged: 1 } },
    { id: "none", label: "Nothing unusual", icon: "check", exclusive: true, apply: {} },
  ]},

  // ---------- support conversations ----------
  { id: "support", title: "Has the user said anything to support?", hint: "Pick all that apply.", multi: true, show: inUS, options: [
    { id: "tip", label: "They invest through someone they met online", icon: "chat", apply: { online_investment_tip: 1 } },
    { id: "urgent", label: "They’re distressed, want funds released fast", icon: "alert", apply: { distressed_support: 1 } },
    { id: "third", label: "Someone else asked to move their money", icon: "phone", show: senior, apply: { third_party_request: 1 } },
    { id: "refused", label: "They refused to explain where money came from", icon: "ban", apply: { refuses_docs: 1 } },
    { id: "none", label: "Nothing unusual, or no contact", icon: "check", exclusive: true, apply: {} },
  ]},

  // ---------- network ----------
  { id: "mule", title: "How closely do they match known mule accounts?", hint: "Juno’s network model compares behaviour, devices and connections.", show: inUS, options: [
    { id: "no", label: "Not at all", icon: "check", apply: { similarity_pct: 10 } },
    { id: "some", label: "Somewhat", sub: "65% similar", icon: "network", apply: { similarity_pct: 65 } },
    { id: "very", label: "Very closely", sub: "85% similar", icon: "network", apply: { similarity_pct: 85 } },
  ]},
  { id: "links", title: "Any links to other accounts or places?", hint: "Pick all that apply.", multi: true, show: inUS, options: [
    { id: "family", label: "Same surname and address as 3+ accounts", sub: "Money moves between them", icon: "home", apply: { family_cluster: 1 } },
    { id: "ring", label: "Linked to an account confirmed as a mule", sub: "Same device or money flow", icon: "link", apply: { linked_confirmed_ring: 1 } },
    { id: "sanctions", label: "Money from or to a sanctioned country", icon: "ban", apply: { sanctioned_country: 1 } },
    { id: "none", label: "None", icon: "check", exclusive: true, apply: {} },
  ]},

  // ---------- analyst notes ----------
  { id: "docs", title: "Has this user already sent documents and been cleared?", hint: "If yes, an analyst note covers the money-related signals they explained.", show: docSignal, options: [
    { id: "yes", label: "Yes, documents verified", icon: "doc", apply: { docs_cleared: 1 } },
    { id: "no", label: "No", icon: "x", apply: {} },
  ]},
];

/** Options of a step that apply to the user built so far. */
export function visibleOptions(step: Step, u: User): Option[] {
  return step.options.filter(o => !o.show || o.show(u));
}

export type Answers = Record<string, string[]>;

/** Build the user from answers, in step order. Hidden steps are ignored. */
export function buildUser(answers: Answers): User {
  let u: User = { ...BASE };
  for (const s of STEPS) {
    if (s.show && !s.show(u)) continue;
    for (const id of answers[s.id] || []) {
      const o = s.options.find(x => x.id === id);
      if (o && (!o.show || o.show(u))) u = { ...u, ...o.apply };
    }
  }
  return u;
}

/** The user built from every step before `stepId`. Used to decide which options to show. */
export function userBefore(answers: Answers, stepId: string): User {
  let u: User = { ...BASE };
  for (const s of STEPS) {
    if (s.id === stepId) break;
    if (s.show && !s.show(u)) continue;
    for (const id of answers[s.id] || []) {
      const o = s.options.find(x => x.id === id);
      if (o && (!o.show || o.show(u))) u = { ...u, ...o.apply };
    }
  }
  return u;
}

/** Steps that are visible given the answers so far. */
export function visibleSteps(answers: Answers): Step[] {
  let u: User = { ...BASE };
  const out: Step[] = [];
  for (const s of STEPS) {
    if (s.show && !s.show(u)) continue;
    out.push(s);
    for (const id of answers[s.id] || []) {
      const o = s.options.find(x => x.id === id);
      if (o && (!o.show || o.show(u))) u = { ...u, ...o.apply };
    }
  }
  return out;
}
