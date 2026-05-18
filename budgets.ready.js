// budgets.js
const { Markup } = require('telegraf');
const { menuKeyboard } = require('./keyboards');
const {
  normalizeCategory,
  getExpenseCategoryList,
  getIncomeCategoryList,
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

function clearPendingBudgetInput(chatId) {
  pendingBudgetInputs.delete(chatId);
}

function getMonthKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getCurrentMonthKey(date = new Date()) {
  return getMonthKey(date);
}

function getNextMonthDate(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

function getNextMonthKey(date = new Date()) {
  return getMonthKey(getNextMonthDate(date));
}

function getPreviousMonthDate(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() - 1, 1);
}

function getDateFromMonthKey(monthKey) {
  const match = String(monthKey || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return new Date();
  return new Date(Number(match[1]), Number(match[2]) - 1, 1);
}

function getMonthTitle(dateOrMonthKey = new Date()) {
  const date = typeof dateOrMonthKey === 'string'
    ? getDateFromMonthKey(dateOrMonthKey)
    : dateOrMonthKey;

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

function normalizeBudgetType(value) {
  const raw = String(value || '').trim().toLowerCase();

  if (['доход', 'доходы', 'income', 'in'].includes(raw)) {
    return 'доход';
  }

  return 'расход';
}

function parseMonthToken(value) {
  const raw = String(value || '').trim().toLowerCase();

  if (['след', 'следующий', 'следующая', 'next'].includes(raw)) {
    return getNextMonthKey();
  }

  if (/^\d{4}-\d{2}$/.test(raw)) {
    return raw;
  }

  return null;
}

async function getBudgetRows() {
  const budgetsSheet = global.budgetsSheet;

  if (!budgetsSheet) {
    return [];
  }

  return budgetsSheet.getRows();
}

function isValidCategoryForBudgetType(category, budgetType) {
  const normalizedCategory = normalizeCategory(category);
  const normalizedType = normalizeBudgetType(budgetType);

  if (normalizedType === 'доход') {
    return isIncomeCategory(normalizedCategory);
  }

  return !isIncomeCategory(normalizedCategory);
}

function getCategoriesForBudgetType(budgetType) {
  const normalizedType = normalizeBudgetType(budgetType);

  if (normalizedType === 'доход') {
    return getIncomeCategoryList();
  }

  return getExpenseCategoryList();
}

async function getCategoryBudget(
  category,
  currency = '₽',
  monthKey = getCurrentMonthKey(),
  budgetType = 'расход'
) {
  const rows = await getBudgetRows();
  const normalizedCategory = normalizeCategory(category);
  const normalizedType = normalizeBudgetType(budgetType);

  if (!isValidCategoryForBudgetType(normalizedCategory, normalizedType)) {
    return null;
  }

  const row = rows.find(r => {
    const rowType = normalizeBudgetType(r.get('Тип') || 'расход');

    return (
      String(r.get('Месяц') || '').trim() === monthKey &&
      rowType === normalizedType &&
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
    type: normalizedType,
    category: normalizedCategory,
    limit,
    currency
  };
}

async function getCategorySpent(
  category,
  currency = '₽',
  monthDate = new Date(),
  budgetType = 'расход'
) {
  const transactionsSheet = global.transactionsSheet;

  if (!transactionsSheet) {
    return 0;
  }

  const rows = await transactionsSheet.getRows();
  const normalizedCategory = normalizeCategory(category);
  const normalizedType = normalizeBudgetType(budgetType);

  let total = 0;

  rows.forEach(row => {
    const date = parseRuDate(row.get('Дата'));

    if (!date || !isSameMonth(date, monthDate)) {
      return;
    }

    const type = String(row.get('Тип') || '').toLowerCase();
    const rowCategory = normalizeCategory(row.get('Категория'));
    const amount = Number(row.get('Сумма')) || 0;
    const wallet = row.get('Кошелёк') || 'карта';
    const rowCurrency = walletCurrency(wallet);

    if (rowCurrency !== currency) return;
    if (rowCategory !== normalizedCategory) return;
    if (type === 'перевод' || type === 'обмен') return;
    if (rowCategory === 'долг' || rowCategory === 'возврат долга') return;
    if (rowCategory === 'корректировка остатка') return;

    if (normalizedType === 'расход') {
      if (amount >= 0) return;
      total += Math.abs(amount);
      return;
    }

    if (normalizedType === 'доход') {
      if (amount <= 0) return;
      total += amount;
    }
  });

  return total;
}

async function buildBudgetStatus(category, wallet) {
  const currency = walletCurrency(wallet);
  const normalizedCategory = normalizeCategory(category);

  if (isIncomeCategory(normalizedCategory)) {
    return '';
  }

  const budget = await getCategoryBudget(
    normalizedCategory,
    currency,
    getCurrentMonthKey(),
    'расход'
  );

  if (!budget || !budget.limit) {
    return '';
  }

  const spent = await getCategorySpent(
    normalizedCategory,
    currency,
    new Date(),
    'расход'
  );

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
    [
      Markup.button.callback('Текущий месяц', 'budget_view_current'),
      Markup.button.callback('Следующий месяц', 'budget_view_next')
    ],
    [Markup.button.callback('Добавить / изменить бюджет', 'budget_add')],
    [Markup.button.callback('Меню', 'menu')]
  ]);
}

function budgetPeriodKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('Текущий месяц', 'budget_period:current'),
      Markup.button.callback('Следующий месяц', 'budget_period:next')
    ],
    [Markup.button.callback('Отмена', 'budget_cancel')]
  ]);
}

