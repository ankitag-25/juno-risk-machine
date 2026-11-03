// Turns the engine's outcome into plain-English reasons for the result page.
import { T, fmtMins, money, type Outcome, type User } from "../engine/rules";

export const LABEL: Record<Outcome["decision"], string> = {
  "Clear": "Not flagged",
  "Soft flag": "Soft flagged",
  "Hard flag": "Hard flagged",
  "Onboarding block": "Blocked at signup",
};

const city = (c: string) => c.split(",")[0];

function firedReason(id: string, u: User, o: Outcome): string {
  switch (id) {
    case "impossible_travel":
      return `Logged in from ${city(u.login_city)} ${u.gap_hours}h after ${city(u.prev_city)}. That trip takes at least ${Math.ceil(o.travel.needHours)}h.`;
    case "ip_jumping": return `${u.ips_last_hour} different IP addresses within an hour (flag at ${T.ipJumps}).`;
    case "mule_similarity": return `Behaviour is ${u.similarity_pct}% similar to known mule accounts (flag at ${T.similarity}%).`;
    case "foreign_inbound": return "Receives money from abroad.";
    case "cashapp_loops": return `Money goes back and forth with Cash App ${u.cashapp_loops} times a week (flag at ${T.cashapp}).`;
    case "same_amount": return `The same amount moves ${u.same_amount_repeats} times in a row (flag at ${T.sameAmount}).`;
    case "multi_bank_ach": return `Money arrives from ${u.ach_banks} different banks (flag at ${T.achBanks}).`;
    case "income_mismatch": return `${money(u.weekly_inflow_usd)} a week coming in on a Low income band (flag at ${money(T.incomeInflow)}).`;
    case "young_high_volume": return `Under ${T.youngAge}, Low income, with ${money(u.weekly_inflow_usd)} a week coming in.`;
    case "romance_scam": return `New account, aged ${u.age}, sending large transfers that receivers turn into crypto within ${fmtMins(u.receiver_crypto_mins)}. This matches the romance scam pattern.`;
    case "account_takeover": return "New device, a fresh password reset and crypto sent out in the same session. This looks like an account takeover.";
    case "deposit_dash": return `Crypto leaves for an outside wallet ${fmtMins(u.deposit_to_ext_mins)} after a deposit.`;
    case "strong_mule": return `${u.similarity_pct}% similar to known mule accounts. Above ${T.similaritySevere}% is an instant hard flag.`;
    case "new_senders": return `Money from ${u.new_senders_week} people they’ve never received from before, in one week.`;
    case "pass_through": return `Account is ${u.account_age_days} days old and 90%+ of ${money(u.weekly_inflow_usd)} a week leaves within 24 hours.`;
    case "dormant_reactivated": return "Dormant for 6+ months, now suddenly moving a lot of money.";
    case "new_recipients": return `Paid ${money(u.new_recipients_usd || 0)} to 5+ people they’ve never paid before, in one week.`;
    case "device_signups": return `${u.same_device_signups} Juno accounts were opened from this device within 24 hours.`;
    case "family_cashout": return `Part of a family cluster (same surname and address) moving ${money(u.weekly_inflow_usd)} a week out as crypto.`;
    case "online_tip": return "Told support they’re investing through someone they met online.";
    case "scam_wallet": return "The external wallet is linked to a known scam platform.";
    case "escalating": return "Each crypto transfer out is bigger than the last.";
    case "retirement_crypto": return `Aged ${u.age}, moving retirement or loan money out as crypto within days.`;
    case "third_party": return `Someone else asked support to move this ${u.age}-year-old’s money.`;
    case "gift_cards": return `Aged ${u.age} and bought several large gift cards in one week.`;
    case "senior_receiver": {
      const traits = [u.receiver_new && "the receiver’s account is under 30 days old", u.receiver_fast_crypto && "they cash out to crypto within an hour",
        u.receiver_many_seniors && "they get money from 3+ users aged 60+", u.receiver_flagged && "they’re already flagged"].filter(Boolean);
      return `Aged ${u.age}, sent $2,000+ to a new recipient, and ${traits.join(", ")}.`;
    }
    case "id_state": return "The state on their ID differs from where they usually log in.";
    case "structuring": return "Several deposits landed just under a reporting limit within a few days.";
    case "senior_takeover": return `Aged ${u.age}: phone or email changed, then a large amount left within days. This looks like a takeover.`;
    case "kyc_fail": return "Onfido couldn’t match their selfie to their ID, or the liveness check failed.";
    case "sanctions": return "Money moved from or to a sanctioned or very high-risk country.";
    case "refused_docs": return "Refused to explain where their money came from.";
    case "linked_ring": return "Shares a device or money flow with an account confirmed as a mule.";
    case "shared_device": return `Their device is also used by ${u.shared_device_accounts} other Juno accounts. This only counts next to other red flags.`;
    case "senior_first_crypto": return `Aged ${u.age}, first-ever crypto buy of $5,000+. This only counts next to other red flags.`;
    default: return id;
  }
}

export interface Explanation { summary: string; reasons: string[]; notes: string[] }

export function explain(u: User, o: Outcome): Explanation {
  const notes: string[] = [];
  o.rules.filter(r => r.noted).forEach(r => notes.push(`${r.name} is covered by an analyst note (${["impossible_travel", "ip_jumping"].includes(r.id) ? "confirmed VPN user" : "documents already verified"}), so it wasn’t counted.`));
  o.boosters.filter(b => !b.fired && b.id !== "same_day_crypto" && b.value.includes("alone")).forEach(b => notes.push(`${b.name} was seen but only counts next to other red flags, so it wasn’t counted.`));

  if (o.decision === "Onboarding block") {
    return { summary: "Juno only serves US residents.", reasons: ["Signed up from outside the US, so signup stops before an account exists."], notes: [] };
  }

  if (o.decision === "Clear") {
    const reasons = [
      "Signed up from the US.",
      "Login location and devices look normal.",
      "Money coming in looks normal.",
      "Money going out looks normal.",
      "No meaningful match with known mule accounts.",
    ];
    if (o.booster.present) reasons.push("Buying crypto the same day is normal on its own. It’s what Juno is for.");
    return { summary: "No red flags were counted.", reasons, notes };
  }

  const reasons: string[] = [];
  o.severeFired.forEach(s => reasons.push(firedReason(s.id, u, o)));
  o.fired.forEach(r => { if (!(r.id === "mule_similarity" && o.severeFired.some(s => s.id === "strong_mule"))) reasons.push(firedReason(r.id, u, o)); });
  o.boosters.filter(b => b.fired).forEach(b => reasons.push(b.id === "same_day_crypto"
    ? "Bought crypto with a deposit the same day. Normal on its own, but it adds weight next to other red flags."
    : firedReason(b.id, u, o)));

  let summary: string;
  if (o.severeFired.length) summary = "One severe signal is enough for a hard flag.";
  else if (o.victimCapped) summary = `${o.total} red flags, but every one points to a scam victim. Victims get a soft flag and a call, never a hard flag.`;
  else if (o.decision === "Soft flag" && o.fired.every(r => r.victim)) summary = "This looks like someone being scammed, not a fraudster. Soft flag and a support call.";
  else if (o.decision === "Hard flag") summary = `${o.total} red flags were counted. ${T.hardAt} or more is a hard flag.`;
  else summary = `${o.total} red flag${o.total > 1 ? "s were" : " was"} counted. In v1, one is enough for a soft flag.`;
  return { summary, reasons, notes };
}
