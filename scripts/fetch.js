/**
 * 外刊源抓取模块
 * 支持 RSS 订阅抓取和网页解析回退
 */

import https from 'https';
import http from 'http';

function fetchUrl(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    const req = client.get(url, { timeout }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchUrl(res.headers.location, timeout).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// ⚠️ 已知风险 [P1-3]：当前使用正则解析 RSS XML，无法正确处理 CDATA 嵌套、
// XML namespace、HTML 实体编码等复杂情况。若引入真实 RSS 源，建议替换为
// fast-xml-parser 或 rss-parser 等专业库。
function parseRSS(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const title = (itemXml.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1]?.trim() || '';
    const link = (itemXml.match(/<link>(.*?)<\/link>/) || [])[1]?.trim() || '';
    const desc = (itemXml.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/) || [])[1]?.trim() || '';
    const pubDate = (itemXml.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1]?.trim() || '';
    if (title && link) {
      items.push({ title, link, description: desc, pubDate });
    }
  }
  return items;
}

export async function fetchSources(config) {
  const candidates = [];
  const sources = config.sources || [];

  for (const source of sources) {
    let retries = 2;
    while (retries >= 0) {
      try {
        console.log(`  抓取 ${source.name} ...`);
        const xml = await fetchUrl(source.rss);
        const items = parseRSS(xml);
        console.log(`    获取 ${items.length} 条`);
        for (const item of items) {
          candidates.push({
            title: item.title,
            url: item.link,
            description: item.description,
            source: source.name,
            pubDate: item.pubDate
          });
        }
        break;
      } catch (e) {
        if (retries === 0) {
          console.warn(`    最终失败: ${e.message}`);
        } else {
          console.warn(`    失败，重试中... (${e.message})`);
        }
        retries--;
      }
    }
  }

  return candidates;
}
