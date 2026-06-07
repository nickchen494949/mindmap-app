target: mindmap-app

# Task
Run a standalone research/backtest on whether China-listed Nasdaq/QDII ETF premium is a useful predictor for QQQ/TQQQ risk or return.

## Execution Mode
Execute entirely inside the system repo `nickchen494949/mindmap-app` because this target is already allowed by the watcher.

Do NOT modify `qqq-dashboard` in this task.
Do NOT modify any sealed TQQQ production strategy.
This task is only to produce research evidence.

## Background
User asked whether China Nasdaq ETF premium is a good predictor, then asked to backtest it.

## Main Question
Does China-listed Nasdaq/QDII ETF premium predict future QQQ/TQQQ returns, drawdowns, or overheat risk?

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

Preferred Python data sources:
1. akshare if available
2. yfinance for QQQ/TQQQ/USD proxies
3. Eastmoney/Sina/Netease endpoints only if stable and documented in code comments
4. If clean NAV data cannot be fetched automatically, produce a clear failure report explaining the exact missing data and a fallback plan.

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

## Backtest Rules
Avoid look-ahead bias:
- Signal available after China market close
- US execution must be next tradable US session open or next close, clearly specified
- No same-day US close execution unless timestamp availability justifies it

## Required Outputs
Create outputs inside `mindmap-app`:

1. Python script:
- `.ai/research/research_china_nasdaq_premium.py`

2. Markdown report:
- `.ai/reports/task-20260607-china-nasdaq-etf-premium-backtest/final-report.md`

Report must include:
- data coverage by ETF
- missing data summary
- premium distribution summary
- event count by threshold
- mean/median forward return by window
- win rate by window
- forward max drawdown stats
- baseline comparison vs unconditional QQQ/TQQQ returns
- conclusion: useful predictor yes/no, useful overheat warning yes/no, useful dashboard sentiment indicator yes/no

## Decision Rule
If data is clean and results are statistically useful, recommend a second task to integrate into `qqq-dashboard`.

If data is not clean or results are weak, clearly say:
- not production-ready
- maybe only useful as China QDII sentiment/quota-stress indicator

## Do Not Do
- Do not touch `qqq-dashboard`.
- Do not change dashboard production UI.
- Do not claim predictive power without evidence.
- Do not use same-day US close if timestamp would create look-ahead bias.
