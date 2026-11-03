// Builds the analyst view of the user (balances, transactions, logins, notes) from the answers.
// Everything is derived from the user the engine judged, so the page always matches the decision.
import { fmtMins, money, type Outcome, type User } from "../engine/rules";

export interface Txn { when: string; label: string; detail: string; amount: number; dir: "in" | "out" | "neutral" }
export interface Login { ip: string; place: string; when: string; device: string; isNew: boolean; extra?: string }
export interface Note { when: string; who: string; text: string; kind: "machine" | "analyst" | "you" }
export interface Profile {
  name: string; age: number; state: string; signupCountry: string;
  cash: number; cryptoBtc: number; cryptoUsd: number;
  txns: Txn[]; latest: Login; previous: Login; notes: Note[]; hasAccount: boolean;
  kyc: { ok: boolean; text: string }[];
}

const BTC_USD = 68000; // illustrative price
const STATES = ["New York", "California", "Texas", "Florida", "Illinois", "Washington", "Georgia", "New Jersey"];
const BANKS = ["Chase", "Wells Fargo", "Bank of America", "Citi", "Ally", "Capital One"];

function seeded(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}

export function buildProfile(u: User, o: Outcome, seedText: string): Profile {
  const rnd = seeded(seedText);
  const pick = <X,>(a: X[]) => a[Math.floor(rnd() * a.length)];
  const name = rnd() < 0.5 ? "John Doe" : "Jane Doe";
  const hasAccount = u.signup_country === "US";
  const w = u.weekly_inflow_usd;

  // ---- transactions, newest first ----
  const t: Txn[] = [];
  if (hasAccount) {
    if (u.sanctioned_country) t.push({ when: "Today, 10:05", label: "Wire", detail: "Counterparty in a sanctioned or high-risk country", amount: -Math.round(w * 0.5), dir: "out" });
    if (u.ext_crypto_out) {
      if (u.escalating_out) t.push({ when: "Last week", label: "Crypto out", detail: "Same wallet, smaller amount", amount: -Math.round(w * 0.4), dir: "out" });
      t.push({ when: "Today, 09:42", label: "Crypto out", detail: `To a ${u.ext_wallet_new ? "new " : ""}external wallet bc1q…7f3k${u.scam_wallet ? " (linked to a scam platform)" : ""}, ${fmtMins(u.deposit_to_ext_mins)} after deposit`, amount: -Math.round(w * 0.9), dir: "out" });
    }
    if (u.gift_cards) t.push({ when: "Mon, 11:30", label: "Debit card", detail: "Gift cards, 4 purchases this week", amount: -1600, dir: "out" });
    if (u.senior_new_recipient) t.push({ when: "Today, 09:20", label: "Juno transfer out", detail: "To a recipient they’ve never paid before", amount: -2400, dir: "out" });
    if (u.new_recipients_5plus) t.push({ when: "This week", label: "Payments out", detail: "To 5 people they’ve never paid before", amount: -(u.new_recipients_usd || 1200), dir: "out" });
    if (u.j2j_large_out) {
      t.push({ when: "Today, 09:15", label: "Juno transfer out", detail: `${u.j2j_large_out} large transfers this week. Receiver converts to crypto in ${fmtMins(u.receiver_crypto_mins)}`, amount: -Math.round(w * 0.8), dir: "out" });
    }
    if (u.ach_crypto_same_day) {
      t.push({ when: "Today, 08:40", label: "Crypto buy (BTC)", detail: "Same day as the ACH deposit, kept in Juno", amount: -Math.round(w * 0.85), dir: "neutral" });
    }
    if (u.ach_banks >= 4) {
      BANKS.slice(0, Math.min(u.ach_banks, 4)).forEach((b, i) =>
        t.push({ when: `Yesterday, ${10 + i}:0${i}`, label: "ACH in", detail: `From ${b}${i === 3 && u.ach_banks > 4 ? ` (+${u.ach_banks - 4} more banks)` : ""}`, amount: Math.round(w / Math.min(u.ach_banks, 4)), dir: "in" }));
    } else {
      t.push({ when: "Today, 08:31", label: "ACH in", detail: `Payroll from ${pick(BANKS)}`, amount: Math.round(w * 0.9), dir: "in" });
    }
    if (u.retirement_to_crypto) t.push({ when: "Mon, 09:00", label: "ACH in", detail: "Retirement account withdrawal", amount: 12000, dir: "in" });
    if (u.structuring) { t.push({ when: "Tue, 10:12", label: "Deposit", detail: "Just under the $10,000 reporting limit", amount: 9500, dir: "in" }); t.push({ when: "Thu, 15:40", label: "Deposit", detail: "Just under the $10,000 reporting limit", amount: 9800, dir: "in" }); }
    if ((u.new_senders_week || 0) >= 5) t.push({ when: "This week", label: "Transfers in", detail: `From ${u.new_senders_week} people they’ve never received from`, amount: Math.round(w * 0.6), dir: "in" });
    if (u.foreign_inbound) t.push({ when: "Yesterday, 18:20", label: "Wire in", detail: "International transfer from abroad", amount: Math.round(w * 0.3), dir: "in" });
    if (u.cashapp_loops >= 3) {
      t.push({ when: "Mon, 14:05", label: "Cash App in", detail: `${u.cashapp_loops} round-trips this week`, amount: 200, dir: "in" });
      t.push({ when: "Mon, 14:22", label: "Cash App out", detail: "Same counterparty", amount: -200, dir: "out" });
    }
    if (u.same_amount_repeats >= 3) {
      for (let i = 0; i < 3; i++) t.push({ when: `Sun, 1${i}:00`, label: "Transfer in", detail: `Same amount, repeat ${i + 1} of ${u.same_amount_repeats}`, amount: 250, dir: "in" });
    }
    if (t.length < 4) {
      t.push({ when: "Sat, 19:12", label: "Debit card", detail: "Grocery store", amount: -64, dir: "out" });
      t.push({ when: "Fri, 08:05", label: "Debit card", detail: "Coffee shop", amount: -7, dir: "out" });
    }
  }

  // ---- balances ----
  const moneyLeft = u.ext_crypto_out || u.j2j_large_out;
  const cash = hasAccount ? Math.max(40, Math.round(w * (moneyLeft ? 0.25 : 1.6) + rnd() * 120)) : 0;
  const cryptoUsd = hasAccount ? Math.round(u.ach_crypto_same_day ? w * 0.85 + 150 : 120 + rnd() * 300) : 0;
  const cryptoBtc = cryptoUsd / BTC_USD;

  // ---- logins (documentation IP ranges, never real addresses) ----
  const abroad = u.login_city !== u.prev_city;
  const previous: Login = { ip: "198.51.100.24", place: u.prev_city.replace(", US", ", USA"), when: `${u.gap_hours}h before latest`, device: "iPhone, known device", isNew: false };
  const latest: Login = {
    ip: abroad ? "203.0.113.57" : u.ips_last_hour >= 4 ? "192.0.2.183" : "198.51.100.24",
    place: abroad ? u.login_city.replace(", UK", ", United Kingdom") : u.prev_city.replace(", US", ", USA"),
    when: "Today, 09:02",
    device: u.new_device ? "New device, passed OTP" : "iPhone, known device",
    isNew: abroad || u.ips_last_hour >= 4 || !!u.new_device,
    extra: [u.ips_last_hour >= 4 ? `${u.ips_last_hour} different IPs in the last hour` : "", u.password_reset ? "Password reset this session" : "",
      u.contact_change_outflow ? "Phone number changed 2 days ago" : "", (u.shared_device_accounts || 0) >= 3 ? `Device shared with ${u.shared_device_accounts} other accounts` : "",
      (u.same_device_signups || 0) >= 3 ? `${u.same_device_signups} accounts opened from this device in 24h` : ""].filter(Boolean).join(" · ") || undefined,
  };

  // ---- flag history ----
  const notes: Note[] = [];
  if (!hasAccount) notes.push({ when: "Today", who: "Risk Machine", text: "Signup blocked. Juno only serves US residents.", kind: "machine" });
  else if (o.decision !== "Clear") notes.push({ when: "Today", who: "Risk Machine", text: `${o.decision}. ${o.reason}`, kind: "machine" });
  if (u.online_investment_tip) notes.push({ when: "2 days ago", who: "Support", text: "User said they invest through a platform recommended by someone they met online.", kind: "analyst" });
  if (u.distressed_support) notes.push({ when: "Yesterday", who: "Support", text: "User sounded distressed and asked for funds to be released urgently.", kind: "analyst" });
  if (u.third_party_request && u.age >= 60) notes.push({ when: "Yesterday", who: "Support", text: "A third party called asking to move this user’s money. Request refused.", kind: "analyst" });
  if (u.refuses_docs) notes.push({ when: "Last week", who: "Risk analyst", text: "User refused to explain the source of funds when asked.", kind: "analyst" });
  if (u.linked_confirmed_ring) notes.push({ when: "Last week", who: "Risk analyst", text: "Linked by device or money flow to an account confirmed as a mule.", kind: "analyst" });
  if (u.docs_cleared) notes.push({ when: "1 month ago", who: "Risk analyst", text: "Documents verified the source of funds. Money signals they explain are covered.", kind: "analyst" });
  if (u.vpn_note) notes.push({ when: "3 weeks ago", who: "Risk analyst", text: "User confirmed VPN use over a support chat. IP jumping is known behaviour for this account.", kind: "analyst" });

  const kyc = hasAccount ? [
    { ok: !u.kyc_face_fail, text: u.kyc_face_fail ? "Onfido: selfie didn’t match the ID or liveness failed" : "Onfido: selfie and liveness passed" },
    { ok: !u.id_state_mismatch, text: u.id_state_mismatch ? "ID state differs from where they usually log in" : "ID state matches their usual logins" },
  ] : [];

  return {
    kyc,
    name, age: u.age, state: hasAccount ? pick(STATES) : "—", signupCountry: u.signup_country,
    cash, cryptoBtc, cryptoUsd, txns: t, latest, previous, notes, hasAccount,
  };
}

export const fmtUsd = (n: number) => (n < 0 ? "−" : "+") + money(Math.abs(n));
