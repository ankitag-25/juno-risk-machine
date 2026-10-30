// Synthetic users. Deterministic: the same seed always produces the same 50 users.
import { US_CITIES, type User, type Truth } from "./rules";

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Partial2 = Partial<Omit<User, "user_id" | "persona" | "truth">>;
const IMPOSSIBLE: Partial2 = { prev_city: "New York, US", login_city: "London, UK", gap_hours: 2 };

export function makeUsers(seed = 20250): User[] {
  const rnd = mulberry32(seed);
  const ri = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
  const pick = <X,>(arr: X[]) => arr[Math.floor(rnd() * arr.length)];

  const base = (persona: string, truth: Truth): Omit<User, "user_id"> => {
    const home = pick(US_CITIES);
    return {
      persona, truth, signup_country: "US",
      age: ri(26, 44), income_band: pick(["Mid", "High"] as const), account_age_days: ri(60, 700),
      prev_city: home, login_city: home, gap_hours: ri(6, 48), ips_last_hour: ri(1, 2),
      new_device: 0, password_reset: 0,
      weekly_inflow_usd: ri(8, 45) * 10, ach_banks: ri(1, 2), foreign_inbound: 0,
      cashapp_loops: ri(0, 1), same_amount_repeats: ri(0, 1), ach_crypto_same_day: 0,
      j2j_large_out: ri(0, 1), receiver_crypto_mins: ri(120, 720),
      ext_crypto_out: 0, ext_wallet_new: 0, deposit_to_ext_mins: 1440,
      similarity_pct: ri(0, 25), vpn_note: 0,
    };
  };

  const spec: Omit<User, "user_id">[] = [];
  const add = (n: number, persona: string, truth: Truth, o: Partial2 = {}) => {
    for (let i = 0; i < n; i++) spec.push({ ...base(persona, truth), ...o });
  };

  add(26, "Regular user", "Legit");
  add(1, "Frequent traveler on VPN", "Legit", { ...IMPOSSIBLE });
  add(1, "Traveling consultant", "Legit", { prev_city: "Chicago, US", login_city: "Dubai, AE", gap_hours: 3, income_band: "High" });
  add(1, "Freelancer, many clients", "Legit", { ach_banks: 5, weekly_inflow_usd: 420 });
  add(1, "Gets money from family abroad", "Legit", { foreign_inbound: 1 });
  add(1, "Splits rent with roommates", "Legit", { same_amount_repeats: 4 });
  add(1, "Side-hustle seller", "Legit", { cashapp_loops: 4 });
  add(1, "Student, parents send money", "Legit", { age: 21, income_band: "Low", weekly_inflow_usd: 1100 });
  add(1, "New grad, bonus week", "Legit", { age: 27, income_band: "Low", weekly_inflow_usd: 620 });
  add(2, "Out-of-market signup", "Fraud", { signup_country: "KE", prev_city: "Nairobi, KE", login_city: "Nairobi, KE" });
  add(1, "Mule ring member", "Fraud", { similarity_pct: 78, j2j_large_out: 5, receiver_crypto_mins: 4, account_age_days: 12 });
  add(1, "Mule ring member", "Fraud", { similarity_pct: 71, foreign_inbound: 1, account_age_days: 9, receiver_crypto_mins: 6 });
  add(1, "Mule ring member", "Fraud", { similarity_pct: 64, account_age_days: 20 });
  add(1, "Mule ring member", "Fraud", { similarity_pct: 83, ach_banks: 4, cashapp_loops: 3, weekly_inflow_usd: 2400, income_band: "Low" });
  add(1, "Laundering via Cash App", "Fraud", { cashapp_loops: 6, same_amount_repeats: 5, weekly_inflow_usd: 1800 });
  add(1, "Round-tripping same amount", "Fraud", { same_amount_repeats: 7, ach_banks: 5, weekly_inflow_usd: 3000 });
  add(1, "Multi-bank ACH funnel", "Fraud", { ach_banks: 7, foreign_inbound: 1, weekly_inflow_usd: 2600 });
  add(1, "Unexplained income", "Fraud", { income_band: "Low", weekly_inflow_usd: 900, foreign_inbound: 1 });
  add(1, "Young, high-volume, low income", "Fraud", { age: 22, income_band: "Low", weekly_inflow_usd: 1500, cashapp_loops: 3 });
  add(1, "Account takeover", "Fraud", { ...IMPOSSIBLE, ach_banks: 4, weekly_inflow_usd: 700 });
  add(1, "Romance scam victim", "At risk", { age: 58, account_age_days: 5, j2j_large_out: 4, receiver_crypto_mins: 3, weekly_inflow_usd: 3000, income_band: "High" });
  add(1, "Romance scam victim", "At risk", { age: 51, account_age_days: 9, j2j_large_out: 3, receiver_crypto_mins: 8, weekly_inflow_usd: 1500 });
  add(1, "Single-signal fraudster", "Fraud", { foreign_inbound: 1, weekly_inflow_usd: 380 });
  add(1, "Low-and-slow fraudster", "Fraud", { weekly_inflow_usd: 300 });

  for (let i = spec.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [spec[i], spec[j]] = [spec[j], spec[i]];
  }
  return spec.map((u, i) => ({ user_id: "J-" + (1001 + i), ...u }));
}

