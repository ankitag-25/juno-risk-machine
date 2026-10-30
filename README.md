# Juno Risk Machine


An interactive fraud rules simulator. Build a synthetic user (who they are, how they log in, how money moves in and out) and watch the machine decide: **Clear**, **Soft flag**, **Hard flag** or **Onboarding block**, with every rule traced.

## Why this exists

Juno Finance was a US crypto neobank ($1B TPV, 300K+ users). In the risk team , I designed fraud controls built on anti fraud and AML principles:


These controls cut onboarding fraud by ~30% and transaction fraud by up to 35%. This project rebuilds that rule logic on synthetic data so anyone can poke at the trade-off between catching fraud and wrongly flagging good customers.

## How the machine decides (v1)

Checked in this order. The first match wins.

| Step | Condition | Decision |
|---|---|---|
| 1 | Signed up outside the US | **Onboarding block** |
| 2 | Any severe signal (below) | **Hard flag** |
| 3 | 3 or more red flags counted | **Hard flag** |
| 4 | 1 or 2 red flags counted | **Soft flag** |
| 5 | Nothing fired | **Clear** |

**Severe signals** (one is enough for a hard flag): account takeover (new device + password reset + external crypto out), deposit and dash (external crypto out within 30 minutes of a deposit), and strong mule match (80%+ similarity to known mule accounts).

**Red flags:** impossible travel, IP jumping, mule similarity (60%+), foreign inbound money, Cash App loops, same-amount cycling, multi-bank ACH, income mismatch, young + high volume, and romance scam pattern.

**Booster:** buying crypto with an ACH deposit the same day is what Juno is built for, so it never flags on its own. It adds +1 only when another red flag already fired.

**Analyst notes:** if support confirms a user is on a VPN, an analyst adds a note. IP jumping and impossible travel are then treated as known behaviour. Every other signal, including takeover, still fires.

### What each decision means for the user

| Decision | Deposits | Withdrawals | Juno-to-Juno | Crypto out | Next step |
|---|---|---|---|---|---|
| Clear | ✅ | ✅ | ✅ | ✅ | None |
| Soft flag | ✅ | ❌ | ✅ | ❌ | Documents (light docs for travel, support chat for VPN) |
| Hard flag | ❌ | ❌ | ❌ | ❌ | Manual review |
| Onboarding block | No account is created | | | | |

## Project structure

```
src/
  engine/
    rules.ts        ← the whole rules engine: thresholds, rules, decision logic
    users.ts        ← 50 synthetic users + 13 hand-built scenarios (fixed seed)
    rules.test.ts   ← acceptance tests: 15 / 8 / 1 and every scenario
  components/       ← React UI (builder, result panel, rule check table)
  theme.css         ← every color and font in one file
  styles.css        ← layout and component styles
```


