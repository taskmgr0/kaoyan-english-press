/**
 * 选题过滤模块
 * 按题材匹配、生词密度预估、去重等规则筛选文章
 */

export function selectArticles(candidates, config) {
  const topics = config.topics || {};
  const maxArticles = config.generation?.articlesPerWeek || 4;
  const rotation = config.generation?.defaultTopicRotation || [];

  // 计算当前周次
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const weekNum = Math.floor((now - start) / 604800000);
  const thisWeekTopic = rotation[weekNum % rotation.length];

  const selected = [];
  const seen = new Set();

  // 优先选本周题材
  const topicKeywords = Object.entries(topics).reduce((acc, [key, val]) => {
    acc[key] = val.keywords || [];
    return acc;
  }, {});

  for (const candidate of candidates) {
    const text = `${candidate.title} ${candidate.description}`.toLowerCase();

    // 去重：使用 URL 作为去重键（天然唯一），避免中文标题被正则清洗为空字符串导致去重失效
    const key = candidate.url;
    if (!key || seen.has(key)) continue;
    seen.add(key);

    // 题材匹配
    let matchedTopic = null;
    let maxMatches = 0;
    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      const matches = keywords.filter(kw => text.includes(kw.toLowerCase())).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        matchedTopic = topic;
      }
    }
    if (!matchedTopic) continue;

    // 只取最近 7 天
    const pubDate = candidate.pubDate ? new Date(candidate.pubDate) : null;
    if (pubDate && (now - pubDate) > 7 * 86400000) continue;

    candidate.topic = matchedTopic;
    candidate.priority = matchedTopic === thisWeekTopic ? 2 : 1;
    selected.push(candidate);
  }

  // 按优先级排序，取前 N 篇
  selected.sort((a, b) => b.priority - a.priority);
  return selected.slice(0, maxArticles);
}
