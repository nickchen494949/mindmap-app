target: mindmap-app

# Task
Run a standalone research/backtest on whether China-listed Nasdaq/QDII ETF premium predicts QQQ/TQQQ returns, drawdowns, or overheat risk.

## Execution Mode
Execute entirely inside `nickchen494949/mindmap-app`.

Do NOT modify `qqq-dashboard`.
Do NOT modify any production dashboard code.
Do NOT modify sealed TQQQ strategy rules.
This is a research/report task only.

## Main Question
Does China-listed Nasdaq/QDII ETF premium have real predictive power for future QQQ/TQQQ risk or return?

## One-Sentence Hypothesis
China Nasdaq ETF premium is probably more useful as a China retail/QDII quota-stress thermometer than as a direct Nasdaq return predictor; only extreme premium may act as an overheat warning.

## Instruments
Try to test at least:
- 513100.SH / 513100: Guotai Nasdaq-100 ETF
- 159941.SZ / 159941: GF Nasdaq-100 ETF

Add other liquid China Nasdaq/QDII ETFs only if clean price + NAV history is available.

## Data Requirements
For each China ETF, collect daily:
- ETF close price
- official daily NAV / unit NAV / IOPV if available
- premium = close / NAV - 1
- trading status or subscription suspension if available

Also collect:
- QQQ daily OHLC
- TQQQ daily OHLC
- USD/CNY or USD/CNH if available

Use practical data sources in this order:
1. akshare if installed/available
2. yfinance for QQQ/TQQQ/USD proxies
3. Eastmoney/Sina/Netease endpoints if stable; document URL/source in comments
4. If NAV data cannot be fetched cleanly, still create a failure report explaining what failed and the exact fallback needed.

## Tests
Do not only run same-day correlation.

For each premium series, test future windows:
- 1 trading day
- 5 trading days
- 20 trading days
- 60 trading days

Measure:
- forward QQQ return
- forward TQQQ return
- forward max drawdown over the window
- probability of negative return
- probability of large drawdown

Premium regimes:
- top 10% premium days
- top 5% premium days
- top 1% premium days
- z-score >= 1.5
- z-score >= 2.0
- absolute premium > 2%, >5%, >10% if enough samples

Conditional splits:
A. QQQ uptrend:
- QQQ above 200DMA or QQQ 20D return positive

B. QQQ after selloff:
- QQQ below 50DMA or QQQ 20D return negative

C. RMB pressure:
- USD/CNY or USD/CNH 20D return positive / RMB weakening

## Anti-Lookahead Rule
Assume the signal is only available after China market close.
Use next US tradable session execution / next return window.
Do not use same-day US close unless timestamps justify it clearly.

## Required Files
Create:

1. Research script:
`.ai/research/research_china_nasdaq_premium.py`

2. Final report:
`.ai/reports/task-20260607d-china-nasdaq-premium-backtest/final-report.md`

The report must include:
- data sources used
- data coverage by ETF
- missing data problems
- premium distribution summary
- event count by threshold
- baseline unconditional QQQ/TQQQ forward returns
- conditional forward returns after high premium
- drawdown statistics
- whether the signal survives forward/holdout style sanity checks if sample allows
- final verdict: predictor yes/no, overheat warning yes/no, dashboard sentiment indicator yes/no

## Decision Rule
If results are weak or data is messy, say so directly.
Do not force a signal.

If useful, recommend a separate future integration task for `qqq-dashboard`, but do not create it in this task.

## Final Answer Format Inside Report
End the report with:

```text
Bottom line: <one plain-language sentence>
```
