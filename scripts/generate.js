#!/usr/bin/env node
/**
 * 内容生成流水线主入口
 * 运行完整流程：抓取 -> 选题 -> AI拆解 -> 质检 -> 入库 -> 生成索引
 *
 * 用法：OPENAI_API_KEY=xxx OPENAI_BASE_URL=xxx node scripts/generate.js
 */

import { fetchSources } from './fetch.js';
import { selectArticles } from './select.js';
import { dissectArticle } from './dissect.js';
import { qualityCheck } from './quality-check.js';
import { buildIndex } from './build-index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// 加载配置
const config = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'config.json'), 'utf-8'));

async function main() {
  console.log('=== 考研英语外刊热点拆解 · 内容生成流水线 ===');
  console.log('开始时间:', new Date().toISOString());

  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL;

  if (!apiKey) {
    console.warn('⚠️ OPENAI_API_KEY 未设置，AI 拆解将使用样例数据模式');
  }

  // 1. 抓取外刊源
  console.log('\n[1/5] 抓取外刊源...');
  let candidates = [];
  try {
    candidates = await fetchSources(config);
    console.log(`  抓取到 ${candidates.length} 条候选文章`);
  } catch (e) {
    console.warn('  抓取失败:', e.message);
    console.warn('  将使用样例数据模式');
  }

  // 2. 选题过滤
  console.log('\n[2/5] 选题过滤...');
  let selected = [];
  if (candidates.length > 0) {
    selected = selectArticles(candidates, config);
    console.log(`  筛选出 ${selected.length} 篇文章`);
  } else {
    console.log('  无候选文章，跳过选题');
  }

  // 3. AI 六模块拆解
  console.log('\n[3/5] AI 六模块拆解...');
  const dissected = [];
  if (selected.length > 0 && apiKey) {
    for (const article of selected) {
      try {
        const result = await dissectArticle(article, { apiKey, baseUrl, config });
        dissected.push(result);
        console.log(`  ✓ ${article.title}`);
      } catch (e) {
        console.error(`  ✗ ${article.title}:`, e.message);
      }
    }
  } else {
    console.log('  ⚠️ 无可用文章或 API Key，跳过 AI 拆解');
    console.log('  注：AI 拆解需 OPENAI_API_KEY 环境变量和可用网络');
  }

  // 4. 自动质检
  console.log('\n[4/5] 自动质检...');
  const approved = [];
  const rejected = [];
  for (const article of dissected) {
    const report = qualityCheck(article, config);
    if (report.passed) {
      article.meta.status = 'approved';
      approved.push(article);
      console.log(`  ✓ ${article.meta.title} (通过)`);
    } else {
      article.meta.status = 'rejected';
      article.qualityReport = report;
      rejected.push(article);
      console.log(`  ✗ ${article.meta.title} (未通过: ${report.failures.join(', ')})`);
    }
  }

  // 5. 入库 & 生成索引
  console.log('\n[5/5] 入库并生成索引...');

  // 写入 approved 文章
  for (const article of approved) {
    const topicFile = path.join(PROJECT_ROOT, 'content', 'topics', `${article.meta.topic}.json`);
    let topicData = { articles: [] };
    if (fs.existsSync(topicFile)) {
      topicData = JSON.parse(fs.readFileSync(topicFile, 'utf-8'));
    }
    // 去重
    const exists = topicData.articles.find(a => a.id === article.id);
    if (!exists) {
      topicData.articles.push(article);
      fs.writeFileSync(topicFile, JSON.stringify(topicData, null, 2));
      console.log(`  写入 content/topics/${article.meta.topic}.json`);
    }
  }

  // 写入 rejected 文章
  if (rejected.length > 0) {
    const weekStr = getWeekString();
    const rejectedFile = path.join(PROJECT_ROOT, 'content', 'rejected', `rejected_${weekStr}.json`);
    fs.mkdirSync(path.dirname(rejectedFile), { recursive: true });
    fs.writeFileSync(rejectedFile, JSON.stringify({ week: weekStr, articles: rejected }, null, 2));
    console.log(`  写入 content/rejected/rejected_${weekStr}.json`);
  }

  // 生成索引
  await buildIndex(PROJECT_ROOT);

  // 生成质检报告
  const report = {
    generatedAt: new Date().toISOString(),
    week: getWeekString(),
    total: dissected.length,
    approved: approved.length,
    rejected: rejected.length,
    rejectedDetails: rejected.map(a => ({
      title: a.meta.title,
      failures: a.qualityReport?.failures || []
    }))
  };
  const reportDir = path.join(PROJECT_ROOT, 'reports');
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(path.join(reportDir, `quality_${getWeekString()}.json`), JSON.stringify(report, null, 2));

  console.log('\n=== 流水线完成 ===');
  console.log(`总计: ${dissected.length} | 通过: ${approved.length} | 拒绝: ${rejected.length}`);

  // ⚠️ 已知风险 [P1-4]：当全部文章质检未通过时（approved.length === 0 且 dissected.length > 0），
  // 当前仍以 exit 0 结束，GitHub Actions 会显示"成功"。若需 Actions 状态反映内容生成失败，
  // 建议在此处增加：if (dissected.length > 0 && approved.length === 0) process.exit(1);
}

function getWeekString() {
  const now = new Date();
  const year = now.getFullYear();
  const start = new Date(year, 0, 1);
  const diff = now - start + ((start.getDay() + 6) % 7) * 86400000;
  const week = Math.floor(diff / 604800000) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
}

main().catch(e => {
  console.error('流水线异常:', e);
  process.exit(1);
});
