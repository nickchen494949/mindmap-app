target: qqq-dashboard

# Task
Backtest whether China-listed Nasdaq/QDII ETF premium is a useful predictor for QQQ/TQQQ risk or return.

## Routing
This task is placed in the AI queue/system repo because watcher reads `.ai/inbox/` here. The actual project to modify/test is `nickchen494949/qqq-dashboard`.

## Background
User asked whether China Nasdaq ETF premium is a good predictor, then asked to backtest it.

This is a research task only. Do not change the sealed production strategy unless the signal passes the full testing protocol.

Current sealed production strategy must remain unchanged:
- Fed SEP > Credit Z > Vol Z > Normal priority
- NSL must remain on
- T+1 next-open execution
- Transaction cost protocol must remain intact

## Main Question
Does China-listed Nasdaq/QDII ETF premium predict future QQQ/TQQQ returns, drawdowns, or overheat risk better than existing signals?

## One-Sentence Hypothesis
China Nasdaq ETF premium is more likely a China retail/QDII quota stress indicator than a direct Nasdaq return predictor; it may only be useful as an extreme-overheat warning or dashboard sentiment thermometer.

## Instruments to Test
Use at least these China-listed Nasdaq/QDII ETFs if data is available:
- 513100.SH / 513100: Guotai Nasdaq-100 ETF
- 159941.SZ / 159941: GF Nasdaq-100 ETF
- Add other liquid China Nasdaq/QDII ETFs only if historical price + NAV are available and clean.

## Required Data
For each ETF, collect daily history:
- China ETF close price
- official daily NAV / unit NAV / IOPV if available
- premium = close / NAV - 1
- trading status / suspended subscription flags if available
- QQQ daily OHLC
- TQQQ daily OHLC
- USD/CNY or USD/CNH if available
- existing dashboard risk signals: SEP, Credit Z, Vol Z

Preferred Python data sources:
1. Existing repo cache if already present
2. akshare if available
3. yfinance for QQQ/TQQQ/USD proxies
4. Eastmoney/Sina/Netease endpoints only if stable and documented in code comments

## Core Test Design
Do not test only same-day correlation.

For each premium series, test forward windows:
- 1 trading day
- 5 trading days
- 20 trading days
- 60 trading days

Target outcomes:
- forward QQQ return
- forward TQQQ return
- forward max drawdown over the window
- probability of negative return
- probability of material drawdown

Premium regimes:
- premium percentile >= 90th percentile
- premium percentile >= 95th percentile
- premium percentile >= 99th percentile
- premium z-score >= 1.5
- premium z-score >= 2.0
- absolute premium > 2%, >5%, >10% if enough samples

## Conditional Tests
Separate results into:

A. Nasdaq/QQQ already in uptrend
- QQQ above 200DMA
- QQQ 20D return positive

B. Nasdaq/QQQ after selloff
- QQQ below 50DMA or 20D return negative

C. RMB pressure regime
- USD/CNY or USD/CNH 20D return positive / RMB weakening
- Test whether premium predicts China capital pressure more than Nasdaq return

D. Existing dashboard states
- Normal
- Vol danger
- Credit danger
- Fed out if SEP history overlaps

## Backtest Rules
Avoid look-ahead bias:
- Signal available after China market close
- US execution must be next tradable US session open or next close, clearly specified
- No same-day US close execution unless timestamp availability justifies it

Transaction cost assumptions:
- Use existing repo cost protocol where applicable
- If testing as overlay, include 25 bps per switch baseline and 200 bps stress

## Strategy Variants to Test
Do not directly add to production. Test as separate research variants:

1. Dashboard-only predictive study
- No trading, just event study after high premium events.

2. Overheat de-risk overlay
- If premium extreme and existing state is Normal, reduce TQQQ exposure from 100% to 66%.
- Must obey NSL unless explicitly testing diagnostic-only scenario.

3. No-buy filter
- If premium extreme, block adding/re-risking for N days.
- This may be more realistic than forced sell.

4. China-capital-pressure indicator
- Test against CNH/CNY depreciation, China equity underperformance, and QDII premium persistence if data exists.

## Required Outputs
Create outputs in `nickchen494949/qqq-dashboard`:

1. Python script:
- `tools/research_china_nasdaq_premium.py`

2. Markdown report:
- `docs/research/china_nasdaq_etf_premium_backtest.md`

Report must include:
- data coverage by ETF
- missing data summary
- premium distribution summary
- event count by threshold
- mean/median forward return by window
- win rate by window
- forward max drawdown stats
- t-stat or bootstrap confidence where sample size allows
- baseline comparison vs unconditional QQQ/TQQQ returns
- IS / holdout / forward split if enough data exists

## Production Acceptance Rules
The signal can only be considered for production if all are true:
- improves holdout and forward results, not just full-sample
- survives threshold variants / parameter plateau
- does not increase trades beyond acceptable limits
- works under T+1 execution
- survives 200 bps cost stress if used as trading overlay
- adds value beyond existing Credit Z and Vol Z states

If it fails, recommend dashboard-only display:
- China QDII Premium: normal / hot / extreme
- Label explicitly: sentiment/quota-stress indicator, not Nasdaq predictor

## Failure Checks
Reject the signal if:
- effect only appears with same-day execution
- sample size is tiny at high premium thresholds
- premium is driven by subscription suspension only and not market timing
- results disappear in 2023-present forward period
- it mostly duplicates Vol Z or QQQ momentum
- forced selling underperforms while no-buy filter works better

## Do Not Do
- Do not modify sealed production parameters.
- Do not update dashboard production UI unless the research report is generated first.
- Do not claim predictive power without holdout/forward evidence.
- Do not use same-day US close if timestamp would create look-ahead bias.
