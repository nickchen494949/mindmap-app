target: mindmap-app

# Task
Create a clean causal mindmap JSON for the user's macro economy system diagram.

## Output files
Write the same app-compatible JSON to BOTH:
- `.ai/outbox/macro-economy-system-v1.json`
- `generated/macro-economy-system-v1.json`

Do NOT modify `app.js`, `index.html`, `style.css`, or watcher scripts.
Do NOT install packages.

## App JSON format
Use the mindmap app JSON format:

```json
{
  "nodes": [
    { "id": 1, "x": 700, "y": 80, "label": "节点名", "desc": "说明", "bg": "#ffffff", "border": "#6366f1", "nw": 220, "showDesc": true }
  ],
  "arrows": [
    { "from": 1, "fromPort": "bottom", "to": 2, "toPort": "top", "label": "关系", "color": "#6366f1" }
  ]
}
```

## Main question
一个国家为什么变强/变弱？风险最早从哪个主体、哪条链条露出来？

## One-sentence answer
宏观经济不是一堆指标，而是央行、政府、银行、企业、居民五类主体，通过利率链、资金链、实体收入链和风险链互相传导，最后表现为增长、通胀、就业、汇率、资产价格和债务风险。

## Biggest conflict
央行想控制通胀和金融风险，政府想稳增长和就业，银行想控制坏账，企业想保利润，居民想保收入；这些目标在高利率、信用收缩或财政压力下会互相冲突。

## Hard anti-directory rule
Do NOT make a category directory such as “宏观经济 → 货币/财政/就业/通胀/贸易”.
The map must show causal transmission and feedback loops.
Every arrow must explain how one thing affects another.

## Required structure
Keep under 30 nodes. Chinese labels only. Use short, readable labels.

### Top / center
1. Center node: `国家经济系统`
   - desc: `看一个国家不是看单个数据，而是看五类主体、四条链条和最后状态。`

### Left side: comparison filter
This is only a filter, not the main causal system.
- `国家分类法`
- `地区可比`
- `发展阶段可比`
- `产业角色可比`
Arrows: 国家分类法 → three filters, labels `先筛选`.

### Main actors
Create five major actor nodes in the center area:
- `央行`
- `政府`
- `银行`
- `企业`
- `居民`

### Internal split nodes
Add only the splits that change the causal conclusion:
- under `企业`: `强企业`, `弱企业/僵尸企业`
- under `居民`: `高级员工`, `普通员工`, `零工/失业边缘`

### Four transmission chains
Use arrow colors consistently:
- Blue `#2563eb` = 利率链 / price of money
- Green `#16a34a` = 资金链 / cash & credit flow
- Orange `#f59e0b` = 实体收入链 / jobs-income-spending-profit loop
- Red `#dc2626` = 风险链 / defaults, NPL, stress

#### Interest-rate chain: blue
Required arrows:
- 央行 → 银行, label `提高/降低资金成本`
- 银行 → 企业, label `改变贷款利率`
- 银行 → 居民, label `改变房贷/消费贷`
- 央行 → 资产价格/汇率, label `改变折现率/利差`

#### Money/credit chain: green
Required arrows:
- 银行 → 企业, label `放贷`
- 银行 → 居民, label `按揭/消费贷`
- 政府 → 企业, label `订单/补贴`
- 政府 → 居民, label `转移支付/税`
- 企业 → 银行, label `还本付息`
- 居民 → 银行, label `还贷/存款`

#### Real economy loop: orange
Required arrows:
- 企业 → 居民, label `工资/就业`
- 居民 → 企业, label `消费需求`
- 企业 → 企业, label `利润→投资/裁员`
- 强企业 → 高级员工, label `高薪岗位`
- 弱企业/僵尸企业 → 零工/失业边缘, label `裁员/低薪`

#### Risk chain: red
Required arrows:
- 弱企业/僵尸企业 → 银行, label `坏账/NPL`
- 零工/失业边缘 → 银行, label `还款压力`
- 银行 → 企业, label `收紧信用`
- 银行 → 居民, label `收紧贷款`

### Status output
Add bottom node `宏观状态输出` with desc:
`最后判断不是单个指标，而是增长、通胀、就业、信用、汇率、资产价格和坏账是否同向恶化。`
Connect:
- 企业 → 宏观状态输出, label `利润/投资`
- 居民 → 宏观状态输出, label `收入/消费`
- 银行 → 宏观状态输出, label `信用/NPL`
- 资产价格/汇率 → 宏观状态输出, label `市场预期`

### Legend node
Add a small node `箭头图例` with desc:
`蓝=利率链；绿=资金链；橙=实体收入链；红=风险链。`

## Layout requirements
Use a clean system layout, not a long list.
Suggested positions:
- Center title at top center.
- `国家分类法` and its three filters on the left.
- Main five actors in the center: 央行 and 政府 top, 银行 middle, 企业 and 居民 lower left/right.
- Enterprise splits below 企业; resident splits below 居民.
- `资产价格/汇率` on the right.
- `宏观状态输出` at bottom center.
- Avoid crossing arrows as much as possible.
- Use `nw` 180-240 and `showDesc: true` for important nodes.

## Failure checks
Before finishing, verify:
1. The map answers the main question.
2. It is not a directory-style map.
3. It clearly separates actor nodes from transmission-chain arrows.
4. It includes enterprise and resident internal splits.
5. It separates利率链, 资金链, 实体收入链, 风险链 by arrow color.
6. JSON loads in the app without syntax errors.