function budgetTypeKeyboard(monthKey) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('Расходы', `budget_type:${monthKey}:expense`),
      Markup.button.callback('Доходы', `budget_type:${monthKey}:income`)
    ],
    [Markup.button.callback('Отмена', 'budget_cancel')]
  ]);
}

function budgetCategoryKeyboard(monthKey, budgetType) {
  const type = normalizeBudgetType(budgetType);
  const categories = getCategoriesForBudgetType(type);

  const buttons = categories.map(category => {
    return Markup.button.callback(category, `budgetcat:${monthKey}:${type}:${category}`);
  });

  const rows = [];

  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2));
  }

  rows.push([Markup.button.callback('Отмена', 'budget_cancel')]);

  return Markup.inlineKeyboard(rows);
}

async function saveBudget(
  category,
  limit,
  currency = '₽',
  monthKey = getCurrentMonthKey(),
  budgetType = 'расход'
) {
  const budgetsSheet = global.budgetsSheet;

  if (!budgetsSheet) {
    throw new Error('Лист Budgets не инициализирован');
  }

  const normalizedCategory = normalizeCategory(category);
  const normalizedType = normalizeBudgetType(budgetType);

  if (!isValidCategoryForBudgetType(normalizedCategory, normalizedType)) {
    if (normalizedType === 'расход' && isIncomeCategory(normalizedCategory)) {
      throw new Error(
        `Категория "${normalizedCategory}" относится к доходам. Используй: /бюджет доход ${normalizedCategory} ${limit}`
      );
    }

    throw new Error(`Категория "${normalizedCategory}" не подходит для бюджета типа "${normalizedType}"`);
  }

  const rows = await budgetsSheet.getRows();

  const existing = rows.find(r => {
    const rowType = normalizeBudgetType(r.get('Тип') || 'расход');

    return (
      String(r.get('Месяц') || '').trim() === monthKey &&
      rowType === normalizedType &&
      normalizeCategory(r.get('Категория')) === normalizedCategory &&
      String(r.get('Валюта') || '₽').trim() === currency
    );
  });

  if (existing) {
    existing.set('Тип', normalizedType);
    existing.set('Лимит', limit);
    await existing.save();
  } else {
    await budgetsSheet.addRow({
      Месяц: monthKey,
      Тип: normalizedType,
      Категория: normalizedCategory,
      Лимит: limit,
      Валюта: currency
    });
  }

  return {
    month: monthKey,
    type: normalizedType,
    category: normalizedCategory,
    limit,
    currency
  };
}

