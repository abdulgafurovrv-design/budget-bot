// formatters.js

const CATEGORY_ICONS = {
  кафе: '☕',
  продукты: '🛒',
  транспорт: '🚕',
  связь: '📱',
  здоровье: '💊',
  одежда: '👕',
  дом: '🏠',
  жилье: '🏘️',
  дети: '👶',
  спорт: '🏋️',
  алкоголь: '🍷',
  развлечения: '🎭',
  вредные_привычки: '🚬',
  подарки: '🎁',
  зарплата: '💼',
  кешбэк: '💸',
  прочее: '📦'
};

function categoryIcon(category) {
  return CATEGORY_ICONS[category] || '📌';
}

function formatNumber(value, decimals = 0) {
  const num = Number(value || 0);

  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(num);
}

function formatMoney(value, currency = '₽') {
  const num = Number(value || 0);

  const hasDecimals = Math.abs(num % 1) > 0.009;

  const formatted = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: hasDecimals ? 2 : 0
  }).format(num);

  return `${formatted} ${currency}`;
}

function budgetStatusEmoji(percent) {
  if (percent >= 100) return '🚨';
  if (percent >= 90) return '🔴';
  if (percent >= 70) return '🟡';
  return '🟢';
}

function progressBar(percent) {
  const totalBlocks = 10;
  const safePercent = Math.max(0, Number(percent || 0));
  const filledBlocks = Math.min(totalBlocks, Math.round((safePercent / 100) * totalBlocks));
  const emptyBlocks = totalBlocks - filledBlocks;

  let filledSymbol = '🟩';

  if (safePercent >= 100) {
    filledSymbol = '🟥';
  } else if (safePercent >= 90) {
    filledSymbol = '🟥';
  } else if (safePercent >= 70) {
    filledSymbol = '🟨';
  }

  return `${filledSymbol.repeat(filledBlocks)}${'⬜'.repeat(emptyBlocks)} ${Math.round(safePercent)}%`;
}

module.exports = {
  CATEGORY_ICONS,
  categoryIcon,
  formatNumber,
  formatMoney,
  budgetStatusEmoji,
  progressBar
};
