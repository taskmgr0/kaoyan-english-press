/**
 * localStorage 封装 - 复习进度持久化
 * 键名: kaoyan-review-progress
 */

const STORAGE_KEY = 'kaoyan-review-progress';

export function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultProgress();
    const data = JSON.parse(raw);
    return migrateProgress(data);
  } catch (e) {
    console.error('加载复习进度失败:', e);
    return createDefaultProgress();
  }
}

export function saveProgress(data) {
  try {
    data.lastSync = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error('保存复习进度失败:', e);
    return false;
  }
}

export function createDefaultProgress() {
  return {
    version: '1.0',
    lastSync: new Date().toISOString(),
    cards: {},
    settings: {
      dailyNewCardsLimit: 10,
      dailyReviewLimit: 50
    }
  };
}

function migrateProgress(data) {
  if (!data.version) data.version = '1.0';
  if (!data.cards) data.cards = {};
  if (!data.settings) data.settings = { dailyNewCardsLimit: 10, dailyReviewLimit: 50 };
  return data;
}

export function exportProgress() {
  const data = loadProgress();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kaoyan-review-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importProgress(file) {
  return new Promise((resolve, reject) => {
    // 限制导入文件大小 < 100KB
    if (file.size > 100 * 1024) {
      reject(new Error('导入文件过大，请检查文件内容'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data.cards || typeof data.cards !== 'object') {
          reject(new Error('无效的进度文件'));
          return;
        }
        // schema 校验
        if (data.version !== undefined && typeof data.version !== 'string') {
          reject(new Error('version 必须为字符串'));
          return;
        }
        if (data.settings) {
          const limit = parseInt(data.settings.dailyNewCardsLimit, 10);
          if (isNaN(limit) || limit < 1 || limit > 50) {
            reject(new Error('每日新卡上限必须为 1-50 的整数'));
            return;
          }
          const reviewLimit = parseInt(data.settings.dailyReviewLimit, 10);
          if (isNaN(reviewLimit) || reviewLimit < 1 || reviewLimit > 200) {
            reject(new Error('每日复习上限必须为 1-200 的整数'));
            return;
          }
        }
        // 卡片字段校验
        for (const [cardId, card] of Object.entries(data.cards)) {
          if (card.interval !== undefined && typeof card.interval !== 'number') {
            reject(new Error(`卡片 ${cardId} 的 interval 必须为数值`));
            return;
          }
          if (card.easeFactor !== undefined && typeof card.easeFactor !== 'number') {
            reject(new Error(`卡片 ${cardId} 的 easeFactor 必须为数值`));
            return;
          }
          if (card.repetitions !== undefined && typeof card.repetitions !== 'number') {
            reject(new Error(`卡片 ${cardId} 的 repetitions 必须为数值`));
            return;
          }
          if (card.dueDate !== undefined && isNaN(Date.parse(card.dueDate))) {
            reject(new Error(`卡片 ${cardId} 的 dueDate 必须为有效日期字符串`));
            return;
          }
        }
        const saved = saveProgress(data);
        if (!saved) {
          reject(new Error('保存失败，localStorage 可能已满，请导出并清理旧进度'));
          return;
        }
        resolve(data);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}
