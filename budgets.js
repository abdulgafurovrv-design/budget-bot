// budgets.js
const { menuKeyboard } = require('./keyboards');
const { normalizeCategory } = require('./categories');
const { walletCurrency } = require('./utils');

function getCurrentMonthKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function parseRuDate(value) {
  const str = String(value || '').trim();
  const match = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);

  if (!match) {
    const fallback = new Date(str);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }

  return new Date(
    Number(match[3]),
    Number(match[2]) - 1,
    Number(match[1])
  );
}

function isSameMonth(dateA, dateB) {
  return (
    dateA &&
    dateB &&
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth()
  );
}

async function getBudgetRows() {
  const budgetsSheet = global.budgetsSheet;

  if (!budgetsSheet) {
    return [];
  }

  return budgetsSheet.getRows();
}

async function getCategoryBudget(category, currency = '₽', monthKey = getCurrentMonthKey()) {
  const rows = await getBudgetRows();
  const normalizedCategory = normalizeCategory(category);

  const row = rows.find(r => {
    return (
      String(r.get('Месяц') || '').trim() === monthKey &&
      normalizeCategory(r.get('Категория')) === normalizedCategory &&
      String(r.get('Валюта') || '₽').trim() === currency
    );
  });

  if (!row) {
    return null;
  }

  return {
    month: monthKey,
    category: normalizedCategory,
    limit: Number(row.get('Лимит')) || 0,
    currency
  };
}

async function getCategorySpent(category, currency = '₽', monthDate = new Date()) {
  const transactionsSheet = global.transactionsSheet;
  const rows = await transactionsSheet.getRows();

  const normalizedCategory = normalizeCategory(category);

  let spent = 0;

  rows.forEach(row => {
    const date = parseRuDate(row.get('Дата'));
    if (!date || !isSameMonth(date, monthDate)) return;

    const type = String(row.get('Тип') || '').toLowerCase();
    const rowCategory = normalizeCategory(row.get('Категория'));
    const amount = Number(row.get('Сумма')) || 0;
    const wallet = row.get('Кошелёк') || 'карта';

    const rowCurrency = walletCurrency(wallet);

    if (rowCurrency !== currency) return;
    if (rowCategory !== normalizedCategory) return;
    if (type === 'перевод' || type === 'обмен') return;
    if (amount >= 0) return;

    spent += Math.abs(amount);
  });

  return spent;
}

async function buildBudgetStatus(category, wallet) {
  const currency = walletCurrency(wallet);
  const normalizedCategory = normalizeCategory(category);
  const budget = await getCategoryBudget(normalizedCategory, currency);

  if (!budget || !budget.limit) {
    return '';
  }

  const spent = await getCategorySpent(normalizedCategory, currency);
  const left = budget.limit - spent;

  let msg =
    `\n\n<b>Бюджет категории "${normalizedCategory}":</b>\n` +
    `Лимит: ${budget.limit.toFixed(2)} ${currency}\n` +
    `Потрачено: ${spent.toFixed(2)} ${currency}\n`;

  if (left >= 0) {
    msg += `Осталось: ${left.toFixed(2)} ${currency}`;
  } else {
    msg += `⚠️ Превышение: ${Math.abs(left).toFixed(2)} ${currency}`;
  }

  return msg;
}

async function handleSetBudget(ctx) {
  try {
    const text = ctx.message.text.trim();

    const match = text.match(/^\/?бюджет\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s*([$€₽])?$/i);

    if (!match) {
      return ctx.reply(
        'Формат:\n' +
        '/бюджет <категория> <лимит>\n\n' +
        'Примеры:\n' +
        '/бюджет кафе 15000\n' +
        '/бюджет продукты 60000\n' +
        '/бюджет такси 10000\n' +
        '/бюджет кафе 200 $',
        menuKeyboard()
      );
    }

    const category = normalizeCategory(match[1]);
    const limit = Number(String(match[2]).replace(',', '.'));
    const currency = match[3] || '₽';
    const monthKey = getCurrentMonthKey();

    if (!limit || Number.isNaN(limit) || limit <= 0) {
      return ctx.reply('Лимит должен быть больше 0', menuKeyboard());
    }

    const budgetsSheet = global.budgetsSheet;

    if (!budgetsSheet) {
      return ctx.reply('Лист Budgets не инициализирован', menuKeyboard());
    }

    const rows = await budgetsSheet.getRows();

    const existing = rows.find(r => {
      return (
        String(r.get('Месяц') || '').trim() === monthKey &&
        normalizeCategory(r.get('Категория')) === category &&
        String(r.get('Валюта') || '₽').trim() === currency
      );
    });

    if (existing) {
      existing.set('Лимит', limit);
      await existing.save();
    } else {
      await budgetsSheet.addRow({
        Месяц: monthKey,
        Категория: category,
        Лимит: limit,
        Валюта: currency
      });
    }

    return ctx.reply(
      `Бюджет сохранён ✅\n\n` +
      `Месяц: ${monthKey}\n` +
      `Категория: ${category}\n` +
      `Лимит: ${limit.toFixed(2)} ${currency}`,
      menuKeyboard()
    );

  } catch (error) {
    console.error('Ошибка установки бюджета:', error);
    return ctx.reply('Ошибка установки бюджета ❌', menuKeyboard());
  }
}

async function sendBudgets(ctx) {
  try {
    const monthKey = getCurrentMonthKey();
    const rows = await getBudgetRows();

    const current = rows.filter(r => {
      return String(r.get('Месяц') || '').trim() === monthKey;
    });

    if (current.length === 0) {
      return ctx.reply(
        `На ${monthKey} бюджеты ещё не заполнены.\n\n` +
        `Пример:\n/бюджет кафе 15000`,
        menuKeyboard()
      );
    }

    let msg = `<b>Бюджеты на ${monthKey}:</b>\n\n`;

    for (const row of current) {
      const category = normalizeCategory(row.get('Категория'));
      const limit = Number(row.get('Лимит')) || 0;
      const currency = String(row.get('Валюта') || '₽').trim();

      const spent = await getCategorySpent(category, currency);
      const left = limit - spent;

      msg += `• ${category}: ${spent.toFixed(2)} / ${limit.toFixed(2)} ${currency}`;

      if (left >= 0) {
        msg += `, осталось ${left.toFixed(2)} ${currency}\n`;
      } else {
        msg += `, превышение ${Math.abs(left).toFixed(2)} ${currency}\n`;
      }
    }

    return ctx.replyWithHTML(msg, menuKeyboard());

  } catch (error) {
    console.error('Ошибка вывода бюджетов:', error);
    return ctx.reply('Ошибка получения бюджетов ❌', menuKeyboard());
  }
}

module.exports = {
  getCurrentMonthKey,
  getCategoryBudget,
  getCategorySpent,
  buildBudgetStatus,
  handleSetBudget,
  sendBudgets
};
