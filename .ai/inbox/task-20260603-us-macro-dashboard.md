# Task: Create new US Macro Dashboard

## User command
Create a new dashboard to monitor the US macro economy.

Hard user constraint:
- DO NOT modify `nickchen494949/qqq-dashboard`.
- Create a NEW project/repo named `us-macro-dashboard`.
- Every macro card MUST include historical data, not just latest value.

## Goal
Build a simple, mobile-friendly US macro monitoring dashboard that answers:

> Is the US macro economy improving, slowing, overheating, tightening, or breaking?

This is NOT a trading strategy dashboard. It is a macro weather dashboard.

## Required output
Create a new project/repo:

```text
nickchen494949/us-macro-dashboard
```

If automatic remote repo creation is not available, create a local project named `us-macro-dashboard`, commit all files, and report clearly what was created.

## Do not touch
Do not edit, rename, delete, or commit anything inside:

```text
nickchen494949/qqq-dashboard
```

## Product structure
Build one static dashboard first. Prefer simple stack:

```text
index.html
src/main.js
src/data.js
src/charts.js
src/style.css
README.md
```

No backend required for v1 unless needed.

## Data source principle
Use free public historical data first.

Preferred v1 sources:
- FRED CSV endpoint for macro time series
- Yahoo/Stooq only if needed for market ETFs
- Avoid paid API keys
- Cache/fallback gracefully when a source fails

## Card rule: every card must have history
Every card must show:

1. Latest value
2. Date of latest observation
3. Historical line chart / sparkline
4. 1M / 3M / 12M change where meaningful
5. Status label: improving / worsening / neutral / danger
6. Short plain-English explanation

No card is allowed to show only a number.

## Dashboard sections and required cards

### 1. Growth / real economy
Cards:
- Real GDP YoY — FRED `GDPC1`
- Industrial Production YoY — FRED `INDPRO`
- Retail Sales YoY or 3M momentum — FRED `RSXFS`
- Real Personal Consumption YoY — FRED `PCECC96`

Purpose:
Show whether the real economy is expanding or slowing.

### 2. Labor market
Cards:
- Unemployment Rate — FRED `UNRATE`
- Nonfarm Payrolls momentum — FRED `PAYEMS`
- Initial Jobless Claims — FRED `ICSA`
- Job Openings — FRED `JTSJOL`

Purpose:
Show whether employment is still strong or cracking.

### 3. Inflation pressure
Cards:
- CPI YoY — FRED `CPIAUCSL`
- Core CPI YoY — FRED `CPILFESL`
- PCE Inflation YoY — FRED `PCEPI`
- Core PCE Inflation YoY — FRED `PCEPILFE`

Purpose:
Show whether inflation is cooling, sticky, or reaccelerating.

### 4. Fed / rates / curve
Cards:
- Effective Fed Funds Rate — FRED `EFFR` or `FEDFUNDS`
- 2Y Treasury Yield — FRED `DGS2`
- 10Y Treasury Yield — FRED `DGS10`
- 10Y minus 2Y curve — FRED `T10Y2Y`

Purpose:
Show policy stance and recession pressure.

### 5. Liquidity / money / banking
Cards:
- Fed Balance Sheet — FRED `WALCL`
- Bank Reserves — FRED `RESBALNS`
- Reverse Repo — FRED `RRPONTSYD`
- Treasury General Account — FRED `WDTGAL`
- M2 Money Supply — FRED `M2SL`
- Commercial Bank Credit — FRED `TOTBKCR`

Purpose:
Show whether liquidity is being added or drained.

### 6. Credit stress
Cards:
- High Yield Option-Adjusted Spread — FRED `BAMLH0A0HYM2`
- Investment Grade OAS — FRED `BAMLC0A0CM`
- Financial Stress Index — FRED `STLFSI4`

Purpose:
Show whether the credit system is calm or breaking.

### 7. Housing / rate-sensitive economy
Cards:
- Housing Starts — FRED `HOUST`
- Building Permits — FRED `PERMIT`
- Mortgage Rate 30Y — FRED `MORTGAGE30US`
- Case-Shiller Home Price Index — FRED `CSUSHPINSA`

Purpose:
Show whether high rates are damaging the housing channel.

## Top summary panel
At the top of the page, show 5 big macro weather states:

```text
Growth: expanding / slowing / contracting
Labor: strong / cooling / cracking
Inflation: cooling / sticky / reaccelerating
Fed/Rates: easing / restrictive / tightening
Credit/Liquidity: calm / tightening / stress
```

Also show one final combined label:

```text
US Macro Weather: Goldilocks / Slowdown / Inflation Problem / Credit Stress / Recession Risk
```

Keep this rule simple and transparent. Do not overfit.

## Status logic v1
Use simple readable rules, not black-box ML.

Examples:
- Inflation cooling if latest YoY < 6M ago YoY
- Labor cracking if unemployment rate rises > 0.5pp from 12M low
- Credit stress if HY OAS > 5 or rising fast
- Yield curve recession pressure if T10Y2Y < 0 for prolonged period
- Liquidity tightening if WALCL + RESBALNS falling while RRP/TGA dynamics drain reserves

Put rule explanations in comments and README.

## UI requirements
- Mobile-friendly first
- No wide tables that require horizontal scrolling
- Cards in responsive grid
- Each card: title, latest value, date, chart, change badges, plain-English status
- Dark/light mode optional but nice
- Loading and error states per card
- User should instantly understand what changed

## Chart requirements
- Use one chart per card
- At least 5 years of history by default
- Allow changing range: 1Y / 5Y / Max if easy
- Missing data must not crash the dashboard

## README requirements
README must explain:
- What this dashboard is for
- Why each section exists
- What each card means in plain English
- Data sources and FRED series IDs
- How to run locally
- How to deploy to GitHub Pages

## Acceptance checks
Before final commit/report:

1. Confirm `qqq-dashboard` was not modified.
2. Confirm every card has a historical chart/sparkline.
3. Confirm dashboard loads even if one data source fails.
4. Confirm mobile layout has no horizontal scrolling.
5. Confirm README lists all FRED series IDs.
6. Commit and push the new project/repo if possible.

## Final report format
After execution, report:

```text
Created project/repo:
Files changed:
URL/local path:
Commit SHA:
Notes:
```

If no commit SHA exists, say clearly:

```text
No successful commit. Do not check watcher/deploy yet.
```
