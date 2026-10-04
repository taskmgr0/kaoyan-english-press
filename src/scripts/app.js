/**
 * 主应用逻辑 - 页面渲染、路由、数据管理
 */

import { loadProgress, saveProgress, exportProgress, importProgress } from './storage.js';
import { getTodayQueue, submitReview, activateCard, resetCard, getStats } from './review.js';

// ===== 全局状态 =====
let indexData = null;
let topicCache = {};
let allCards = [];
let currentRoute = '';

const TOPIC_NAMES = {
  technology: '科技', economy: '经济', health: '健康',
  environment: '环境', society: '社会', education: '文化教育', policy: '法律政策'
};

const TOPIC_EMOJI = {
  technology: '💻', economy: '💰', health: '🏥',
  environment: '🌿', society: '🏘️', education: '📚', policy: '⚖️'
};

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', init);

function init() {
  // 移动端导航
  document.getElementById('navToggle')?.addEventListener('click', () => {
    document.getElementById('navLinks').classList.toggle('open');
  });

  // 路由
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

async function loadIndex() {
  if (indexData) return indexData;
  try {
    const res = await fetch('./content/index.json');
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    indexData = await res.json();
    buildAllCardsList();
    return indexData;
  } catch (e) {
    console.error('加载索引失败:', e);
    indexData = { meta: { totalArticles: 0 }, articles: {}, topics: {}, weeks: [], _error: true, _errorMsg: String(e.message || e) };
    return indexData;
  }
}

async function loadTopic(topic) {
  if (topicCache[topic]) return topicCache[topic];
  try {
    const res = await fetch(`./content/topics/${topic}.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const data = await res.json();
    topicCache[topic] = data;
    return data;
  } catch (e) {
    console.error(`加载题材 ${topic} 失败:`, e);
    topicCache[topic] = { articles: [], _error: true, _errorMsg: String(e.message || e) };
    return topicCache[topic];
  }
}

function buildAllCardsList() {
  allCards = [];
  if (!indexData) return;
  for (const [articleId, meta] of Object.entries(indexData.articles || {})) {
    // 词汇卡
    // 需要从topic文件加载完整数据才能拿到卡片
  }
}

async function buildAllCardsFromTopics() {
  if (allCards.length > 0) return allCards;
  allCards = [];
  const topics = Object.keys(TOPIC_NAMES);
  for (const topic of topics) {
    const data = await loadTopic(topic);
    for (const article of data.articles || []) {
      const vocab = article.modules?.vocabulary?.cards || [];
      const sentences = article.modules?.sentences?.cards || [];
      for (const c of vocab) {
        allCards.push({ ...c, articleId: article.id, articleTitle: article.meta?.title, topic: article.meta?.topic, cardType: 'vocabulary' });
      }
      for (const c of sentences) {
        allCards.push({ ...c, articleId: article.id, articleTitle: article.meta?.title, topic: article.meta?.topic, cardType: 'sentence' });
      }
    }
  }
  return allCards;
}

function handleRoute() {
  const hash = window.location.hash || '#/';
  const parts = hash.replace('#/', '').split('/');
  const route = parts[0] || 'home';
  const param = parts[1] || '';
  currentRoute = route;

  // 更新导航激活状态
  document.querySelectorAll('.nav-links a').forEach(a => {
    a.classList.toggle('active', a.dataset.route === route || (route === 'home' && !a.dataset.route));
  });
  document.getElementById('navLinks')?.classList.remove('open');

  const app = document.getElementById('app');
  // 骨架屏占位，无可见 loading 文字，满足秒开约束
  app.innerHTML = `
    <div class="skeleton-home">
      <div class="skeleton-block" style="height:72px;margin-bottom:16px;border-radius:12px"></div>
      <div class="skeleton-block" style="height:28px;width:120px;margin-bottom:12px;border-radius:6px"></div>
      <div class="skeleton-block" style="height:88px;margin-bottom:12px;border-radius:12px"></div>
      <div class="skeleton-block" style="height:88px;margin-bottom:12px;border-radius:12px"></div>
      <div class="skeleton-block" style="height:28px;width:120px;margin:28px 0 12px;border-radius:6px"></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px">
        <div class="skeleton-block" style="height:80px;border-radius:12px"></div>
        <div class="skeleton-block" style="height:80px;border-radius:12px"></div>
        <div class="skeleton-block" style="height:80px;border-radius:12px"></div>
        <div class="skeleton-block" style="height:80px;border-radius:12px"></div>
      </div>
    </div>`;

  switch (route) {
    case 'home': renderHome(app); break;
    case 'article': renderArticle(app, param); break;
    case 'topics': renderTopics(app, param); break;
    case 'cards': renderCards(app); break;
    case 'review': renderReview(app); break;
    default: renderHome(app);
  }
}

// ===== 首页 =====
function renderErrorBanner(msg) {
  return `<div class="error-banner" style="background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;padding:12px 16px;border-radius:12px;margin-bottom:16px;font-size:14px">
    <strong>内容加载失败</strong>：${escapeHtml(msg)}<br>
    <span style="font-size:13px">请检查网络连接或刷新页面重试。</span>
  </div>`;
}

async function renderHome(container) {
  const data = await loadIndex();

  if (data._error) {
    container.innerHTML = renderErrorBanner(data._errorMsg);
    return;
  }

  const progress = loadProgress();
  const cards = await buildAllCardsFromTopics();
  const queue = getTodayQueue(cards, progress);

  const thisWeek = data.weeks?.[data.weeks.length - 1];
  const weekArticles = thisWeek?.articles || [];

  let html = '';

  // 复习入口
  const totalReview = queue.reviewQueue.length + queue.newQueue.length;
  if (totalReview > 0) {
    html += `
      <div class="review-entry">
        <div>
          <div class="review-entry-text">📚 今日复习队列</div>
          <div class="review-entry-count">待复习 ${queue.reviewQueue.length} 张 · 新卡 ${queue.newQueue.length} 张</div>
        </div>
        <a href="#/review" class="review-entry-btn">开始复习</a>
      </div>`;
  }

  // 本周热点
  html += `<h2 class="page-title">本周热点</h2>`;
  if (weekArticles.length === 0) {
    html += `<div class="card"><p>本周暂无文章</p></div>`;
  } else {
    for (const aid of weekArticles) {
      const meta = data.articles?.[aid];
      if (!meta) continue;
      html += renderArticleItem(aid, meta);
    }
  }

  // 题材快捷入口
  html += `<h2 class="page-title" style="margin-top:28px">题材入口</h2>`;
  html += `<div class="topic-grid">`;
  for (const [key, name] of Object.entries(TOPIC_NAMES)) {
    const count = data.topics?.[key]?.articleCount || 0;
    html += `
      <a href="#/topics/${key}" class="topic-card">
        <div class="topic-name">${TOPIC_EMOJI[key]} ${name}</div>
        <div class="topic-count">${count} 篇文章</div>
      </a>`;
  }
  html += `</div>`;

  container.innerHTML = html;
}

function renderArticleItem(aid, meta) {
  return `
    <a href="#/article/${aid}" class="article-item">
      <div style="flex:1">
        <h3>${escapeHtml(meta.title)}</h3>
        <div class="meta">
          <span class="topic-badge topic-${meta.topic}">${TOPIC_NAMES[meta.topic] || meta.topic}</span>
          <span>${meta.source}</span>
          <span class="difficulty-${meta.difficulty}">${meta.difficulty === 'easy' ? '简单' : meta.difficulty === 'medium' ? '中等' : '困难'}</span>
          <span>${meta.publishDate}</span>
        </div>
      </div>
    </a>`;
}

// ===== 文章拆解页 =====
async function renderArticle(container, articleId) {
  const data = await loadIndex();
  if (data._error) {
    container.innerHTML = renderErrorBanner(data._errorMsg);
    return;
  }
  const meta = data.articles?.[articleId];
  if (!meta) {
    container.innerHTML = '<div class="empty-state"><div class="icon">📄</div><p>文章未找到</p></div>';
    return;
  }

  const topicData = await loadTopic(meta.topic);
  if (topicData._error) {
    container.innerHTML = renderErrorBanner(topicData._errorMsg);
    return;
  }
  const article = topicData.articles?.find(a => a.id === articleId);
  if (!article) {
    container.innerHTML = '<div class="empty-state"><div class="icon">📄</div><p>文章未找到</p></div>';
    return;
  }

  const mods = article.modules || {};
  let html = '';

  // 标题区
  html += `
    <div class="card" style="margin-bottom:20px">
      <h1 style="font-size:20px;margin-bottom:8px">${escapeHtml(meta.title)}</h1>
      <div class="meta">
        <span class="topic-badge topic-${meta.topic}">${TOPIC_NAMES[meta.topic]}</span>
        <span>${meta.source}</span>
        <span>${meta.publishDate}</span>
        <a href="${meta.url}" target="_blank" style="color:var(--primary);font-size:13px">阅读原文 →</a>
      </div>
    </div>`;

  // 1. 中文导读
  if (mods.introduction) {
    html += `<div class="module-section">`;
    html += `<div class="module-header"><span class="icon">📖</span>热点导读</div>`;
    html += `<div class="card">`;
    html += `<p style="margin-bottom:10px"><strong>摘要：</strong>${escapeHtml(mods.introduction.chineseSummary)}</p>`;
    html += `<p style="margin-bottom:10px"><strong>为什么关注：</strong>${escapeHtml(mods.introduction.whyItMatters)}</p>`;
    if (mods.introduction.relatedExamYears?.length) {
      html += `<p><strong>相关真题年份：</strong>${mods.introduction.relatedExamYears.join('、')}</p>`;
    }
    html += `</div></div>`;
  }

  // 2. 核心词汇卡
  if (mods.vocabulary?.cards?.length) {
    html += `<div class="module-section">`;
    html += `<div class="module-header"><span class="icon">📝</span>核心词汇卡 (${mods.vocabulary.cards.length}张)</div>`;
    html += `<div class="vocab-grid">`;
    for (const card of mods.vocabulary.cards) {
      html += renderVocabCard(card, articleId);
    }
    html += `</div></div>`;
  }

  // 3. 长难句拆解
  if (mods.sentences?.cards?.length) {
    html += `<div class="module-section">`;
    html += `<div class="module-header"><span class="icon">✂️</span>长难句拆解 (${mods.sentences.cards.length}句)</div>`;
    for (const card of mods.sentences.cards) {
      html += renderSentenceCard(card, articleId);
    }
    html += `</div>`;
  }

  // 4. 考点映射
  if (mods.examMapping?.mappings?.length) {
    html += `<div class="module-section">`;
    html += `<div class="module-header"><span class="icon">🎯</span>考点映射</div>`;
    html += `<div class="card">`;
    for (const m of mods.examMapping.mappings) {
      html += `<div style="padding:10px 0;border-bottom:1px solid var(--border)">`;
      html += `<strong>${m.examYear} ${m.examType} · ${m.questionType}</strong>`;
      html += `<div style="font-size:13px;color:var(--text-light);margin-top:4px">${m.relation} — ${m.note}</div>`;
      html += `</div>`;
    }
    html += `</div></div>`;
  }

  // 5. 双语对照
  if (mods.bilingual?.paragraphs?.length) {
    html += `<div class="module-section">`;
    html += `<div class="module-header"><span class="icon">🌐</span>双语对照</div>`;
    html += `<div class="card">`;
    for (const p of mods.bilingual.paragraphs) {
      html += `<div class="bilingual-pair">`;
      html += `<div class="en">${escapeHtml(p.english)}</div>`;
      html += `<div class="cn">${escapeHtml(p.chinese)}</div>`;
      html += `</div>`;
    }
    html += `</div></div>`;
  }

  // 6. 碎片卡
  if (mods.fragmentCards?.cards?.length) {
    html += `<div class="module-section">`;
    html += `<div class="module-header"><span class="icon">🧩</span>碎片卡</div>`;
    for (const card of mods.fragmentCards.cards) {
      html += `<div class="card fragment-card">`;
      html += `<div class="fragment-type">${card.type === 'quote' ? '引用' : card.type === 'fact' ? '事实' : '数据'}</div>`;
      html += `<div class="fragment-content">${escapeHtml(card.content)}</div>`;
      html += `<div class="fragment-context">${escapeHtml(card.context)}</div>`;
      html += `</div>`;
    }
    html += `</div>`;
  }

  container.innerHTML = html;

  // 绑定卡片翻面事件
  bindFlipCards();
  // 绑定加入复习队列事件
  bindActivateCards(articleId);
}

function renderVocabCard(card, articleId) {
  const ex = card.example || {};
  return `
    <div class="card vocab-card flip-card" data-card-id="${escapeHtml(card.id)}" data-type="${escapeHtml('vocabulary')}" data-article="${escapeHtml(articleId)}">
      <div class="flip-card-inner">
        <div class="flip-card-front">
          <div>
            <span class="vocab-word">${escapeHtml(card.word)}</span>
            <span class="vocab-phonetic">${escapeHtml(card.phonetic || '')}</span>
            <span class="vocab-pos">${escapeHtml(card.partOfSpeech || '')}</span>
          </div>
          <div class="vocab-meaning">${escapeHtml(card.meaning || '')}</div>
          <div class="vocab-tags">
            <span class="vocab-tag">${escapeHtml(card.examFrequency || '')}</span>
            ${(card.collocation || []).map(c => `<span class="vocab-tag">${escapeHtml(c)}</span>`).join('')}
          </div>
          <div class="flip-hint">点击翻面查看例句 →</div>
        </div>
        <div class="flip-card-back">
          <div class="vocab-example">
            <div class="en">${escapeHtml(ex.sentence || '')} <span class="src-tag">${escapeHtml(ex.source || '')}</span></div>
            <div class="cn">${escapeHtml(ex.translation || '')}</div>
          </div>
          ${card.synonyms?.length ? `<div style="margin-top:8px;font-size:12px">近义词: ${card.synonyms.map(s => escapeHtml(s)).join(', ')}</div>` : ''}
          ${card.note ? `<div style="margin-top:8px;font-size:12px;color:var(--primary)">💡 ${escapeHtml(card.note)}</div>` : ''}
          <div class="flip-hint">← 点击翻回</div>
        </div>
      </div>
    </div>`;
}

function renderSentenceCard(card, articleId) {
  return `
    <div class="card sentence-card flip-card" data-card-id="${escapeHtml(card.id)}" data-type="${escapeHtml('sentence')}" data-article="${escapeHtml(articleId)}">
      <div class="flip-card-inner">
        <div class="flip-card-front">
          <div class="sentence-original">${escapeHtml(card.original)}</div>
          <div class="flip-hint">点击翻面查看翻译和结构 →</div>
        </div>
        <div class="flip-card-back">
          <div class="sentence-translation">${escapeHtml(card.translation)}</div>
          <div class="sentence-structure">${escapeHtml(card.structure)}</div>
          <div class="sentence-grammar">语法点: ${escapeHtml(card.keyGrammar)}</div>
          <div style="margin-top:8px;font-size:12px">来源: <span class="src-tag">${escapeHtml(card.source || '')}</span></div>
          <div class="flip-hint">← 点击翻回</div>
        </div>
      </div>
    </div>`;
}

function bindFlipCards() {
  document.querySelectorAll('.flip-card').forEach(card => {
    card.addEventListener('click', () => {
      card.classList.toggle('flipped');
      // 首次翻面时自动激活卡片
      const cardId = card.dataset.cardId;
      const type = card.dataset.type;
      const articleId = card.dataset.article;
      if (cardId && type && articleId) {
        activateCard(cardId, type, articleId);
      }
    });
  });
}

function bindActivateCards(articleId) {
  // 卡片翻面时已自动激活
}

// ===== 题材库页 =====
async function renderTopics(container, selectedTopic) {
  const data = await loadIndex();
  if (data._error) {
    container.innerHTML = renderErrorBanner(data._errorMsg);
    return;
  }

  if (selectedTopic && TOPIC_NAMES[selectedTopic]) {
    // 显示某题材下的文章列表
    const topicData = await loadTopic(selectedTopic);
    if (topicData._error) {
      container.innerHTML = renderErrorBanner(topicData._errorMsg);
      return;
    }
    let html = '';
    html += `<h2 class="page-title">${TOPIC_EMOJI[selectedTopic]} ${TOPIC_NAMES[selectedTopic]}</h2>`;
    html += `<p class="page-subtitle">${topicData.articles?.length || 0} 篇文章</p>`;

    if (!topicData.articles?.length) {
      html += `<div class="empty-state"><div class="icon">📂</div><p>该题材暂无文章</p></div>`;
    } else {
      for (const article of topicData.articles) {
        const meta = article.meta || {};
        html += renderArticleItem(article.id, meta);
      }
    }
    html += `<div style="margin-top:16px"><a href="#/topics" style="color:var(--primary)">← 返回题材库</a></div>`;
    container.innerHTML = html;
    return;
  }

  // 显示全部题材
  let html = `<h2 class="page-title">题材库</h2>`;
  html += `<div class="topic-grid">`;
  for (const [key, name] of Object.entries(TOPIC_NAMES)) {
    const count = data.topics?.[key]?.articleCount || 0;
    html += `
      <a href="#/topics/${key}" class="topic-card">
        <div class="topic-name">${TOPIC_EMOJI[key]} ${name}</div>
        <div class="topic-count">${count} 篇文章</div>
      </a>`;
  }
  html += `</div>`;
  container.innerHTML = html;
}

// ===== 卡片区 =====
async function renderCards(container) {
  const cards = await buildAllCardsFromTopics();

  let html = `<h2 class="page-title">卡片区</h2>`;

  // 筛选栏
  html += `
    <div class="filter-bar">
      <select id="cardTopicFilter">
        <option value="">全部题材</option>
        ${Object.entries(TOPIC_NAMES).map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}
      </select>
      <select id="cardTypeFilter">
        <option value="">全部类型</option>
        <option value="vocabulary">词汇卡</option>
        <option value="sentence">长难句</option>
      </select>
      <input type="text" id="cardSearch" placeholder="搜索单词或句子...">
    </div>`;

  html += `<div id="cardsList">`;
  html += renderCardsList(cards);
  html += `</div>`;

  container.innerHTML = html;

  // 绑定筛选事件
  const topicFilter = document.getElementById('cardTopicFilter');
  const typeFilter = document.getElementById('cardTypeFilter');
  const searchInput = document.getElementById('cardSearch');

  function filter() {
    let filtered = [...cards];
    const topic = topicFilter.value;
    const type = typeFilter.value;
    const query = searchInput.value.trim().toLowerCase();

    if (topic) filtered = filtered.filter(c => c.topic === topic);
    if (type) filtered = filtered.filter(c => c.cardType === type);
    if (query) {
      filtered = filtered.filter(c =>
        (c.word && c.word.toLowerCase().includes(query)) ||
        (c.original && c.original.toLowerCase().includes(query)) ||
        (c.meaning && c.meaning.includes(query))
      );
    }
    document.getElementById('cardsList').innerHTML = renderCardsList(filtered);
    bindFlipCards();
  }

  topicFilter?.addEventListener('change', filter);
  typeFilter?.addEventListener('change', filter);
  searchInput?.addEventListener('input', filter);
}

function renderCardsList(cards) {
  if (cards.length === 0) {
    return `<div class="empty-state"><div class="icon">🔍</div><p>没有找到匹配的卡片</p></div>`;
  }

  let html = `<p style="margin-bottom:12px;font-size:13px;color:var(--text-light)">共 ${cards.length} 张卡片</p>`;
  html += `<div class="vocab-grid">`;
  for (const card of cards) {
    if (card.cardType === 'vocabulary') {
      html += renderVocabCard(card, card.articleId);
    } else {
      html += renderSentenceCard(card, card.articleId);
    }
  }
  html += `</div>`;
  return html;
}

// ===== 复习页 =====
let reviewState = { queue: [], index: 0, mode: 'review' }; // mode: 'review' or 'new'

async function renderReview(container) {
  const progress = loadProgress();
  const cards = await buildAllCardsFromTopics();
  const queue = getTodayQueue(cards, progress);
  const stats = getStats(progress);

  // 合并队列：先复习到期的，再学新的
  const fullQueue = [...queue.reviewQueue, ...queue.newQueue];

  if (fullQueue.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">🎉</div>
        <p>今日复习已完成！</p>
        <p style="font-size:13px;margin-top:8px">明天再来吧</p>
        ${renderReviewStats(stats)}
        ${renderReviewSettings(progress)}
      </div>`;
    return;
  }

  reviewState = { queue: fullQueue, index: 0, mode: 'review' };

  let html = `<h2 class="page-title">今日复习</h2>`;
  html += renderReviewStats(stats);
  html += `<div id="reviewCardArea"></div>`;
  html += renderReviewSettings(progress);
  container.innerHTML = html;

  showReviewCard();
}

function renderReviewStats(stats) {
  return `
    <div class="review-stats">
      <div class="stat-box"><div class="num">${stats.totalActivated}</div><div class="label">已激活</div></div>
      <div class="stat-box"><div class="num">${stats.dueToday}</div><div class="label">今日到期</div></div>
      <div class="stat-box"><div class="num">${stats.mastered}</div><div class="label">已掌握</div></div>
      <div class="stat-box"><div class="num">${stats.streak}</div><div class="label">连续天数</div></div>
    </div>`;
}

function renderReviewSettings(progress) {
  const newLimit = Number.isFinite(progress.settings?.dailyNewCardsLimit) ? progress.settings.dailyNewCardsLimit : 10;
  const reviewLimit = Number.isFinite(progress.settings?.dailyReviewLimit) ? progress.settings.dailyReviewLimit : 50;
  return `
    <div class="card" style="margin-top:24px">
      <div class="card-title">⚙️ 设置</div>
      <div class="settings-row">
        <label>每日新卡上限</label>
        <input type="number" id="newLimit" value="${Math.max(1, Math.min(50, newLimit))}" min="1" max="50">
      </div>
      <div class="settings-row">
        <label>每日复习上限</label>
        <input type="number" id="reviewLimit" value="${Math.max(1, Math.min(200, reviewLimit))}" min="1" max="200">
      </div>
      <div class="settings-row">
        <button class="btn btn-primary" id="saveSettings">保存设置</button>
        <button class="btn btn-secondary" id="exportBtn">导出进度</button>
        <label class="btn btn-secondary" style="cursor:pointer">
          <input type="file" id="importBtn" accept=".json" style="display:none">导入进度
        </label>
      </div>
      <div id="settingsMsg" style="font-size:13px;color:var(--success);margin-top:8px"></div>
    </div>`;
}

function showReviewCard() {
  const area = document.getElementById('reviewCardArea');
  const { queue, index } = reviewState;

  if (index >= queue.length) {
    area.innerHTML = `
      <div class="empty-state">
        <div class="icon">🎉</div>
        <p>本轮复习完成！</p>
        <p style="font-size:13px;margin-top:8px">共复习 ${queue.length} 张卡片</p>
        <a href="#/" class="btn btn-primary" style="margin-top:16px;display:inline-block">返回首页</a>
      </div>`;
    return;
  }

  const card = queue[index];
  const isReview = card.progress !== undefined;
  const progress = loadProgress();
  const cardProgress = progress.cards?.[card.id];

  let html = '';
  html += `<div style="text-align:center;margin-bottom:12px;font-size:13px;color:var(--text-light)">`;
  html += `${index + 1} / ${queue.length} · ${isReview ? '复习' : '新卡'}`;
  if (cardProgress) {
    html += ` · 重复 ${cardProgress.repetitions || 0} 次 · EF ${(cardProgress.easeFactor || 2.5).toFixed(1)}`;
  }
  html += `</div>`;

  // 大卡片
  html += `<div class="review-card-large">`;
  if (card.cardType === 'vocabulary') {
    html += renderVocabCard(card, card.articleId).replace('flip-card', 'flip-card review-card-large');
  } else {
    html += renderSentenceCard(card, card.articleId).replace('flip-card', 'flip-card review-card-large');
  }
  html += `</div>`;

  // 自评按钮
  html += `<div class="review-actions">`;
  html += `<button class="review-btn review-btn-forget" data-rating="1">😵 忘记</button>`;
  html += `<button class="review-btn review-btn-vague" data-rating="2">🤔 模糊</button>`;
  html += `<button class="review-btn review-btn-know" data-rating="3">😊 认识</button>`;
  html += `</div>`;

  area.innerHTML = html;

  // 绑定翻面
  bindFlipCards();

  // 绑定评分按钮
  area.querySelectorAll('.review-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const rating = parseInt(btn.dataset.rating);
      submitReview(card.id, rating);
      reviewState.index++;
      showReviewCard();
    });
  });
}