function parseBudgetCommand(text) {
  const match = String(text || '').trim().match(/^\/?бюджет\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s*([$€₽])?$/i);

  if (!match) {
    return null;
  }

  let left = String(match[1] || '').trim();
  const amount = parseAmount(match[2]);
  const currency = match[3] || '₽';

  let monthKey = getCurrentMonthKey();
  let budgetType = 'расход';

  const parts = left.split(/\s+/);

  if (parts.length > 0) {
    const maybeMonth = parseMonthToken(parts[0]);

    if (maybeMonth) {
      monthKey = maybeMonth;
      parts.shift();
      left = parts.join(' ');
    }
  }

  const typeMatch = left.match(/^(доход|доходы|расход|расходы)\s+(.+)$/i);

  if (typeMatch) {
    budgetType = normalizeBudgetType(typeMatch[1]);
    left = typeMatch[2].trim();
  }

  const category = normalizeCategory(left);

  return {
    monthKey,
    budgetType,
    category,
    amount,
    currency,
    rawAmount: match[2]
  };
}

async function handleSetBudget(ctx) {
  try {
    const parsed = parseBudgetCommand(ctx.message.text);

    if (!parsed) {
      return ctx.reply(
        'Формат:\n' +
        '/бюджет <категория> <лимит>\n' +
        '/бюджет доход <категория> <лимит>\n' +
        '/бюджет след <категория> <лимит>\n' +
        '/бюджет след доход <категория> <лимит>\n\n' +
        'Примеры:\n' +
        '/бюджет кафе 15000\n' +
        '/бюджет хоз_нужды 10000\n' +
        '/бюджет доход зарплата 550000\n' +
        '/бюджет след продукты 60000\n' +
        '/бюджет след доход зарплата 600000',
        menuKeyboard()
      );
    }

    if (parsed.budgetType === 'расход' && isIncomeCategory(parsed.category)) {
      return ctx.reply(
        `Категория "${parsed.category}" относится к доходам.\n\n` +
        `Используй:\n/бюджет доход ${parsed.category} ${parsed.rawAmount}`,
        menuKeyboard()
      );
    }

    if (parsed.budgetType === 'доход' && !isIncomeCategory(parsed.category)) {
      return ctx.reply(
        `Категория "${parsed.category}" не относится к доходам.\n\n` +
        `Для расходов используй:\n/бюджет ${parsed.category} ${parsed.rawAmount}`,
        menuKeyboard()
      );
    }

    if (!parsed.amount || Number.isNaN(parsed.amount) || parsed.amount <= 0) {
      return ctx.reply('Лимит должен быть больше 0', menuKeyboard());
    }

    const saved = await saveBudget(
      parsed.category,
      parsed.amount,
      parsed.currency,
      parsed.monthKey,
      parsed.budgetType
    );

    return ctx.reply(
      `Бюджет сохранён ✅\n\n` +
      `Месяц: ${saved.month}\n` +
      `Тип: ${saved.type}\n` +
      `Категория: ${categoryIcon(saved.category)} ${saved.category}\n` +
      `Лимит: ${formatMoney(saved.limit, saved.currency)}`,
      menuKeyboard()
    );

  } catch (error) {
    console.error('Ошибка установки бюджета:', error);
    return ctx.reply(
      `Ошибка установки бюджета ❌\n\n${error.message || ''}`,
      menuKeyboard()
    );
  }
}

