import type { User } from "../engine/rules";

export type FieldKey = keyof User;
export interface Field {
  key: FieldKey | "_travel";
  label?: string;
  type: "range" | "toggle" | "seg" | "select" | "travel";
  min?: number; max?: number; step?: number;
  unit?: "$" | "min" | "%" | "d" | "h";
  options?: string[];
  off?: (u: User) => boolean;
}
export interface Group { group: string; hint?: string; items: Field[] }

export const FIELDS: Group[] = [
  { group: "Who they are", items: [
    { key: "signup_country", label: "Signup country", type: "select", options: ["US", "KE", "NG", "IN", "UK", "MX"] },
    { key: "age", label: "Age", type: "range", min: 18, max: 80 },
    { key: "income_band", label: "Income band", type: "seg", options: ["Low", "Mid", "High"] },
    { key: "account_age_days", label: "Account age", type: "range", min: 0, max: 900, unit: "d" },
  ]},
  { group: "Logins", hint: "The machine checks whether the jump between the last two login locations is physically possible.", items: [
    { key: "_travel", type: "travel" },
    { key: "gap_hours", label: "Hours between those logins", type: "range", min: 0, max: 48, step: 0.5, unit: "h" },
    { key: "ips_last_hour", label: "Different IPs in the last hour", type: "range", min: 1, max: 12 },
    { key: "new_device", label: "New device, passed OTP or biometric", type: "toggle" },
    { key: "password_reset", label: "Password reset this session", type: "toggle" },
  ]},
  { group: "Money in", items: [
    { key: "weekly_inflow_usd", label: "Weekly inflow", type: "range", min: 0, max: 5000, step: 10, unit: "$" },
    { key: "ach_banks", label: "Banks sending ACH", type: "range", min: 1, max: 10 },
    { key: "foreign_inbound", label: "Receives money from abroad", type: "toggle" },
    { key: "cashapp_loops", label: "Cash App loops per week", type: "range", min: 0, max: 10 },
    { key: "same_amount_repeats", label: "Same-amount repeats", type: "range", min: 0, max: 10 },
    { key: "ach_crypto_same_day", label: "Buys crypto with most of an ACH deposit the same day", type: "toggle" },
  ]},
  { group: "Money out", items: [
    { key: "j2j_large_out", label: "Large Juno-to-Juno transfers sent", type: "range", min: 0, max: 10 },
    { key: "receiver_crypto_mins", label: "Receiver converts to crypto after", type: "range", min: 0, max: 720, unit: "min", off: u => !u.j2j_large_out },
    { key: "ext_crypto_out", label: "Sends crypto to an external wallet", type: "toggle" },
    { key: "ext_wallet_new", label: "That wallet has never been used before", type: "toggle", off: u => !u.ext_crypto_out },
    { key: "deposit_to_ext_mins", label: "Time from deposit to that withdrawal", type: "range", min: 0, max: 1440, unit: "min", off: u => !u.ext_crypto_out },
  ]},
  { group: "Network", items: [
    { key: "similarity_pct", label: "Similarity to known mule accounts", type: "range", min: 0, max: 100, unit: "%" },
  ]},
  { group: "Risk team notes", hint: "Context an analyst adds after talking to the user. It covers known behaviour, not new red flags.", items: [
    { key: "vpn_note", label: "Analyst note: confirmed VPN user", type: "toggle" },
  ]},
];
