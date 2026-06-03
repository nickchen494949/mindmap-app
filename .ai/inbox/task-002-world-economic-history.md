# Task 002: Generate World Economic History Mindmap

## Goal

Generate a human-friendly Chinese mindmap about **世界经济史**.

This is not a textbook timeline dump. The goal is to help a normal person understand the big mechanism of world economic history:

> 人类经济如何从“土地和人力”驱动，变成“能源、机器、金融、全球贸易、科技和制度”驱动。

The map should help the user see:

1. the major stages of world economic development
2. what changed in each stage
3. which mechanisms drove the change
4. why some regions became rich first
5. why globalization expands, collapses, and rebuilds
6. how this history helps understand today's economy

## Read first

- `PROJECT_CONTEXT.md`
- `.ai/RULES.md`

## Research basis to use

Use these research anchors when designing the structure:

1. Our World in Data - Economic Growth
   - Economic growth means the increase in the quantity or quality of goods and services people produce.
   - Long-run growth is central to how societies left widespread poverty behind and how global inequality emerged.
   - Source: https://ourworldindata.org/economic-growth

2. Maddison Project Database via Our World in Data
   - Long-run GDP per capita data estimates show the broad transition from very low premodern income levels to much higher modern incomes.
   - GDP per capita is useful for tracking living standards over long periods.
   - The data becomes less certain the further back in time we go, especially before 1900 and for some regions before 1950.
   - Source: https://ourworldindata.org/grapher/gdp-per-capita-maddison-project-database

3. Industrial Revolution / Great Divergence framing
   - The big break in world economic history is not just “trade”; it is productivity growth from energy, machines, institutions, science, and global resources.
   - Europe/US pulled ahead in the 18th-19th centuries, while Asia and other regions were integrated into an unequal world economy.

4. Globalization waves
   - First major modern globalization: roughly 1870-1914, driven by steamships, railways, telegraph, gold standard, empire, migration, capital flows, and trade.
   - Deglobalization: 1914-1945, driven by war, protectionism, depression, financial breakdown.
   - Bretton Woods / postwar reconstruction: 1944 onward, IMF, World Bank, GATT, dollar order, regulated trade and finance.
   - Late globalization: 1980s-2008/2010s, neoliberal reform, container shipping, China opening, global value chains, information technology.
   - Current era: after 2008 and especially after COVID/US-China tensions, more focus on supply-chain security, geopolitics, industrial policy, energy transition, AI.

## Output files

Create BOTH files:

1. `.ai/outbox/world-economic-history.json`
2. `generated/world-economic-history.json`

## Required output format

Use the app's native format:

```json
{
  "nodes": [
    {
      "id": 1,
      "x": 600,
      "y": 80,
      "label": "世界经济史",
      "desc": "解释人类经济如何从土地和人力驱动，变成能源、机器、金融、全球贸易、科技和制度驱动。",
      "bg": "#ffffff",
      "border": "#6366f1",
      "nw": 260,
      "showDesc": true
    }
  ],
  "arrows": [
    {
      "id": "a1",
      "from": 1,
      "fromPort": "bottom",
      "to": 2,
      "toPort": "top",
      "label": "分成",
      "color": "#6366f1",
      "isStraight": false,
      "bidir": false,
      "mark": null
    }
  ]
}
```

## Must-have structure

Create a map with around 28-35 nodes. If too many, prioritize clarity over completeness.

### Center node

- 世界经济史

### Main branch 1: 长期底层逻辑

Explain the recurring engine of economic history:

- 生产力：人均能生产多少东西
- 能源：木柴/人力/畜力 → 煤炭 → 石油电力 → 数据与AI
- 制度：产权、国家能力、金融、法律、教育
- 贸易网络：谁和谁交换、谁控制通道
- 分配冲突：谁拿走增长果实

### Main branch 2: 前工业时代

Core idea: most societies were trapped near subsistence.

Nodes:

- 农业文明
- 马尔萨斯陷阱
- 城市与贸易
- 帝国与税收
- 技术进步慢

Human explanation: growth mainly became more population, not much higher per-person living standard.

### Main branch 3: 工业革命与大分流

Core idea: productivity and energy broke the old ceiling.

Nodes:

- 工业革命
- 煤炭与蒸汽机
- 工厂制度
- 金融与产权
- 殖民地与资源
- 大分流

Human explanation: some regions first escaped the old poverty ceiling; others were pulled into an unequal world system.

### Main branch 4: 第一轮全球化 1870-1914

Core idea: transport, finance, empire, and gold standard connected the world.

Nodes:

- 蒸汽船与铁路
- 电报与信息速度
- 金本位与资本流动
- 商品贸易
- 劳工迁移
- 帝国秩序

Human explanation: the world became connected, but not equal.

### Main branch 5: 崩塌与重建 1914-1945/1970s

Core idea: globalization can collapse when war, debt, depression, and politics break trust.

Nodes:

- 一战
- 大萧条
- 保护主义
- 二战
- 布雷顿森林体系
- IMF/World Bank/GATT
- 美元秩序

### Main branch 6: 新自由化全球化 1980s-2008

Core idea: capital, containers, China opening, and IT created global supply chains.

Nodes:

- 金融自由化
- 集装箱运输
- 中国改革开放
- 全球供应链
- 信息技术
- 低通胀与资产价格

### Main branch 7: 当代新阶段 2008-present

Core idea: efficiency-only globalization is being challenged by security, debt, technology, and geopolitics.

Nodes:

- 2008金融危机
- 量化宽松与债务
- 中国崛起
- 供应链安全
- 能源转型
- AI与自动化
- 地缘政治回归

### Main branch 8: 今天怎么用

This branch should connect history to the user's macro/investing worldview.

Nodes:

- 看能源成本
- 看金融条件
- 看贸易秩序
- 看技术扩散
- 看国家能力
- 看分配冲突

Human explanation: world economic history is not memory work; it is a checklist for understanding today's macro regime.

## Layout rules

- Use a readable wide layout.
- Center node at top/middle.
- Each main branch should be a vertical column.
- Avoid making unrelated concepts look like a causal chain.
- If items are parallel, connect them directly from the branch node instead of chaining them one after another.
- Use colors by branch.
- `desc` should explain in human language.
- Every arrow must have a meaningful label.

## Quality rules

- Do NOT make this a pure chronological timeline.
- Do NOT overload with names/dates.
- Focus on mechanisms: energy, productivity, trade, finance, state power, technology, inequality, crisis.
- Must be understandable by a smart middle-school student.
- Use Chinese labels.
- Do NOT modify `app.js`, `index.html`, or `style.css`.
- Do NOT delete existing files.

## Success check

After completion, these files must exist:

- `.ai/outbox/world-economic-history.json`
- `generated/world-economic-history.json`

Both files must be valid JSON and loadable by the app.