// ===== 设置页事件（在复习页渲染后绑定） =====
document.addEventListener('click', e => {
  // 保存设置
  if (e.target.id === 'saveSettings') {
    const progress = loadProgress();
    const newLimit = parseInt(document.getElementById('newLimit')?.value) || 10;
    const reviewLimit = parseInt(document.getElementById('reviewLimit')?.value) || 50;
    progress.settings.dailyNewCardsLimit = Math.max(1, Math.min(50, newLimit));
    progress.settings.dailyReviewLimit = Math.max(1, Math.min(200, reviewLimit));
    saveProgress(progress);
    const msg = document.getElementById('settingsMsg');
    if (msg) { msg.textContent = '✓ 设置已保存'; setTimeout(() => msg.textContent = '', 2000); }
  }
  // 导出
  if (e.target.id === 'exportBtn') {
    exportProgress();
    const msg = document.getElementById('settingsMsg');
    if (msg) { msg.textContent = '✓ 进度已导出'; setTimeout(() => msg.textContent = '', 2000); }
  }
});

document.addEventListener('change', e => {
  if (e.target.id === 'importBtn') {
    const file = e.target.files?.[0];
    if (file) {
      importProgress(file).then(() => {
        const msg = document.getElementById('settingsMsg');
        if (msg) { msg.textContent = '✓ 进度已导入，页面将刷新'; setTimeout(() => window.location.reload(), 1000); }
      }).catch(err => {
        const msg = document.getElementById('settingsMsg');
        if (msg) { msg.textContent = '✗ 导入失败: ' + err.message; msg.style.color = 'var(--danger)'; }
      });
    }
  }
});

// ===== 工具函数 =====
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