/** Hand-built scenarios that exercise the login and money-out rules.
 *  Kept out of the 50-user check so the acceptance numbers stay clean. */
export function makeScenarios(): User[] {
  const b: Omit<User, "user_id" | "persona" | "truth"> = {
    signup_country: "US", age: 32, income_band: "Mid", account_age_days: 240,
    prev_city: "New York, US", login_city: "New York, US", gap_hours: 20, ips_last_hour: 1,
    new_device: 0, password_reset: 0, weekly_inflow_usd: 300, ach_banks: 1, foreign_inbound: 0,
    cashapp_loops: 0, same_amount_repeats: 0, ach_crypto_same_day: 0, j2j_large_out: 0, receiver_crypto_mins: 600,
    ext_crypto_out: 0, ext_wallet_new: 0, deposit_to_ext_mins: 1440, similarity_pct: 10, vpn_note: 0,
  };
  const s = (user_id: string, persona: string, truth: Truth, o: Partial2 = {}): User => ({ ...b, user_id, persona, truth, ...o });
  return [
    s("S-01", "Regular user", "Legit"),
    s("S-02", "Realistic trip abroad", "Legit", { login_city: "London, UK", gap_hours: 14 }),
    s("S-03", "Impossible login jump", "Legit", { login_city: "London, UK", gap_hours: 2 }),
    s("S-04", "VPN user, IPs jumping", "Legit", { ips_last_hour: 6 }),
    s("S-05", "VPN user with analyst note", "Legit", { ips_last_hour: 6, vpn_note: 1 }),
    s("S-06", "VPN note, then account takeover", "Fraud", { ips_last_hour: 6, vpn_note: 1, new_device: 1, password_reset: 1, ext_crypto_out: 1, ext_wallet_new: 1, deposit_to_ext_mins: 600 }),
    s("S-07", "Account takeover", "Fraud", { new_device: 1, password_reset: 1, ext_crypto_out: 1, ext_wallet_new: 1, deposit_to_ext_mins: 900 }),
    s("S-08", "Deposit and dash", "Fraud", { account_age_days: 6, ext_crypto_out: 1, ext_wallet_new: 1, deposit_to_ext_mins: 8 }),
    s("S-09", "New account, one red flag", "Fraud", { account_age_days: 5, ach_banks: 5 }),
    s("S-10", "New phone, OTP passed", "Legit", { new_device: 1 }),
    s("S-11", "Old account, crypto to a new wallet", "Legit", { ext_crypto_out: 1, ext_wallet_new: 1, deposit_to_ext_mins: 1440 }),
    s("S-12", "Same-day ACH to crypto only", "Legit", { ach_crypto_same_day: 1 }),
    s("S-13", "Two flags + same-day crypto buy", "Fraud", { ips_last_hour: 5, cashapp_loops: 4, ach_crypto_same_day: 1 }),
  ];
}