function formatBudgetLine({ item, actual, left }) {
  const percent = item.limit > 0 ? (actual / item.limit) * 100 : 0;
  const icon = categoryIcon(item.category);
  const status = budgetStatusEmoji(percent);

  let msg = `${status} <b>${icon} ${item.category}</b>\n`;
  msg += `${progressBar(percent)}\n`;
  msg += `${formatMoney(actual, item.currency)} / ${formatMoney(item.limit, item.currency)}\n`;

  if (item.type === 'доход') {
    if (left >= 0) {
      msg += `Осталось получить: ${formatMoney(left, item.currency)}\n\n`;
    } else {
      msg += `План перевыполнен на: ${formatMoney(Math.abs(left), item.currency)}\n\n`;
    }

    return msg;
  }

  if (left >= 0) {
    msg += `Осталось: ${formatMoney(left, item.currency)}\n\n`;
  } else {
    msg += `Превышение: ${formatMoney(Math.abs(left), item.currency)}\n\n`;
  }

  return msg;
}

function getRequestedBudgetMonthFromContext(ctx) {
  const data = ctx.callbackQuery?.data || '';
  const text = ctx.message?.text || '';

  if (data === 'budget_view_next') {
    return getNextMonthKey();
  }

  if (data === 'budget_view_current') {
    return getCurrentMonthKey();
  }

  if (/^(\/?)(бюджеты|лимиты)\s+(след|следующий|next)$/i.test(text.trim())) {
    return getNextMonthKey();
  }

  return getCurrentMonthKey();
}

async function sendBudgets(ctx) {
  try {
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery();
    }

    const monthKey = getRequestedBudgetMonthFromContext(ctx);
    const rows = await getBudgetRows();
    const monthDate = getDateFromMonthKey(monthKey);

    const current = rows
      .filter(r => String(r.get('Месяц') || '').trim() === monthKey)
      .map(r => {
        const type = normalizeBudgetType(r.get('Тип') || 'расход');
        const category = normalizeCategory(r.get('Категория'));

        return {
          type,
          category,
          limit: Number(r.get('Лимит')) || 0,
          currency: String(r.get('Валюта') || '₽').trim()
        };
      })
      .filter(r => {
        if (!r.category) return false;
        if (r.limit <= 0) return false;
        if (!isValidCategoryForBudgetType(r.category, r.type)) return false;
        return true;
      });

    if (current.length === 0) {
      return ctx.reply(
        `<b>Бюджеты на ${monthKey}</b>\n\n` +
        `На выбранный месяц бюджеты ещё не заполнены.\n\n` +
        `Расходный бюджет:\n/бюджет ${monthKey === getNextMonthKey() ? 'след ' : ''}кафе 15000\n\n` +
        `Доходный бюджет:\n/бюджет ${monthKey === getNextMonthKey() ? 'след ' : ''}доход зарплата 550000`,
        {
          parse_mode: 'HTML',
          reply_markup: budgetMenuKeyboard().reply_markup
        }
      );
    }

    const expenseItems = current.filter(item => item.type === 'расход');
    const incomeItems = current.filter(item => item.type === 'доход');

    const expenseTotalsByCurrency = {};
    const incomeTotalsByCurrency = {};

    let msg = `<b>📊 Бюджеты на ${monthKey}</b>\n\n`;

    if (expenseItems.length > 0) {
      msg += `<b>Расходы:</b>\n\n`;

      for (const item of expenseItems) {
        const actual = await getCategorySpent(
          item.category,
          item.currency,
          monthDate,
          'расход'
        );

        const left = item.limit - actual;

        if (!expenseTotalsByCurrency[item.currency]) {
          expenseTotalsByCurrency[item.currency] = 0;
        }

        expenseTotalsByCurrency[item.currency] += item.limit;

        msg += formatBudgetLine({ item, actual, left });
      }
    }

    if (incomeItems.length > 0) {
      msg += `<b>Доходы:</b>\n\n`;

      for (const item of incomeItems) {
        const actual = await getCategorySpent(
          item.category,
          item.currency,
          monthDate,
          'доход'
        );

        const left = item.limit - actual;

        if (!incomeTotalsByCurrency[item.currency]) {
          incomeTotalsByCurrency[item.currency] = 0;
        }

        incomeTotalsByCurrency[item.currency] += item.limit;

        msg += formatBudgetLine({ item, actual, left });
      }
    }

    if (Object.keys(expenseTotalsByCurrency).length > 0) {
      msg += `<b>ИТОГО бюджет расходов:</b>\n`;

      Object.entries(expenseTotalsByCurrency).forEach(([currency, total]) => {
        msg += `• ${formatMoney(total, currency)}\n`;
      });

      msg += '\n';
    }

    if (Object.keys(incomeTotalsByCurrency).length > 0) {
      msg += `<b>ИТОГО план доходов:</b>\n`;

      Object.entries(incomeTotalsByCurrency).forEach(([currency, total]) => {
        msg += `• ${formatMoney(total, currency)}\n`;
      });

      msg += '\n';
    }

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
      'Выбери месяц, для которого нужно добавить или изменить бюджет:',
      budgetPeriodKeyboard()
    );

  } catch (error) {
    console.error('Ошибка вывода периода бюджета:', error);
    return ctx.reply('Ошибка вывода периода бюджета ❌', menuKeyboard());
  }
}

