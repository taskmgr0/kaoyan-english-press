# 考研英语外刊热点拆解网站 · P0

> 一个面向考研英语的「外刊热点精读拆解」网站——把每周外刊热点按考研视角拆成可碎片化学习的词汇卡、长难句卡和考点卡，并内置按遗忘曲线安排的间隔重复复习系统。

## 在线访问

https://4m6pusg94kqy7.feishu.cn/page/IpmEmD3t8d1qHHa2MOGcxPJ3nTb

## 快速启动（本地运行）

```bash
# 1. 进入站点目录
cd src/

# 2. 任意静态服务器即可运行
npx serve .
# 或
python3 -m http.server 3000

# 3. 浏览器打开 http://localhost:3000
```

## P0 功能清单

| 页面 | 功能 | 状态 |
|------|------|------|
| 首页 | 本周热点列表 + 今日复习队列入口 + 7 类题材快捷入口 | ✅ |
| 文章拆解页 | 六模块纵向排布（导读/词汇/长难句/考点/双语/碎片），卡片翻面，移动端适配 | ✅ |
| 题材库页 | 7 类题材 × 文章列表 | ✅ |
| 卡片区 | 卡片流 + 按题材/类型筛选 + 关键词搜索 | ✅ |
| 复习页 | 今日复习队列、认识/模糊/忘记三档自评、新卡每日上限、进度统计 | ✅ |
| 进度导出/导入 | JSON 文件导出与恢复 | ✅ |

## 技术栈

- **前端**：Vanilla JavaScript (ES2020+)，原生 CSS，零第三方依赖
- **内容库**：静态 JSON 文件
- **复习算法**：SM-2 简化版（3 档评分，EF 下限 1.3）
- **进度存储**：浏览器 localStorage（键名 `kaoyan-review-progress`）

## 目录结构

```
kaoyan-english-press/
├── .github/workflows/generate-content.yml  # GitHub Actions 定时生成
├── scripts/                                # 内容生产脚本
│   ├── fetch.js                            # 外刊源抓取
│   ├── select.js                           # 选题过滤
│   ├── dissect.js                          # AI 六模块拆解（OpenAI 兼容 API）
│   ├── quality-check.js                    # 自动质检
│   ├── build-index.js                      # 生成全局索引
│   └── generate.js                         # 一键生成入口
├── content/                                # 内容库（静态 JSON）
│   ├── index.json                          # 全局索引
│   └── topics/                             # 按题材分文件
│       ├── technology.json
│       ├── economy.json
│       ├── health.json
│       └── environment.json
├── src/                                    # 前端站点
│   ├── index.html
│   ├── styles/main.css
│   ├── scripts/
│   │   ├── app.js                          # 主应用逻辑
│   │   ├── review.js                       # SM-2 复习算法
│   │   └── storage.js                      # localStorage 封装
│   └── content/                            # 内容库副本（部署用）
├── package.json
└── config.json                             # 站点配置
```

## 内容生产（本地一键生成）

```bash
# 安装依赖
npm install

# 配置环境变量（AI 拆解需要）
export OPENAI_API_KEY="your-api-key"
export OPENAI_BASE_URL="https://api.openai.com/v1"  # 可选，默认 OpenAI

# 一键生成内容
npm run generate

# 运行质检
npm run lint:content
```

## 自动质检规则

- 六模块齐全（缺一不可）
- 词汇卡数量 ≥ 8
- 长难句数量 ≥ 2
- 英文例句标注「原文/改写」
- 来源信息完整（来源名 + 日期 + 链接）
- 题材标签在 7 类体系内

## 样例数据

内置 4 篇完整拆解文章，覆盖 4 个题材：

| 文章 | 题材 | 来源 | 难度 |
|------|------|------|------|
| AI Regulation: The EU's Bold New Framework | 科技 | The Economist | 中等 |
| Global Trade Faces Uncertainty | 经济 | The Guardian | 中等 |
| Sleep Deprivation: The Hidden Epidemic | 健康 | BBC News | 简单 |
| Coral Reefs Show Unexpected Signs of Recovery | 环境 | The Atlantic | 困难 |

每篇均含：8-10 张词汇卡、2-3 句长难句、完整六模块、考点映射、双语对照、碎片卡。

## 复习进度数据结构（localStorage）

```json
{
  "version": "1.0",
  "lastSync": "2026-10-04T08:00:00Z",
  "cards": {
    "vocab_tech_001": {
      "type": "vocabulary",
      "articleId": "article_2026_w40_tech_01",
      "interval": 6,
      "easeFactor": 2.5,
      "repetitions": 2,
      "dueDate": "2026-10-10",
      "lastReviewed": "2026-10-04",
      "history": [{"date": "2026-10-01", "rating": 3}]
    }
  },
  "settings": {
    "dailyNewCardsLimit": 10,
    "dailyReviewLimit": 50
  }
}
```

## 验收状态

### 已验证项
- ✅ 站点可在线访问、可交互
- ✅ 首页：本周热点列表 + 复习入口 + 题材快捷入口
- ✅ 文章拆解页：六模块齐全，词汇卡/长难句卡可翻面，移动端适配
- ✅ 题材库页：7 类题材分类与文章列表
- ✅ 卡片区：筛选、搜索功能正常
- ✅ 复习页：三档自评、队列排序、进度统计
- ✅ 复习进度导出/导入真实可用
- ✅ 质检脚本对样例数据运行通过（4/4）
- ✅ 单文件夹结构符合架构文档
- ✅ 首屏无可见 loading 状态

### 未验证项 / 待补充
- ⚠️ AI 拆解脚本：当前环境未真实调用 OpenAI API（需配置 OPENAI_API_KEY）
- ⚠️ GitHub Actions 云端定时生成：需推送至 GitHub 仓库并配置 Secrets
- ⚠️ 外刊源 RSS 抓取：依赖网络环境，部分源可能需要特殊处理
- ⚠️ 多设备同步：当前 localStorage 方案为单设备，P2 阶段考虑云端同步

## 开发日志

- 2026-10-04：P0 版本完成，含 4 篇样例文章、完整前端、复习系统、内容生产脚本
