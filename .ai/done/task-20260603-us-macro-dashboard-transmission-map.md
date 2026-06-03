target: us-macro-dashboard

# Task
Upgrade the US Macro Dashboard from an indicator-card dashboard into a real macro transmission system map.

## Core problem
The current dashboard is useful, but it still feels like fragmented puzzle pieces:

```text
Growth / Labor / Inflation / Rates / Liquidity / Credit / Housing
```

This is a category dashboard, not a system dashboard.

The user wants the dashboard to feel like a live cross-section of the US economic machine:

```text
What is driving what?
Where is the machine stuck?
Which channel is leading?
Which channel confirms?
Which channel is lagging?
```

## Main goal
Add a new top-level **Macro Transmission Map** above the existing cards.

Do NOT remove the existing cards. Reframe them as evidence below the system map.

The final page hierarchy should be:

```text
1. US Macro Weather
2. Main causal story
3. Macro Transmission Map
4. Key bottleneck / watch next
5. Existing indicator cards as evidence
```

## Required product behavior
At the top of the dashboard, show a clear one-sentence causal story, for example:

```text
The US economy is in Slowdown mode because policy remains restrictive, housing is rate-sensitive, labor is cooling, but credit stress has not yet broken.
```

Then show a system flow like:

```text
Fed Policy
  ↓
Financial Conditions
  ↓
Credit / Liquidity
  ↓
Rate-sensitive Economy
  ↓
Real Economy
  ↓
Labor Market
  ↓
Inflation Feedback
  ↓
Fed Reaction
```

Each node must show:

1. Node name
2. Current status label
3. One short explanation
4. Key indicators under that node
5. Whether this node is leading / confirming / lagging / feedback

## Transmission nodes and indicator mapping
Use this exact structure unless there is a strong code reason not to:

### 1. Fed Policy
Role: cause / policy impulse
Indicators:
- FEDFUNDS
- DGS2
- DGS10
- T10Y2Y

### 2. Financial Conditions
Role: leading transmission channel
Indicators:
- DGS2
- DGS10
- T10Y2Y
- BAMLH0A0HYM2
- BAMLC0A0CM
- STLFSI4

### 3. Credit / Liquidity
Role: system fuel / stress channel
Indicators:
- WALCL
- RESBALNS
- RRPONTSYD
- WDTGAL
- M2SL
- TOTBKCR
- BAMLH0A0HYM2

### 4. Rate-sensitive Economy
Role: early real-economy damage channel
Indicators:
- MORTGAGE30US
- HOUST
- PERMIT
- CSUSHPINSA

### 5. Real Economy
Role: broad demand / output confirmation
Indicators:
- GDPC1
- INDPRO
- RSXFS
- PCECC96

### 6. Labor Market
Role: lagging but decisive recession confirmation
Indicators:
- UNRATE
- PAYEMS
- ICSA
- JTSJOL

### 7. Inflation Feedback
Role: feedback loop into Fed behavior
Indicators:
- CPIAUCSL
- CPILFESL
- PCEPI
- PCEPILFE

### 8. Fed Reaction
Role: policy response / cycle reset
Indicators:
- FEDFUNDS
- DGS2
- T10Y2Y
- CPIAUCSL
- UNRATE

## Required dashboard text blocks
Add these sections near the top:

### Main Causal Story
One sentence, generated from current analysis.

Examples:

```text
High rates are still restrictive, housing is weak, labor is cooling, but credit spreads remain calm; this points to slowdown rather than credit crisis.
```

### Current Bottleneck
Show the 1-2 weakest transmission nodes.

Example:

```text
Current bottleneck: Fed Policy → Housing → Labor
```

### Watch Next
Show 3-5 indicators that would change the regime.

Example:

```text
Watch next: HY Spread, Initial Claims, Unemployment Rate, Core PCE, Bank Reserves
```

## Required logic
Create a new function, or equivalent clean structure:

```js
calculateTransmissionMap(series, analysis)
```

It should return something like:

```js
{
  story: "...",
  bottleneck: ["Fed Policy", "Rate-sensitive Economy", "Labor Market"],
  watchNext: ["BAMLH0A0HYM2", "ICSA", "UNRATE", "PCEPILFE", "RESBALNS"],
  nodes: [
    {
      id: "fed-policy",
      label: "Fed Policy",
      role: "cause / policy impulse",
      status: "restrictive",
      level: "danger | worsening | neutral | improving",
      explanation: "...",
      indicators: ["FEDFUNDS", "DGS2", "DGS10", "T10Y2Y"]
    }
  ]
}
```

Reuse existing `performMacroAnalysis()` where possible, but do not leave the map as a static hardcoded diagram. The map should react to the current indicator states.

## Visual requirements
The map must be mobile-first.

Desktop:
- horizontal or gently wrapped flow is fine
- visible arrows between nodes
- status colors match existing dashboard logic
- each node is compact but meaningful

Mobile:
- vertical flow
- no horizontal scrolling
- arrows should become downward arrows
- cards remain readable on iPhone width

## Files likely to modify
Work only in `nickchen494949/us-macro-dashboard`.

Likely files:

```text
index.html
src/main.js
src/style.css
README.md
```

Only add new files if truly necessary.

## Do not touch
Do NOT modify:

```text
nickchen494949/qqq-dashboard
```

Do NOT rebuild from scratch.
Do NOT delete existing macro cards.
Do NOT convert this into a trading strategy dashboard.

## Acceptance checks
Before final commit/report, verify:

1. Existing dashboard still loads.
2. Existing card sections still render.
3. New top system map renders above the cards.
4. The page now answers: “where is the US economy stuck in the transmission chain?”
5. Mobile layout has no horizontal scrolling.
6. README explains the difference between:
   - Macro Transmission Map = system view
   - Indicator Cards = evidence view
7. Commit and push changes.
8. Report final URL and commit SHA.

## Final report format
Return:

```text
Updated repo:
Files changed:
Live URL:
Commit SHA:
What changed:
Acceptance check result:
```

If no successful commit exists, say clearly:

```text
No successful commit. Do not check watcher/deploy yet.
```