async function handleBudgetPeriodSelected(ctx) {
  try {
    await ctx.answerCbQuery();

    const data = ctx.callbackQuery.data;
    const period = data.replace('budget_period:', '');
    const monthKey = period === 'next' ? getNextMonthKey() : getCurrentMonthKey();

    return ctx.reply(
      `Месяц бюджета: ${monthKey}\n\n` +
      `Выбери тип бюджета:`,
      budgetTypeKeyboard(monthKey)
    );

  } catch (error) {
    console.error('Ошибка выбора периода бюджета:', error);
    return ctx.reply('Ошибка выбора периода бюджета ❌', menuKeyboard());
  }
}

async function handleBudgetTypeSelected(ctx) {
  try {
    await ctx.answerCbQuery();

    const data = ctx.callbackQuery.data;
    const [, monthKey, typeRaw] = data.split(':');
    const budgetType = typeRaw === 'income' ? 'доход' : 'расход';

    return ctx.reply(
      `Месяц бюджета: ${monthKey}\n` +
      `Тип: ${budgetType}\n\n` +
      `Выбери категорию:`,
      budgetCategoryKeyboard(monthKey, budgetType)
    );

  } catch (error) {
    console.error('Ошибка выбора типа бюджета:', error);
    return ctx.reply('Ошибка выбора типа бюджета ❌', menuKeyboard());
  }
}

