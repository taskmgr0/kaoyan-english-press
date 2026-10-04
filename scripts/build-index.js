/**
 * 生成 content/index.json 全局索引
 */

import fs from 'fs';
import path from 'path';

export async function buildIndex(projectRoot) {
  const contentDir = path.join(projectRoot, 'content');
  const topicsDir = path.join(contentDir, 'topics');

  const index = {
    meta: {
      version: '1.0',
      lastUpdated: new Date().toISOString(),
      totalArticles: 0,
      weekCount: 0
    },
    weeks: [],
    articles: {},
    topics: {}
  };

  if (!fs.existsSync(topicsDir)) {
    fs.mkdirSync(topicsDir, { recursive: true });
    fs.writeFileSync(path.join(contentDir, 'index.json'), JSON.stringify(index, null, 2));
    return;
  }

  const files = fs.readdirSync(topicsDir).filter(f => f.endsWith('.json'));
  const weekMap = new Map();

  for (const file of files) {
    const topic = file.replace('.json', '');
    const data = JSON.parse(fs.readFileSync(path.join(topicsDir, file), 'utf-8'));
    const articles = data.articles || [];

    index.topics[topic] = {
      name: topic,
      articleCount: articles.length,
      articleIds: articles.map(a => a.id)
    };

    for (const article of articles) {
      const meta = article.meta || {};
      index.articles[article.id] = {
        title: meta.title,
        topic: meta.topic,
        source: meta.source,
        publishDate: meta.publishDate,
        url: meta.sourceUrl,
        difficulty: meta.difficulty,
        wordCount: meta.wordCount,
        generatedAt: meta.generatedAt
      };
      index.meta.totalArticles++;

      // 按周分组
      const week = article.id.match(/w(\d{2})/)?.[1];
      if (week) {
        const weekKey = `2026-W${week}`;
        if (!weekMap.has(weekKey)) {
          weekMap.set(weekKey, { week: weekKey, theme: meta.topic, articles: [] });
        }
        weekMap.get(weekKey).articles.push(article.id);
      }
    }
  }

  index.weeks = Array.from(weekMap.values());
  index.meta.weekCount = index.weeks.length;

  fs.writeFileSync(path.join(contentDir, 'index.json'), JSON.stringify(index, null, 2));
  console.log(`  生成 index.json: ${index.meta.totalArticles} 篇文章, ${index.meta.weekCount} 周`);
}
