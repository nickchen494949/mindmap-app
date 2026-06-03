# Task 004: Regenerate World Economic History Mindmap (v3)

## Goal

Regenerate the world economic history mindmap with STRICT layout rules to avoid arrow crossing and node overlap.

## Read first

- `PROJECT_CONTEXT.md`
- `.ai/RULES.md` (especially the NEW Layout Rules section)
- `.ai/ROLES.md`

## Output files

Overwrite BOTH files:

1. `.ai/outbox/world-economic-history-v3.json`
2. `generated/world-economic-history-v3.json`

## CRITICAL Layout Requirements

- **MAX 5 main branches** (merge related topics if needed)
- Center node "世界经济史" at top center: x=750, y=80
- 5 branch headers at y=280, evenly spaced: x=150, x=450, x=750, x=1050, x=1350
- Children DIRECTLY below their parent (SAME x coordinate), y increments of 160px
- All parent→child arrows: fromPort="bottom", toPort="top"
- NO arrows crossing between branches
- Column width: 250px gap between branches
- Node width nw: 200px minimum
- Max 25 nodes total
- Every arrow has a Chinese verb label

## Content (5 branches)

1. **底层驱动力** (x=150)
   - 生产力
   - 制度与产权
   - 能源革命
   - 金融体系

2. **关键转折点** (x=450)
   - 工业革命
   - 大航海时代
   - 布雷顿森林
   - 全球化浪潮

3. **经济体系演变** (x=750)
   - 农业经济
   - 工业经济
   - 金融资本主义
   - 数字经济

4. **危机与教训** (x=1050)
   - 大萧条
   - 石油危机
   - 2008金融海啸
   - 疫情冲击

5. **对你的启示** (x=1350)
   - 周期必然存在
   - 杠杆是双刃剑
   - 制度决定繁荣
   - 技术改变规则

## Style
- Chinese labels
- Each branch a different color family
- Descriptions in desc field, keep labels short (max 6 chars)
- Do NOT modify app code
