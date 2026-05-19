// report.js
const { transactionsSheet, doc } = global;
const { Markup } = require('telegraf');
const { menuKeyboard } = require('./keyboards');
const { normWallet, walletCurrency, parseSheetNumber } = require('./utils');
const { normalizeCategory } = require('./categories');
const { categoryIcon, formatMoney } = require('./formatters');

const EXCLUDED_CATEGORIES = [
  'перевод',
  'корректировка остатка',
  'долг',
  'возврат долга',
  'обмен валюты'
];

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

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function startOfWeek(date) {
  const d = startOfDay(date);
  const day = d.getDay(); // 0 воскресенье, 1 понедельник
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function endOfWeek(date) {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 6);
  return endOfDay(d);
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function formatDate(date) {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function getPeriodRange(period = 'day') {
  const now = new Date();

  if (period === 'week') {
    const from = startOfWeek(now);
    const to = endOfWeek(now);

    return {
      from,
      to,
      title: `📊 Отчёт за неделю`,
      subtitle: `${formatDate(from)} — ${formatDate(to)}`
    };
  }

  if (period === 'month') {
    const from = startOfMonth(now);
    const to = endOfMonth(now);

    return {
      from,
      to,
      title: `📊 Отчёт за месяц`,
      subtitle: `${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`
    };
  }

  const from = startOfDay(now);
  const to = endOfDay(now);

  return {
    from,
    to,
    title: `📊 Отчёт за сегодня`,
    subtitle: formatDate(now)
  };
}

function isDateInRange(date, from, to) {
  return date && date >= from && date <= to;
}

function normalizeSubcategory(value, category) {
  const sub = String(value || '').trim().toLowerCase();
  return sub || category || 'прочее';
}

function shouldExclude(category, type) {
  const c = normalizeCategory(category);
  const t = String(type || '').trim().toLowerCase();

  if (t === 'перевод') return true;
  if (t === 'обмен') return true;
  if (EXCLUDED_CATEGORIES.includes(c)) return true;

  return false;
}

function ensureCurrencyBucket(target, currency) {
  if (!target[currency]) {
    target[currency] = {
      expenseTotal: 0,
      incomeTotal: 0,
      expenses: {},
      income: {}
    };
  }

  return target[currency];
}

function addGrouped(group, category, subcategory, amount) {
  if (!group[category]) {
    group[category] = {
      total: 0,
      subcategories: {}
    };
  }

  group[category].total += amount;

  if (!group[category].subcategories[subcategory]) {
    group[category].subcategories[subcategory] = 0;
  }

  group[category].subcategories[subcategory] += amount;
}

function formatSignedMoney(amount, currency) {
  if (amount > 0) return `+${formatMoney(amount, currency)}`;
  return formatMoney(amount, currency);
}

function formatCategoryBlock(group, currency) {
  const entries = Object.entries(group)
    .filter(([, data]) => Math.abs(data.total) > 0.009)
    .sort((a, b) => Math.abs(b[1].total) - Math.abs(a[1].total));

  if (entries.length === 0) {
    return 'нет\n';
  }

  let msg = '';

  entries.forEach(([category, data]) => {
    const icon = categoryIcon(category);
    msg += `${icon} <b>${category}</b>: ${formatMoney(Math.abs(data.total), currency)}\n`;

    const subs = Object.entries(data.subcategories)
      .filter(([, amount]) => Math.abs(amount) > 0.009)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

    subs.forEach(([subcategory, amount]) => {
      if (subcategory === category) return;
      msg += `  • ${subcategory}: ${formatMoney(Math.abs(amount), currency)}\n`;
    });
  });

  return msg;
}

function reportPeriodKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('Сегодня', 'report_day'),
      Markup.button.callback('Неделя', 'report_week'),
      Markup.button.callback('Месяц', 'report_month')
    ],
    [Markup.button.callback('Меню', 'menu')]
  ]);
}

async function buildReport(period = 'day') {
  await doc.loadInfo();

  const rows = await transactionsSheet.getRows();
  const { from, to, title, subtitle } = getPeriodRange(period);

  const buckets = {};

  rows.forEach(row => {
    const rawDate = row.get('Дата');
    const date = parseRuDate(rawDate);

    if (!isDateInRange(date, from, to)) return;

    const type = String(row.get('Тип') || '').trim().toLowerCase();
    const category = normalizeCategory(row.get('Категория'));
    const subcategory = normalizeSubcategory(row.get('Подкатегория'), category);
    const rawWallet = row.get('Кошелёк');
    const wallet = normWallet(rawWallet, rawWallet ? null : 'карта');

    if (!wallet) return;

    const amount = parseSheetNumber(row.get('Сумма'));

    if (shouldExclude(category, type)) return;
    if (amount === 0) return;

    const currency = walletCurrency(wallet);
    const bucket = ensureCurrencyBucket(buckets, currency);

    if (amount < 0) {
      const absAmount = Math.abs(amount);
      bucket.expenseTotal += absAmount;
      addGrouped(bucket.expenses, category, subcategory, absAmount);
    }

    if (amount > 0) {
      bucket.incomeTotal += amount;
      addGrouped(bucket.income, category, subcategory, amount);
    }
  });

  let msg = `<b>${title}</b>\n${subtitle}\n\n`;

  const currencyOrder = ['₽', '$', '€'];
  const currencies = Object.keys(buckets).sort((a, b) => {
    const ai = currencyOrder.indexOf(a);
    const bi = currencyOrder.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  if (currencies.length === 0) {
    msg += 'Операций за период нет.';
    return msg;
  }

  currencies.forEach(currency => {
    const bucket = buckets[currency];
    const diff = bucket.incomeTotal - bucket.expenseTotal;

    msg += `<b>${currency === '₽' ? '🇷🇺 Рубли' : `Валюта ${currency}`}</b>\n`;
    msg += `Расходы: ${formatMoney(bucket.expenseTotal, currency)}\n`;
    msg += `Доходы: ${formatMoney(bucket.incomeTotal, currency)}\n`;
    msg += `Разница: ${formatSignedMoney(diff, currency)}\n\n`;

    msg += `<b>Расходы по категориям:</b>\n`;
    msg += formatCategoryBlock(bucket.expenses, currency);

    if (bucket.incomeTotal > 0) {
      msg += `\n<b>Доходы по категориям:</b>\n`;
      msg += formatCategoryBlock(bucket.income, currency);
    }

    msg += '\n';
  });

  return msg.trim();
}

async function sendReportMenu(ctx) {
  try {
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery();
    }

    return ctx.reply('Какой отчёт показать?', reportPeriodKeyboard());
  } catch (error) {
    console.error('Ошибка меню отчётов:', error);
    return ctx.reply('Ошибка открытия меню отчётов ❌', menuKeyboard());
  }
}

async function sendPeriodReport(ctx, period) {
  try {
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery();
    }

    const msg = await buildReport(period);
    return ctx.replyWithHTML(msg, menuKeyboard());

  } catch (error) {
    console.error(`Ошибка отчёта ${period}:`, error);
    return ctx.reply('Ошибка формирования отчёта ❌', menuKeyboard());
  }
}

async function sendTodayReport(ctx) {
  return sendPeriodReport(ctx, 'day');
}

async function sendWeekReport(ctx) {
  return sendPeriodReport(ctx, 'week');
}

async function sendMonthReport(ctx) {
  return sendPeriodReport(ctx, 'month');
}

module.exports = {
  sendReportMenu,
  sendTodayReport,
  sendWeekReport,
  sendMonthReport,
  buildReport
};
