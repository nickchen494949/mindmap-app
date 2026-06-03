# Task 001: Generate Machine Learning Mindmap

## Goal

Generate a human-friendly Chinese mindmap about machine learning.

The output should help a normal human understand machine learning as a decision/prediction system, not as a textbook dump.

## Read first

- `PROJECT_CONTEXT.md`
- `.ai/RULES.md`

## Output files

Create BOTH files:

1. `.ai/outbox/machine-learning.json`
2. `generated/machine-learning.json`

## Required output format

Use the app's native format:

```json
{
  "nodes": [
    {
      "id": 1,
      "x": 600,
      "y": 100,
      "label": "机器学习",
      "desc": "让机器从历史数据中找规律，用来预测或决策",
      "bg": "#ffffff",
      "border": "#6366f1"
    }
  ],
  "arrows": [
    {
      "id": "a1",
      "from": 1,
      "fromPort": "bottom",
      "to": 2,
      "toPort": "top",
      "label": "解决",
      "color": "#6366f1",
      "isStraight": true,
      "bidir": false,
      "mark": null
    }
  ]
}
```

## Mindmap content requirements

Main center node:

- 机器学习

Main branches:

1. 解决什么问题
   - 从数据找规律
   - 预测数字
   - 判断类别
   - 找相似群体
   - 连续做决定

2. 学习流程
   - 收集数据
   - 选择特征
   - 训练模型
   - 验证模型
   - 样本外测试
   - 上线预测
   - 复盘更新

3. 主要方法
   - 回归
   - 分类
   - 聚类
   - 树模型
   - 神经网络
   - 强化学习

4. 防止自欺欺人
   - 过拟合
   - 数据泄露
   - 样本内陷阱
   - 基准模型
   - 前向测试

5. 现实用途
   - 投资策略
   - 推荐系统
   - 风控
   - 图像识别
   - 文字理解

## Style rules

- Use Chinese labels.
- Explain like talking to a smart middle-school student.
- Max 30 nodes.
- Every arrow MUST have a label.
- Arrow labels should be relationship verbs such as: 解决 / 需要 / 训练 / 验证 / 防止 / 用在 / 属于.
- Put longer explanation into `desc`, not `label`.
- Use simple vertical layout with clear branches.
- Do NOT modify `app.js`, `index.html`, or `style.css`.
- Do NOT delete existing files.

## Success check

After completion, these files must exist:

- `.ai/outbox/machine-learning.json`
- `generated/machine-learning.json`

Both JSON files should be valid JSON and loadable by the app.
