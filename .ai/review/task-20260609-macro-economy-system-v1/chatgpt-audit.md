VERDICT: FAIL

Blocking issues:
- Nodes missing: '国家分类法', '地区可比', '发展阶段可比', '产业角色可比', '强企业', '弱企业/僵尸企业', '高级员工', '普通员工', '零工/失业边缘', '资产价格/汇率', '宏观状态输出', '箭头图例'.
- Arrows missing: multiple required arrows for interest-rate, money/credit, real economy, and risk chains.
- Required structure not followed (e.g., center node missing, filters missing, internal splits missing).
- JSON does not match the specified format requirements.

Notes:
- Output files exist at correct paths.
- No console or network errors found on page load.


# Suggested Fix Task
```markdown
target: mindmap-app

# Fix Task
Recreate the macro-economy-system-v1.json file(s) to fully comply with the task specification. The JSON must include:
- All required nodes with correct IDs, positions, labels, descriptions, colors, and sizes.
- All required arrows with correct from/to, ports, labels, and colors (blue=利率链, green=资金链, orange=实体收入链, red=风险链).
- Center node '国家经济系统' with description.
- Left side filter nodes '国家分类法', '地区可比', '发展阶段可比', '产业角色可比' with arrows labeled '先筛选'.
- Five main actor nodes: '央行', '政府', '银行', '企业', '居民'.
- Internal splits: under '企业' -> '强企业', '弱企业/僵尸企业'; under '居民' -> '高级员工', '普通员工', '零工/失业边缘'.
- '资产价格/汇率' node on the right.
- '宏观状态输出' node at bottom center with connections from 企业, 居民, 银行, 资产价格/汇率.
- '箭头图例' node with description.
- Appropriate layout positions to avoid crossing arrows.
- Use nw 180-240 and showDesc true for important nodes.
- Write the same JSON to both .ai/outbox/macro-economy-system-v1.json and generated/macro-economy-system-v1.json.
- Do not modify app.js, index.html, style.css, or watcher scripts.
- Do not install packages.
```

Confidence: 0.95
Reviewed by DeepSeek API.