async function handleBudgetCategorySelected(ctx) {
  try {
    await ctx.answerCbQuery();

    const chatId = ctx.chat.id;
    const data = ctx.callbackQuery.data;
    const [, monthKey, budgetTypeRaw, rawCategory] = data.split(':');

    const budgetType = normalizeBudgetType(budgetTypeRaw);
    const category = normalizeCategory(rawCategory);

    if (!isValidCategoryForBudgetType(category, budgetType)) {
      return ctx.reply(
        `Категория "${category}" не подходит для бюджета типа "${budgetType}".`,
        menuKeyboard()
      );
    }

    const prevMonthDate = getPreviousMonthDate();
    const currentMonthDate = new Date();

    const prevActual = await getCategorySpent(category, '₽', prevMonthDate, budgetType);
    const currentActual = await getCategorySpent(category, '₽', currentMonthDate, budgetType);

    pendingBudgetInputs.set(chatId, {
      type: budgetType,
      monthKey,
      category,
      currency: '₽'
    });

    const factWord = budgetType === 'доход' ? 'получено' : 'потрачено';
    const requestWord = budgetType === 'доход' ? 'плана доходов' : 'бюджета расходов';

    return ctx.reply(
      `Категория: ${categoryIcon(category)} ${category}\n` +
      `Тип: ${budgetType}\n` +
      `Месяц бюджета: ${monthKey}\n\n` +
      `За прошлый месяц (${getMonthTitle(prevMonthDate)}) ${factWord}: ${formatMoney(prevActual, '₽')}\n` +
      `За текущий месяц (${getMonthTitle(currentMonthDate)}) ${factWord}: ${formatMoney(currentActual, '₽')}\n\n` +
      `Введи сумму ${requestWord} на ${monthKey} в рублях.\n\n` +
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
    pending.monthKey || getCurrentMonthKey(),
    pending.type || 'расход'
  );

  pendingBudgetInputs.delete(chatId);

  const actual = await getCategorySpent(
    saved.category,
    saved.currency,
    getDateFromMonthKey(saved.month),
    saved.type
  );

  const left = saved.limit - actual;
  const percent = saved.limit > 0 ? (actual / saved.limit) * 100 : 0;

  let msg =
    `Бюджет сохранён ✅\n\n` +
    `${categoryIcon(saved.category)} Категория: ${saved.category}\n` +
    `Тип: ${saved.type}\n` +
    `Месяц: ${saved.month}\n` +
    `Лимит: ${formatMoney(saved.limit, saved.currency)}\n\n` +
    `${progressBar(percent)}\n`;

  if (saved.type === 'доход') {
    msg += `Уже получено за месяц бюджета: ${formatMoney(actual, saved.currency)}\n`;

    if (left >= 0) {
      msg += `Осталось получить: ${formatMoney(left, saved.currency)}`;
    } else {
      msg += `План перевыполнен на: ${formatMoney(Math.abs(left), saved.currency)}`;
    }
  } else {
    msg += `Уже потрачено за месяц бюджета: ${formatMoney(actual, saved.currency)}\n`;

    if (left >= 0) {
      msg += `Осталось: ${formatMoney(left, saved.currency)}`;
    } else {
      msg += `⚠️ Уже превышено на: ${formatMoney(Math.abs(left), saved.currency)}`;
    }
  }

  await ctx.reply(msg, menuKeyboard());
  return true;
}

async function hasBudgetsForMonth(monthKey) {
  const rows = await getBudgetRows();

  return rows.some(row => {
    return (
      String(row.get('Месяц') || '').trim() === monthKey &&
      Number(row.get('Лимит')) > 0
    );
  });
}

async function buildBudgetReminderMessage(monthKey, reminderType = 'current_missing') {
  if (reminderType === 'next_missing') {
    return (
      `📌 Через 2 дня новый месяц\n\n` +
      `Бюджет на ${monthKey} ещё не заполнен.\n\n` +
      `Рекомендуется заранее внести:\n` +
      `• лимиты расходов\n` +
      `• план доходов\n\n` +
      `Примеры:\n` +
      `/бюджет след продукты 60000\n` +
      `/бюджет след доход зарплата 600000`
    );
  }

  return (
    `⚠️ Бюджет на текущий месяц не заполнен\n\n` +
    `Месяц: ${monthKey}\n\n` +
    `Заполни бюджеты по расходам и доходам.\n\n` +
    `Примеры:\n` +
    `/бюджет продукты 60000\n` +
    `/бюджет доход зарплата 550000`
  );
}

module.exports = {
  getCurrentMonthKey,
  getNextMonthKey,
  getCategoryBudget,
  getCategorySpent,
  buildBudgetStatus,
  handleSetBudget,
  sendBudgets,
  showBudgetCategories,
  handleBudgetPeriodSelected,
  handleBudgetTypeSelected,
  handleBudgetCategorySelected,
  handleBudgetCancel,
  handleBudgetAmountInput,
  hasBudgetsForMonth,
  buildBudgetReminderMessage,
  clearPendingBudgetInput
};
