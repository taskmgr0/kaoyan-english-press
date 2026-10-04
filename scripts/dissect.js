/**
 * AI 六模块拆解模块
 * 调用 OpenAI 兼容 API 对选定文章进行六模块拆解
 */

import https from 'https';

function makeOpenAIRequest(apiKey, baseUrl, model, messages, maxTokens = 4000) {
  const url = new URL(`${baseUrl || 'https://api.openai.com/v1'}/chat/completions`);
  const data = JSON.stringify({
    model,
    messages,
    max_tokens: maxTokens,
    temperature: 0.7
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      timeout: 120000
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json.error) reject(new Error(json.error.message));
          else resolve(json);
        } catch (e) {
          reject(new Error(`Invalid JSON: ${body.slice(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(data);
    req.end();
  });
}

function buildDissectPrompt(article) {
  return `你是一位考研英语辅导专家。请将以下外刊文章按考研视角拆解为六模块 JSON 格式。

文章标题: ${article.title}
文章链接: ${article.url}
来源: ${article.source}

要求严格按照以下 schema 输出 JSON（不要输出其他文字）：

{
  "meta": {
    "title": "原文标题",
    "source": "来源名",
    "sourceUrl": "文章链接",
    "publishDate": "YYYY-MM-DD",
    "topic": "题材(technology/economy/health/environment/society/education/policy之一)",
    "difficulty": "easy/medium/hard",
    "wordCount": 850
  },
  "modules": {
    "introduction": {
      "chineseSummary": "200字以内中文导读",
      "whyItMatters": "为什么考研人需要关注(1-2句)",
      "relatedExamYears": ["2024", "2022"]
    },
    "vocabulary": {
      "cards": [
        {
          "id": "vocab_001",
          "word": "英文单词",
          "phonetic": "/音标/",
          "meaning": "中文释义",
          "partOfSpeech": "词性缩写",
          "examFrequency": "高频/中频/低频",
          "example": { "sentence": "例句", "source": "原文/改写", "translation": "例句翻译" },
          "collocation": ["搭配1", "搭配2"],
          "synonyms": ["近义词"],
          "note": "考研注意点"
        }
      ]
    },
    "sentences": {
      "cards": [
        {
          "id": "sentence_001",
          "original": "原句",
          "translation": "中文翻译",
          "structure": "结构拆解",
          "keyGrammar": "语法点",
          "source": "原文/改写"
        }
      ]
    },
    "examMapping": {
      "mappings": [
        { "examYear": "年份", "examType": "英语二", "questionType": "题型", "relation": "关联说明", "note": "备注" }
      ]
    },
    "bilingual": {
      "paragraphs": [
        { "english": "英文段落", "chinese": "中文参考译文" }
      ]
    },
    "fragmentCards": {
      "cards": [
        { "id": "frag_001", "type": "quote/fact/data", "content": "碎片内容", "context": "上下文" }
      ]
    }
  }
}

硬性要求：
1. vocabulary.cards 至少 8 张，每张必须包含 word, phonetic, meaning, partOfSpeech, example
2. sentences.cards 至少 2 张，每张必须包含 original, translation, structure
3. 例句必须标注 source: "原文" 或 "改写"
4. topic 必须是 7 类之一: technology/economy/health/environment/society/education/policy
5. 来源信息必须完整

请输出纯 JSON，不要 markdown 代码块标记。`;
}

export async function dissectArticle(article, { apiKey, baseUrl, config }) {
  const model = config.ai?.model || 'gpt-4o-mini';
  const maxTokens = config.ai?.maxTokens || 4000;

  const response = await makeOpenAIRequest(apiKey, baseUrl, model, [
    { role: 'system', content: '你是一个考研英语辅导专家，擅长将外刊文章拆解为适合考研备考的学习材料。' },
    { role: 'user', content: buildDissectPrompt(article) }
  ], maxTokens);

  const content = response.choices[0]?.message?.content || '';
  let data;
  try {
    data = JSON.parse(content);
  } catch (e) {
    // 尝试去除 markdown 代码块标记
    const cleaned = content.replace(/```json\s*/, '').replace(/```\s*$/, '').trim();
    data = JSON.parse(cleaned);
  }

  // 生成 ID
  const now = new Date();
  const year = now.getFullYear();
  const start = new Date(year, 0, 1);
  const week = Math.floor((now - start) / 604800000) + 1;
  const topic = data.meta?.topic || article.topic || 'technology';
  const id = `article_${year}_w${String(week).padStart(2, '0')}_${topic}_0${Math.floor(Math.random() * 9) + 1}`;

  return {
    id,
    meta: {
      ...data.meta,
      source: data.meta?.source || article.source,
      sourceUrl: data.meta?.sourceUrl || article.url,
      publishDate: data.meta?.publishDate || new Date().toISOString().slice(0, 10),
      topic,
      generatedAt: new Date().toISOString(),
      status: 'pending'
    },
    modules: data.modules
  };
}
