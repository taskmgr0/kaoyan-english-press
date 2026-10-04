/**
 * SM-2 简化版间隔重复算法
 */

import { loadProgress, saveProgress } from './storage.js';

const INITIAL_INTERVAL = 1;
const INITIAL_EF = 2.5;
const MIN_EF = 1.3;

/**
 * 评分复习一张卡片
 * @param {Object} card - 当前进度对象 { interval, easeFactor, repetitions, dueDate }
 * @param {number} rating - 1=忘记, 2=模糊, 3=认识
 */
export function reviewCard(card, rating) {
  card = { ...card };
  const today = formatDate(new Date());

  if (rating === 1) { // 忘记
    card.interval = 1;
    card.repetitions = 0;
    card.easeFactor = Math.max(MIN_EF, (card.easeFactor || INITIAL_EF) - 0.2);
  } else if (rating === 2) { // 模糊
    card.interval = card.interval || INITIAL_INTERVAL;
    card.repetitions = (card.repetitions || 0) + 1;
    card.easeFactor = Math.max(MIN_EF, (card.easeFactor || INITIAL_EF) - 0.15);
  } else if (rating === 3) { // 认识
    card.repetitions = (card.repetitions || 0) + 1;
    if (card.repetitions === 1) {
      card.interval = 1;
    } else if (card.repetitions === 2) {
      card.interval = 6;
    } else {
      card.interval = Math.round((card.interval || 1) * (card.easeFactor || INITIAL_EF));
    }
    card.easeFactor = Math.max(MIN_EF, (card.easeFactor || INITIAL_EF) + 0.1);
  }

  card.dueDate = addDays(today, card.interval);
  card.lastReviewed = today;
  if (!card.history) card.history = [];
  card.history.push({ date: today, rating });

  return card;
}

/**
 * 计算今日复习队列
 */
export function getTodayQueue(allCards, progress) {
  const today = formatDate(new Date());
  const settings = progress.settings || { dailyNewCardsLimit: 10, dailyReviewLimit: 50 };

  // 已激活的卡片
  const activatedIds = new Set(Object.keys(progress.cards || {}));

  // 新卡片（未激活的）
  const newCards = allCards.filter(c => !activatedIds.has(c.id)).slice(0, settings.dailyNewCardsLimit);

  // 到期复习卡片
  const dueCards = [];
  for (const [cardId, cardProgress] of Object.entries(progress.cards || {})) {
    if (cardProgress.dueDate <= today) {
      const fullCard = allCards.find(c => c.id === cardId);
      if (fullCard) {
        dueCards.push({
          ...fullCard,
          progress: cardProgress,
          overdueDays: daysBetween(cardProgress.dueDate, today)
        });
      }
    }
  }

  // 排序：逾期越久越优先，其次按 repetitions 升序
  dueCards.sort((a, b) => {
    if (b.overdueDays !== a.overdueDays) return b.overdueDays - a.overdueDays;
    return (a.progress.repetitions || 0) - (b.progress.repetitions || 0);
  });

  const reviewQueue = dueCards.slice(0, settings.dailyReviewLimit);

  return {
    reviewQueue,
    newQueue: newCards,
    totalDue: dueCards.length,
    totalNew: allCards.length - activatedIds.size,
    totalReviewedToday: countReviewedToday(progress)
  };
}

/**
 * 激活一张新卡片（首次学习）
 */
export function activateCard(cardId, type, articleId) {
  const progress = loadProgress();
  if (!progress.cards[cardId]) {
    progress.cards[cardId] = {
      type,
      articleId,
      interval: INITIAL_INTERVAL,
      easeFactor: INITIAL_EF,
      repetitions: 0,
      dueDate: addDays(formatDate(new Date()), 1),
      lastReviewed: formatDate(new Date()),
      history: []
    };
    saveProgress(progress);
  }
}

/**
 * 提交复习评分
 */
export function submitReview(cardId, rating) {
  const progress = loadProgress();
  const card = progress.cards[cardId];
  if (!card) return false;
  progress.cards[cardId] = reviewCard(card, rating);
  saveProgress(progress);
  return true;
}

/**
 * 重置单张卡片进度
 */
export function resetCard(cardId) {
  const progress = loadProgress();
  delete progress.cards[cardId];
  saveProgress(progress);
}

/**
 * 获取统计信息
 */
export function getStats(progress) {
  const cards = Object.values(progress.cards || {});
  const today = formatDate(new Date());
  return {
    totalActivated: cards.length,
    dueToday: cards.filter(c => c.dueDate <= today).length,
    mastered: cards.filter(c => (c.repetitions || 0) >= 3 && c.interval >= 21).length,
    streak: calculateStreak(cards)
  };
}

function countReviewedToday(progress) {
  const today = formatDate(new Date());
  return Object.values(progress.cards || {}).filter(c => c.lastReviewed === today).length;
}

function calculateStreak(cards) {
  // 简化：连续有复习记录的天数
  const dates = new Set();
  for (const c of cards) {
    if (c.history) {
      for (const h of c.history) dates.add(h.date);
    }
  }
  const sorted = Array.from(dates).sort();
  if (sorted.length === 0) return 0;
  // 检查今天或昨天是否有记录
  const today = formatDate(new Date());
  const yesterday = addDays(today, -1);
  if (sorted[sorted.length - 1] !== today && sorted[sorted.length - 1] !== yesterday) return 0;
  let streak = 1;
  for (let i = sorted.length - 1; i > 0; i--) {
    if (daysBetween(sorted[i - 1], sorted[i]) === 1) streak++;
    else break;
  }
  return streak;
}

function formatDate(d) {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  const da = new Date(a + 'T00:00:00');
  const db = new Date(b + 'T00:00:00');
  return Math.round((db - da) / 86400000);
}
