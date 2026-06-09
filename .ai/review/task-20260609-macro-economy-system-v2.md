target: mindmap-app

# Task
Improve the existing macro economy system mindmap into v2.

## Source to read first
Read the existing v1 output:
- `generated/macro-economy-system-v1.json`
- `.ai/outbox/macro-economy-system-v1.json`

## Output files
Write the improved JSON to BOTH:
- `.ai/outbox/macro-economy-system-v2.json`
- `generated/macro-economy-system-v2.json`

Do NOT modify `app.js`, `index.html`, `style.css`, watcher scripts, or any existing v1 files.
Do NOT install packages.

## Goal
Turn v1 from a usable causal map into a cleaner, one-glance macro transmission map.

## Main question
一个国家为什么变强/变弱？风险最早从哪个主体、哪条链条露出来？

## One-sentence answer
宏观经济不是指标目录，而是五类主体通过四条链条互相传导：利率链决定资金价格，资金链决定谁拿到钱，实体收入链决定就业-收入-消费-利润循环，风险链决定坏账和信用收缩。

## Review of v1
v1 is directionally correct, but has 3 problems:
1. `国家经济系统` is only a title, not a real entry point.
2. `普通员工` exists but has weak causal role.
3. Too many overlapping arrows between 银行/企业/居民, making the visual look busy.

## Required v2 changes

### 1. Add clearer top-level entry structure
Add these four hub nodes under `国家经济系统`:
- `比较筛选`
- `国内五主体`
- `四条传导链`
- `宏观状态输出`

Connect:
- 国家经济系统 → 比较筛选, label `先确定可比对象`
- 国家经济系统 → 国内五主体, label `再看谁在行动`
- 国家经济系统 → 四条传导链, label `然后看如何传导`
- 国家经济系统 → 宏观状态输出, label `最后判断状态`

### 2. Keep country filter, but make it visually side module
Under `比较筛选` place:
- `地区可比`
- `发展阶段可比`
- `产业角色可比`

Do not let this side module dominate the chart.

### 3. Keep five actors under `国内五主体`
Five actors:
- `央行`
- `政府`
- `银行`
- `企业`
- `居民`

Suggested causal arrangement:
- 央行 and 政府 on top row
- 银行 in middle
- 企业 and 居民 below

### 4. Make chain nodes explicit to reduce arrow confusion
Under `四条传导链`, create four small chain nodes:
- `利率链`
- `资金链`
- `实体收入链`
- `风险链`

Each chain node should have desc:
- 利率链: `钱的价格怎么变：央行→银行→企业/居民→资产价格。`
- 资金链: `钱实际怎么流：贷款、财政支出、还本付息、存款。`
- 实体收入链: `真实经济怎么循环：企业利润→就业工资→居民消费→企业营收。`
- 风险链: `压力怎么扩散：弱企业/脆弱居民→坏账→银行收紧信用。`

### 5. Keep internal splits, but add causal usefulness
Enterprise split:
- `强企业`
- `弱企业/僵尸企业`

Resident split:
- `高级员工`
- `普通员工`
- `零工/失业边缘`

Required new arrows:
- 普通员工 → 居民, label `决定主流消费能力`, color orange `#f59e0b`
- 普通员工 → 银行, label `房贷/消费贷压力`, color red `#dc2626`

### 6. Reduce visual clutter by routing arrows through chain nodes
Instead of many parallel arrows directly between 银行/企业/居民, use chain nodes as routers where possible.

Examples:
- 利率链 → 央行, label `起点`
- 央行 → 银行, label `改变资金成本`, blue
- 银行 → 企业, label `贷款利率`, blue
- 银行 → 居民, label `房贷/消费贷利率`, blue
- 央行 → 资产价格/汇率, label `折现率/利差`, blue

- 资金链 → 政府, label `财政通道`
- 政府 → 企业, label `订单/补贴`, green
- 政府 → 居民, label `转移支付/税`, green
- 银行 → 企业, label `贷款额度`, green
- 企业 → 银行, label `还本付息`, green

- 实体收入链 → 企业, label `生产起点`
- 企业 → 居民, label `工资/就业`, orange
- 居民 → 企业, label `消费需求`, orange
- 企业 → 宏观状态输出, label `利润/投资`, orange

- 风险链 → 弱企业/僵尸企业, label `先看脆弱点`
- 弱企业/僵尸企业 → 银行, label `坏账/NPL`, red
- 零工/失业边缘 → 银行, label `还款压力`, red
- 普通员工 → 银行, label `房贷/消费贷压力`, red
- 银行 → 企业, label `收紧信用`, red
- 银行 → 居民, label `收紧贷款`, red

### 7. Add “how to read this map” node
Add a node:
- `读图方法`
- desc: `先看利率有没有变，再看钱有没有断，再看就业消费是否变弱，最后看坏账和汇率/资产价格是否恶化。`
Connect `读图方法` to `宏观状态输出`, label `使用顺序`.

## Colors
Use these colors consistently:
- blue `#2563eb` = 利率链
- green `#16a34a` = 资金链
- orange `#f59e0b` = 实体收入链
- red `#dc2626` = 风险链
- purple `#7c3aed` = 比较筛选
- gray `#475569` = system/navigation nodes

## Layout
Keep under 30 nodes.
Suggested layout:
- top: 国家经济系统
- row 2: 比较筛选 / 国内五主体 / 四条传导链 / 读图方法
- left module: comparison filters
- center module: five actors and splits
- right module: four chain nodes and asset-price/exchange-rate node
- bottom: 宏观状态输出
Avoid crossing arrows. Avoid stacking multiple arrows on exactly the same ports.

## Failure checks
Before finishing, verify:
1. JSON parses successfully.
2. It loads in the app format `{nodes, arrows}`.
3. It is less cluttered than v1.
4. It answers the main question.
5. `普通员工` has real causal links.
6. `国家经济系统` is a real entry point, not only a title.
7. It is not a directory-style map.
