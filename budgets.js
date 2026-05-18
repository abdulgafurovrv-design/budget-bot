// budgets.js
const { Markup } = require('telegraf');
const { menuKeyboard } = require('./keyboards');
const {
  normalizeCategory,
  getExpenseCategoryList,
  isIncomeCategory
} = require('./categories');
const { walletCurrency } = require('./utils');

const {
  categoryIcon,
  formatMoney,
  budgetStatusEmoji,
  progressBar
} = require('./formatters');

const pendingBudgetInputs = new Map();

function getCurrentMonthKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getPreviousMonthDate(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() - 1, 1);
}

function getMonthTitle(date = new Date()) {
  return `${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
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

function parseAmount(value) {
  return Number(String(value || '').replace(',', '.'));
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

  const limit = Number(row.get('Лимит')) || 0;

  if (limit <= 0) {
    return null;
  }

  return {
    month: monthKey,
    category: normalizedCategory,
    limit,
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
  const percent = budget.limit > 0 ? (spent / budget.limit) * 100 : 0;

  const icon = categoryIcon(normalizedCategory);
  const status = budgetStatusEmoji(percent);

  let msg =
    `\n\n${status} <b>Бюджет: ${icon} ${normalizedCategory}</b>\n` +
    `${progressBar(percent)}\n` +
    `Лимит: ${formatMoney(budget.limit, currency)}\n` +
    `Потрачено: ${formatMoney(spent, currency)}\n`;

  if (left >= 0) {
    msg += `Осталось: ${formatMoney(left, currency)}`;
  } else {
    msg += `Превышение: ${formatMoney(Math.abs(left), currency)}`;
  }

  return msg;
}

function budgetMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Добавить / изменить бюджет', 'budget_add')],
    [Markup.button.callback('Меню', 'menu')]
  ]);
}

function budgetCategoryKeyboard() {
  const categories = getExpenseCategoryList();

  const buttons = categories.map(category => {
    return Markup.button.callback(category, `budgetcat:${category}`);
  });

  const rows = [];

  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2));
  }

  rows.push([Markup.button.callback('Отмена', 'budget_cancel')]);

  return Markup.inlineKeyboard(rows);
}

async function saveBudget(category, limit, currency = '₽', monthKey = getCurrentMonthKey()) {
  const budgetsSheet = global.budgetsSheet;

  if (!budgetsSheet) {
    throw new Error('Лист Budgets не инициализирован');
  }

  const normalizedCategory = normalizeCategory(category);
  const rows = await budgetsSheet.getRows();

  const existing = rows.find(r => {
    return (
      String(r.get('Месяц') || '').trim() === monthKey &&
      normalizeCategory(r.get('Категория')) === normalizedCategory &&
      String(r.get('Валюта') || '₽').trim() === currency
    );
  });

  if (existing) {
    existing.set('Лимит', limit);
    await existing.save();
  } else {
    await budgetsSheet.addRow({
      Месяц: monthKey,
      Категория: normalizedCategory,
      Лимит: limit,
      Валюта: currency
    });
  }

  return {
    month: monthKey,
    category: normalizedCategory,
    limit,
    currency
  };
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

if (isIncomeCategory(category)) {
  return ctx.reply(
    `Категория "${category}" относится к доходам и не используется в бюджетах расходов.`,
    menuKeyboard()
  );
}

const limit = parseAmount(match[2]);
    const currency = match[3] || '₽';
    const monthKey = getCurrentMonthKey();

    if (!limit || Number.isNaN(limit) || limit <= 0) {
      return ctx.reply('Лимит должен быть больше 0', menuKeyboard());
    }

    const saved = await saveBudget(category, limit, currency, monthKey);

    return ctx.reply(
      `Бюджет сохранён ✅\n\n` +
      `Месяц: ${saved.month}\n` +
      `Категория: ${saved.category}\n` +
      `Лимит: ${formatMoney(saved.limit, saved.currency)}`,
      menuKeyboard()
    );

  } catch (error) {
    console.error('Ошибка установки бюджета:', error);
    return ctx.reply('Ошибка установки бюджета ❌', menuKeyboard());
  }
}

async function sendBudgets(ctx) {
  try {
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery();
    }

    const monthKey = getCurrentMonthKey();
    const rows = await getBudgetRows();

    const current = rows
      .filter(r => String(r.get('Месяц') || '').trim() === monthKey)
      .map(r => {
        const category = normalizeCategory(r.get('Категория'));

        return {
          category,
          limit: Number(r.get('Лимит')) || 0,
          currency: String(r.get('Валюта') || '₽').trim()
        };
      })
      .filter(r => {
        if (!r.category) return false;
        if (r.limit <= 0) return false;

        // Доходные категории не показываем в бюджетах расходов
        if (isIncomeCategory(r.category)) return false;

        return true;
      });

    if (current.length === 0) {
      return ctx.reply(
        `<b>Бюджеты на ${monthKey}</b>\n\n` +
        `На текущий месяц бюджеты ещё не заполнены.\n\n` +
        `Нажми кнопку ниже, чтобы добавить бюджет по категории.`,
        {
          parse_mode: 'HTML',
          reply_markup: budgetMenuKeyboard().reply_markup
        }
      );
    }

    const totalsByCurrency = {};

    let msg = `<b>Бюджеты на ${monthKey}</b>\n\n`;

    for (const item of current) {
      const spent = await getCategorySpent(item.category, item.currency);
      const left = item.limit - spent;

      if (!totalsByCurrency[item.currency]) {
        totalsByCurrency[item.currency] = 0;
      }

      totalsByCurrency[item.currency] += item.limit;

 const percent = item.limit > 0 ? (spent / item.limit) * 100 : 0;
const icon = categoryIcon(item.category);
const status = budgetStatusEmoji(percent);

msg += `${status} <b>${icon} ${item.category}</b>\n`;
msg += `${progressBar(percent)}\n`;
msg += `${formatMoney(spent, item.currency)} / ${formatMoney(item.limit, item.currency)}\n`;

if (left >= 0) {
  msg += `Осталось: ${formatMoney(left, item.currency)}\n\n`;
} else {
  msg += `Превышение: ${formatMoney(Math.abs(left), item.currency)}\n\n`;
}
    }

    msg += `\n<b>ИТОГО бюджет на месяц:</b>\n`;

    Object.entries(totalsByCurrency).forEach(([currency, total]) => {
      msg += `• ${formatMoney(total, currency)}\n`;
    });

    return ctx.replyWithHTML(msg, budgetMenuKeyboard());

  } catch (error) {
    console.error('Ошибка вывода бюджетов:', error);
    return ctx.reply('Ошибка получения бюджетов ❌', menuKeyboard());
  }
}

    msg += `\n<b>ИТОГО бюджет на месяц:</b>\n`;

    Object.entries(totalsByCurrency).forEach(([currency, total]) => {
      msg += `• ${formatMoney(total, currency)}\n`;
    });

    return ctx.replyWithHTML(msg, budgetMenuKeyboard());

  } catch (error) {
    console.error('Ошибка вывода бюджетов:', error);
    return ctx.reply('Ошибка получения бюджетов ❌', menuKeyboard());
  }
}

async function showBudgetCategories(ctx) {
  try {
    await ctx.answerCbQuery();

    return ctx.reply(
      'Выбери категорию, для которой нужно добавить или изменить бюджет:',
      budgetCategoryKeyboard()
    );

  } catch (error) {
    console.error('Ошибка вывода категорий бюджета:', error);
    return ctx.reply('Ошибка вывода категорий бюджета ❌', menuKeyboard());
  }
}

async function handleBudgetCategorySelected(ctx) {
  try {
    await ctx.answerCbQuery();

    const chatId = ctx.chat.id;
    const data = ctx.callbackQuery.data;

    const category = normalizeCategory(data.replace('budgetcat:', ''));
   if (isIncomeCategory(category)) {
  return ctx.reply(
    `Категория "${category}" относится к доходам и не используется в бюджетах расходов.`,
    menuKeyboard()
  );
}
    const prevMonthDate = getPreviousMonthDate();
    const prevSpent = await getCategorySpent(category, '₽', prevMonthDate);

    pendingBudgetInputs.set(chatId, {
      category,
      currency: '₽'
    });

    return ctx.reply(
      `Категория: ${category}\n\n` +
      `Траты за прошлый месяц (${getMonthTitle(prevMonthDate)}): ${formatMoney(prevSpent, '₽')}\n\n` +
      `Введи сумму бюджета на текущий месяц в рублях.\n\n` +
      `Пример:\n15000\n\n` +
      `Для отмены напиши: отмена`,
      menuKeyboard()
    );

  } catch (error) {
    console.error('Ошибка выбора категории бюджета:', error);
    return ctx.reply('Ошибка выбора категории бюджета ❌', menuKeyboard());
  }
}

async function handleBudgetCancel(ctx) {
  try {
    await ctx.answerCbQuery();
    pendingBudgetInputs.delete(ctx.chat.id);
    return ctx.reply('Добавление бюджета отменено', menuKeyboard());
  } catch (error) {
    console.error('Ошибка отмены бюджета:', error);
    return ctx.reply('Ошибка отмены бюджета ❌', menuKeyboard());
  }
}

async function handleBudgetAmountInput(ctx) {
  const chatId = ctx.chat.id;
  const pending = pendingBudgetInputs.get(chatId);

  if (!pending) {
    return false;
  }

  const text = ctx.message.text.trim();

  if (['отмена', 'отменить', 'назад', 'меню', '/cancel'].includes(text.toLowerCase())) {
    pendingBudgetInputs.delete(chatId);
    await ctx.reply('Добавление бюджета отменено', menuKeyboard());
    return true;
  }

  const amount = parseAmount(text);

  if (!amount || Number.isNaN(amount) || amount <= 0) {
    await ctx.reply(
      'Нужно ввести сумму бюджета числом.\n\n' +
      'Пример:\n15000\n\n' +
      'Для отмены напиши: отмена',
      menuKeyboard()
    );
    return true;
  }

  const saved = await saveBudget(
    pending.category,
    amount,
    pending.currency || '₽',
    getCurrentMonthKey()
  );

  pendingBudgetInputs.delete(chatId);

  const spent = await getCategorySpent(saved.category, saved.currency);
  const left = saved.limit - spent;

  let msg =
    `Бюджет сохранён ✅\n\n` +
    `Месяц: ${saved.month}\n` +
    `Категория: ${saved.category}\n` +
    `Лимит: ${formatMoney(saved.limit, saved.currency)}\n` +
    `Уже потрачено в этом месяце: ${formatMoney(spent, saved.currency)}\n`;

  if (left >= 0) {
    msg += `Осталось: ${formatMoney(left, saved.currency)}`;
  } else {
    msg += `⚠️ Уже превышено на: ${formatMoney(Math.abs(left), saved.currency)}`;
  }

  await ctx.reply(msg, menuKeyboard());
  return true;
}

module.exports = {
  getCurrentMonthKey,
  getCategoryBudget,
  getCategorySpent,
  buildBudgetStatus,
  handleSetBudget,
  sendBudgets,
  showBudgetCategories,
  handleBudgetCategorySelected,
  handleBudgetCancel,
  handleBudgetAmountInput
};
