// report.js
const { transactionsSheet, doc } = global;
const { menuKeyboard } = require('./keyboards');
const { normWallet, walletCurrency, parseSheetNumber } = require('./utils');

const EXCLUDED_CATEGORIES = [
  'перевод',
  'корректировка остатка',
  'долг',
  'возврат долга'
];

function parseRuDate(value) {
  const str = String(value || '').trim();

  // Обычно дата приходит как: 15.05.2026, 11:08:20
  // или: 15.05.2026 11:08:20
  const match = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);

  if (!match) {
    const fallback = new Date(str);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }

  const day = Number(match[1]);
  const month = Number(match[2]) - 1;
  const year = Number(match[3]);

  return new Date(year, month, day);
}

function isSameDay(dateA, dateB) {
  return (
    dateA &&
    dateB &&
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
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

function normalizeCategory(category) {
  return String(category || 'разное')
    .trim()
    .toLowerCase();
}

function shouldExclude(category, type) {
  const c = normalizeCategory(category);
  const t = String(type || '').trim().toLowerCase();

  if (t === 'перевод') return true;
  if (EXCLUDED_CATEGORIES.includes(c)) return true;

  return false;
}

function addToGroup(target, key, amount) {
  if (!target[key]) {
    target[key] = 0;
  }

  target[key] += amount;
}

function formatMoney(amount, currency = '₽') {
  return `${amount.toFixed(2)} ${currency}`;
}

function formatGroup(title, group, currency = '₽') {
  const entries = Object.entries(group)
    .filter(([, amount]) => Math.abs(amount) > 0.009)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

  if (entries.length === 0) {
    return `<b>${title}:</b>\nнет\n`;
  }

  let msg = `<b>${title}:</b>\n`;

  entries.forEach(([name, amount]) => {
    msg += `• ${name}: ${formatMoney(Math.abs(amount), currency)}\n`;
  });

  return msg;
}

async function buildReport(period = 'day') {
  await doc.loadInfo();

  const rows = await transactionsSheet.getRows();
  const now = new Date();

  const expensesRub = {};
  const incomeRub = {};

  const expensesUsd = {};
  const incomeUsd = {};

  const expensesEur = {};
  const incomeEur = {};

  let totalExpenseRub = 0;
  let totalIncomeRub = 0;

  let totalExpenseUsd = 0;
  let totalIncomeUsd = 0;

  let totalExpenseEur = 0;
  let totalIncomeEur = 0;

  rows.forEach(row => {
    const rawDate = row.get('Дата');
    const date = parseRuDate(rawDate);

    if (!date) return;

    const inPeriod = period === 'month'
      ? isSameMonth(date, now)
      : isSameDay(date, now);

    if (!inPeriod) return;

    const type = String(row.get('Тип') || '').trim().toLowerCase();
    const category = normalizeCategory(row.get('Категория'));
    const rawWallet = row.get('Кошелёк');
    const wallet = normWallet(rawWallet, rawWallet ? null : 'карта');

    if (!wallet) return;

    const amount = parseSheetNumber(row.get('Сумма'));

    if (shouldExclude(category, type)) return;
    if (amount === 0) return;

    const currency = walletCurrency(wallet);

    if (amount < 0) {
      if (currency === '$') {
        addToGroup(expensesUsd, category, amount);
        totalExpenseUsd += Math.abs(amount);
      } else if (currency === '€') {
        addToGroup(expensesEur, category, amount);
        totalExpenseEur += Math.abs(amount);
      } else {
        addToGroup(expensesRub, category, amount);
        totalExpenseRub += Math.abs(amount);
      }
    }

    if (amount > 0) {
      if (currency === '$') {
        addToGroup(incomeUsd, category, amount);
        totalIncomeUsd += amount;
      } else if (currency === '€') {
        addToGroup(incomeEur, category, amount);
        totalIncomeEur += amount;
      } else {
        addToGroup(incomeRub, category, amount);
        totalIncomeRub += amount;
      }
    }
  });

  const title = period === 'month'
    ? 'Отчёт за текущий месяц'
    : 'Отчёт за сегодня';

  let msg = `<b>${title}</b>\n\n`;

  msg += `<b>Расходы ₽:</b> ${formatMoney(totalExpenseRub, '₽')}\n`;
  msg += formatGroup('По категориям ₽', expensesRub, '₽');

  if (totalIncomeRub > 0) {
    msg += `\n<b>Доходы ₽:</b> ${formatMoney(totalIncomeRub, '₽')}\n`;
    msg += formatGroup('Доходы по категориям ₽', incomeRub, '₽');
  }

  if (totalExpenseUsd > 0 || totalIncomeUsd > 0) {
    msg += `\n<b>Валюта $:</b>\n`;

    if (totalExpenseUsd > 0) {
      msg += `Расходы: ${formatMoney(totalExpenseUsd, '$')}\n`;
      msg += formatGroup('По категориям $', expensesUsd, '$');
    }

    if (totalIncomeUsd > 0) {
      msg += `\nДоходы: ${formatMoney(totalIncomeUsd, '$')}\n`;
      msg += formatGroup('Доходы по категориям $', incomeUsd, '$');
    }
  }

  if (totalExpenseEur > 0 || totalIncomeEur > 0) {
    msg += `\n<b>Валюта €:</b>\n`;

    if (totalExpenseEur > 0) {
      msg += `Расходы: ${formatMoney(totalExpenseEur, '€')}\n`;
      msg += formatGroup('По категориям €', expensesEur, '€');
    }

    if (totalIncomeEur > 0) {
      msg += `\nДоходы: ${formatMoney(totalIncomeEur, '€')}\n`;
      msg += formatGroup('Доходы по категориям €', incomeEur, '€');
    }
  }

  return msg;
}

async function sendTodayReport(ctx) {
  try {
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery();
    }

    const msg = await buildReport('day');
    return ctx.replyWithHTML(msg, menuKeyboard());

  } catch (error) {
    console.error('Ошибка отчёта за день:', error);
    return ctx.reply('Ошибка формирования отчёта за день ❌', menuKeyboard());
  }
}

async function sendMonthReport(ctx) {
  try {
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery();
    }

    const msg = await buildReport('month');
    return ctx.replyWithHTML(msg, menuKeyboard());

  } catch (error) {
    console.error('Ошибка отчёта за месяц:', error);
    return ctx.reply('Ошибка формирования отчёта за месяц ❌', menuKeyboard());
  }
}

module.exports = {
  sendTodayReport,
  sendMonthReport,
  buildReport
};
