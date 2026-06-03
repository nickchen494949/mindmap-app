# Task 003: World Economic History Mindmap V2

## Role split

ChatGPT has done the research framing. Antigravity is the executor and JSON generator.

Do not redesign the topic from scratch. Follow this task and generate app-compatible JSON.

## Goal

Create a Chinese mindmap about 世界经济史.

Core idea:

世界经济史不是背年代，而是看人类经济如何从土地、人力、农业，变成能源、机器、金融、全球贸易、科技和国家制度驱动。

The map should help the user understand today: inflation, debt, globalization, US-China conflict, energy transition, AI, industrial policy, and supply-chain security.

## Output files

Create both files:

1. .ai/outbox/world-economic-history-v2.json
2. generated/world-economic-history-v2.json

Use app native format:

{
  "nodes": [],
  "arrows": []
}

Each node should include: id, x, y, label, desc, bg, border, nw, showDesc.
Each arrow should include: id, from, fromPort, to, toPort, label, color, isStraight, bidir, mark.

## Map rule

Make a mechanism map, not a pure timeline.

Main question:

每个时代，真正改变经济上限的东西是什么？

## Required center node

世界经济史

Desc:

解释人类经济如何从土地和人力驱动，变成能源、机器、金融、全球贸易、科技和制度驱动。

## Main branches

Create 8 main branches.

### 1. 长期底层引擎

Children:
- 生产力
- 能源系统
- 制度与产权
- 国家能力
- 金融与信用
- 贸易网络
- 分配冲突

Desc idea:
经济增长不是钱变多，而是人均能生产更多东西；背后靠能源、技术、组织、金融、国家能力和贸易网络。

### 2. 前工业时代

Children:
- 农业文明
- 土地约束
- 马尔萨斯陷阱
- 城市与长途贸易
- 帝国税收
- 技术进步慢

Desc idea:
前工业时代也有城市和贸易，但多数增长最后变成更多人口，不是人均生活长期大幅提高。

### 3. 工业革命与大分流

Children:
- 工业革命
- 煤炭与蒸汽机
- 工厂制度
- 金融与产权
- 科学与工程
- 殖民地与资源
- 大分流

Desc idea:
工业革命不是单纯发明机器，而是高密度能源、机器、工厂、金融、产权、市场和全球资源一起推高生产率。

### 4. 第一轮全球化 1870-1914

Children:
- 蒸汽船与铁路
- 电报
- 金本位
- 国际资本流动
- 商品贸易
- 大规模移民
- 帝国秩序

Desc idea:
世界第一次高速连起来，但这种连接建立在帝国、资本和不平等权力结构上。

### 5. 崩塌与重建 1914-1970s

Children:
- 一战
- 大萧条
- 保护主义
- 二战
- 布雷顿森林体系
- IMF与World Bank
- GATT
- 美元秩序
- 资本管制

Desc idea:
全球化不是自然永远前进；战争、债务、金融危机和政治失控会打碎开放体系。战后重建靠美国主导的制度和美元秩序。

### 6. 新自由化全球化 1980s-2008

Children:
- 金融自由化
- 集装箱运输
- 中国改革开放
- WTO体系
- 全球供应链
- 信息技术
- 低通胀
- 资产价格上升

Desc idea:
1980s 后全球化追求效率：哪里便宜就在哪里生产，供应链拉长，低成本商品压低通胀，也推高金融资产重要性。

### 7. 当代新阶段 2008-present

Children:
- 2008金融危机
- 量化宽松与债务
- 中国崛起
- 供应链安全
- 产业政策回归
- 能源转型
- AI与自动化
- 地缘政治回归

Desc idea:
现在不是简单去全球化，而是从只看效率变成效率加安全加国家战略。

### 8. 今天怎么用

Children:
- 看能源成本
- 看金融条件
- 看贸易秩序
- 看技术扩散
- 看国家能力
- 看分配冲突
- 看安全溢价

Desc idea:
学世界经济史不是背年份，而是训练判断：现在是哪种增长机制在变？能源、金融、贸易、技术、国家能力还是分配冲突？

## Cross-links

Add a few cross-links only if the referenced nodes exist:

- 能源系统 -> 工业革命, label: 突破上限
- 金融与信用 -> 第一轮全球化 1870-1914, label: 放大连接
- 一战 -> 崩塌与重建 1914-1970s, label: 打碎秩序
- 中国改革开放 -> 全球供应链, label: 重塑制造
- 供应链安全 -> 当代新阶段 2008-present, label: 改变目标
- AI与自动化 -> 今天怎么用, label: 提出新问题

## Layout rules

- Wide readable layout.
- Center node near top/middle.
- Each main branch is a vertical column.
- Parallel items must connect directly from the branch node.
- Do not fake causal chains between parallel items.
- Use different colors by branch.
- Keep labels short.
- Put explanation in desc.
- Every arrow must have a meaningful label.
- 55 to 75 nodes is acceptable. Do not exceed 80 nodes.

## Quality rules

- Do not make it a pure chronological timeline.
- Do not overload with names and dates.
- Focus on mechanisms: energy, productivity, trade, finance, state power, technology, inequality, crisis.
- Use Chinese labels.
- Explain like talking to a smart middle-school student.
- Do not modify app.js, index.html, or style.css.
- Do not delete existing files.

## Success check

Both files must exist and be valid JSON:

- .ai/outbox/world-economic-history-v2.json
- generated/world-economic-history-v2.json
