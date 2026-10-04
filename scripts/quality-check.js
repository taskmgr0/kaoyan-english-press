#!/usr/bin/env node
/**
 * 自动质检脚本
 * 检查六模块齐全、词汇卡≥8、长难句≥2、例句标注、来源完整、题材在7类内
 *
 * 用法：node scripts/quality-check.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

const VALID_TOPICS = ['technology', 'economy', 'health', 'environment', 'society', 'education', 'policy'];
const MIN_VOCAB_CARDS = 8;
const MIN_SENTENCE_CARDS = 2;

export function qualityCheck(article, config) {
  const failures = [];

  // 1. 六模块齐全
  const requiredModules = ['introduction', 'vocabulary', 'sentences', 'examMapping', 'bilingual', 'fragmentCards'];
  const modules = article.modules || {};
  for (const mod of requiredModules) {
    if (!modules[mod]) {
      failures.push(`缺少模块: ${mod}`);
    }
  }

  // 2. 词汇卡数量
  const vocabCards = modules.vocabulary?.cards || [];
  if (vocabCards.length < MIN_VOCAB_CARDS) {
    failures.push(`词汇卡不足: ${vocabCards.length} < ${MIN_VOCAB_CARDS}`);
  }

  // 3. 长难句数量
  const sentenceCards = modules.sentences?.cards || [];
  if (sentenceCards.length < MIN_SENTENCE_CARDS) {
    failures.push(`长难句不足: ${sentenceCards.length} < ${MIN_SENTENCE_CARDS}`);
  }

  // 4. 例句标注原文/改写
  for (const card of vocabCards) {
    const src = card.example?.source;
    if (!src || !['原文', '改写'].includes(src)) {
      failures.push(`词汇卡 "${card.word}" 例句未标注来源`);
    }
  }
  for (const card of sentenceCards) {
    const src = card.source;
    if (!src || !['原文', '改写'].includes(src)) {
      failures.push(`长难句卡未标注来源`);
    }
  }

  // 5. 来源信息完整
  const meta = article.meta || {};
  if (!meta.source || !meta.sourceUrl || !meta.publishDate) {
    failures.push('来源信息不完整');
  }

  // 6. 题材在7类内
  if (!VALID_TOPICS.includes(meta.topic)) {
    failures.push(`题材无效: ${meta.topic}`);
  }

  return {
    passed: failures.length === 0,
    failures,
    vocabCount: vocabCards.length,
    sentenceCount: sentenceCards.length
  };
}

async function main() {
  const config = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'config.json'), 'utf-8'));
  const topicsDir = path.join(PROJECT_ROOT, 'content', 'topics');

  if (!fs.existsSync(topicsDir)) {
    console.log('无内容库，跳过质检');
    process.exit(0);
  }

  const files = fs.readdirSync(topicsDir).filter(f => f.endsWith('.json'));
  let total = 0;
  let passed = 0;
  let failed = 0;

  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(topicsDir, file), 'utf-8'));
    for (const article of data.articles || []) {
      total++;
      const report = qualityCheck(article, config);
      if (report.passed) {
        passed++;
      } else {
        failed++;
        console.log(`✗ ${article.meta?.title || article.id}: ${report.failures.join(', ')}`);
      }
    }
  }

  console.log(`\n质检结果: 总计 ${total} | 通过 ${passed} | 未通过 ${failed}`);
  if (failed > 0) process.exit(1);
}

// 如果直接运行
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error(e); process.exit(1); });
}

export default qualityCheck;
