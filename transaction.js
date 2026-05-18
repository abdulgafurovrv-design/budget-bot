// transaction.js
const { Markup } = require('telegraf');
const { cancelLastKeyboard, mainKeyboard, menuKeyboard } = require('./keyboards');
const { normWallet, extractWallet, DEFAULT_WALLET } = require('./utils');
const { getBalance } = require('./balance');
const { handleDebtOperation, sendDebtors } = require('./debt');
const {
  normalizeCategory,
  getCategoryInfo,
  isKnownCategory,
  getCategoryList
} = require('./categories');
const { buildBudgetStatus } = require('./budgets');
const { categoryIcon, formatMoney } = require('./formatters');

const lastOperations = new Map();
global.lastOperations = lastOperations;

const pendingCategoryOperations = new Map();

function getCurrencyByWallet(wallet) {
  if (wallet === 'зарубежная_карта' || wallet === 'доллары') {
    return '$';
  }

  if (wallet === 'евро') {
    return '€';
  }

  return '₽';
}

function categorySelectKeyboard() {
  const categories = getCategoryList();

  const buttons = categories.map(category => {
    return Markup.button.callback(category, `catselect:${category}`);
  });

  const rows = [];

  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2));
  }

  rows.push([Markup.button.callback('Отменить', 'catselect_cancel')]);

  return Markup.inlineKeyboard(rows);
}

async function addTransaction(
  type,
  amount,
  category,
  subcategory = '',
  comment = '',
  wallet = DEFAULT_WALLET
) {
  try {
    const transactionsSheet = global.transactionsSheet;
    const doc = global.doc;

    if (!transactionsSheet || !doc) {
      console.error('transactionsSheet или doc не инициализированы');
      return { success: false, error: 'Таблицы не инициализированы' };
    }

    const date = new Date().toLocaleString('ru-RU');
    const sign = type === 'доход' ? amount : -amount;
    const normalizedWallet = normWallet(wallet);

    await doc.loadInfo();

    const rows = await transactionsSheet.getRows();

    let maxId = 0;

    rows.forEach(row => {
      const id = Number(row.get('ID')) || 0;

      if (id > maxId) {
        maxId = id;
      }
    });

    const id = maxId + 1;

    await transactionsSheet.addRow({
      ID: id,
      Дата: date,
      Тип: type,
      Сумма: sign,
      Категория: category,
      Подкатегория: subcategory || '',
      Комментарий: comment || '',
      Кошелёк: normalizedWallet
    });

    return { id, success: true };

  } catch (err) {
    console.error('Ошибка addTransaction:', err);
    return { success: false, error: 'Не удалось добавить запись' };
  }
}

function parseFreeInput(text) {
  const lower = text.toLowerCase();

  // === Дал в долг ===
  // Пример: дал Саша 500 #карта
  if (lower.startsWith('дал ') || lower.startsWith('выдал ')) {
    const parts = text.trim().split(/\s+/);

    if (parts.length < 3) {
      return null;
    }

    const debtor = parts[1]
      .charAt(0)
      .toUpperCase() + parts[1].slice(1).toLowerCase();

    const amount = Number(String(parts[2]).replace(',', '.'));
    const comment = parts.slice(3).join(' ');

    if (!amount || Number.isNaN(amount) || amount <= 0) {
      return null;
    }

    return {
      action: 'lend',
      debtor,
      amount,
      comment
    };
  }

  // === Вернули долг ===
  // Пример: вернули Саша 200 #карта
  if (lower.startsWith('вернули ') || lower.startsWith('вернул ')) {
    const parts = text.trim().split(/\s+/);

    if (parts.length < 3) {
      return null;
    }

    const debtor = parts[1]
      .charAt(0)
      .toUpperCase() + parts[1].slice(1).toLowerCase();

    const amount = Number(String(parts[2]).replace(',', '.'));
    const comment = parts.slice(3).join(' ');

    if (!amount || Number.isNaN(amount) || amount <= 0) {
      return null;
    }

    return {
      action: 'return_debt',
      debtor,
      amount,
      comment
    };
  }

  // === Начальный долг ===
  // Пример: добавить долг Саша 10000
  if (lower.startsWith('добавить долг ')) {
    const rest = text.slice('добавить долг '.length).trim();
    const words = rest.split(/\s+/);

    let amount = 0;
    let amountIndex = -1;

    for (let i = 0; i < words.length; i++) {
      const n = Number(String(words[i]).replace(',', '.'));

      if (!Number.isNaN(n) && n > 0) {
        amount = n;
        amountIndex = i;
        break;
      }
    }

    if (amountIndex === -1 || amount <= 0 || amountIndex === 0) {
      return null;
    }

    const debtor = words
      .slice(0, amountIndex)
      .join(' ')
      .trim()
      .toLowerCase()
      .replace(/^./, c => c.toUpperCase());

    const comment = words.slice(amountIndex + 1).join(' ');

    return {
      action: 'opening_debt',
      debtor,
      amount,
      comment
    };
  }

  // === Обычные расходы/доходы ===
  // Примеры:
  // кофе 250
  // 250 кофе #карта
  // кофе 250 #зарубежная_карта
  // +50000 зарплата
  const walletData = extractWallet(text);
  const wallet = normWallet(walletData.wallet || DEFAULT_WALLET);
  const cleaned = walletData.cleaned.trim();

  const words = cleaned.split(/\s+/);

  let amount = 0;
  let amountIndex = -1;

  for (let i = 0; i < words.length; i++) {
    const numStr = words[i].replace('+', '').replace(',', '.');
    const n = Number(numStr);

    if (!Number.isNaN(n) && n > 0) {
      amount = n;
      amountIndex = i;
      break;
    }
  }

  if (amountIndex === -1 || amount <= 0) {
    return null;
  }

  const hasIncomeKeyword = /зарплат|зп|аванс|премия|кешбэк|кэшбэк|подарок|возврат|доход/i.test(lower);
  const hasPlus = text.includes('+');

  const kind = hasPlus || hasIncomeKeyword ? 'доход' : 'расход';

  const categoryWords = [...words];
  categoryWords.splice(amountIndex, 1);

  const rawCategory = categoryWords.join(' ').trim() || 'прочее';

  const categoryInfo = getCategoryInfo(rawCategory);

  return {
    action: 'transaction',
    kind,
    amount,
    category: categoryInfo.category,
    subcategory: categoryInfo.subcategory,
    rawCategory,
    categoryKnown: categoryInfo.isKnown,
    wallet
  };
}

async function finishTransaction(ctx, parsed, categoryOverride = null) {
  let finalCategory = parsed.category;
  let finalSubcategory = parsed.subcategory;

  if (categoryOverride) {
    finalCategory = normalizeCategory(categoryOverride);
    finalSubcategory = parsed.rawCategory || finalCategory;
  }

  const result = await addTransaction(
    parsed.kind,
    parsed.amount,
    finalCategory,
    finalSubcategory,
    '',
    parsed.wallet
  );

  if (!result.success) {
    await ctx.reply('Ошибка операции ❌\nНе удалось добавить запись', mainKeyboard());
    return;
  }

  const kindText = parsed.kind === 'доход' ? 'доход' : 'расход';
  const balances = await getBalance();

  const walletBalance = balances[parsed.wallet] || 0;

  const totalMain =
    (balances.карта || 0) +
    (balances.наличка || 0) +
    (balances.депозит || 0) +
    (balances.долги || 0);

  const currency = getCurrencyByWallet(parsed.wallet);
  const icon = categoryIcon(finalCategory);

  let budgetText = '';

  if (parsed.kind === 'расход') {
    budgetText = await buildBudgetStatus(finalCategory, parsed.wallet);
  }

  const subcategoryText = finalSubcategory && finalSubcategory !== finalCategory
    ? `\nПодкатегория: ${finalSubcategory}`
    : '';

  const message =
    `Операция прошла успешно ✅\n\n` +
    `Добавлен ${kindText}: ${formatMoney(parsed.amount, currency)} — ${icon} ${finalCategory}` +
    subcategoryText + `\n` +
    `Кошелёк: #${parsed.wallet}\n\n` +
    `Текущий баланс кошелька: ${formatMoney(walletBalance, currency)}\n` +
    `Общий итог ₽: ${formatMoney(totalMain, '₽')}` +
    budgetText;

  lastOperations.set(ctx.chat.id, {
    type: 'trans',
    id: result.id
  });

  await ctx.replyWithHTML(message, cancelLastKeyboard());
}

async function handleCategorySelected(ctx) {
  try {
    await ctx.answerCbQuery();

    const chatId = ctx.chat.id;
    const pending = pendingCategoryOperations.get(chatId);

    if (!pending) {
      return ctx.reply('Нет операции, ожидающей выбора категории', menuKeyboard());
    }

    const data = ctx.callbackQuery.data;

    if (data === 'catselect_cancel') {
      pendingCategoryOperations.delete(chatId);
      return ctx.reply('Операция отменена', menuKeyboard());
    }

    const category = data.replace('catselect:', '');

    pendingCategoryOperations.delete(chatId);

    return finishTransaction(ctx, pending, category);

  } catch (error) {
    console.error('Ошибка выбора категории:', error);
    return ctx.reply('Ошибка выбора категории ❌', menuKeyboard());
  }
}

async function handleFreeInput(ctx) {
  const text = ctx.message.text.trim();

  if (/^долги$/i.test(text) || /^должники$/i.test(text)) {
    return sendDebtors(ctx);
  }

  const parsed = parseFreeInput(text);

  if (!parsed) {
    await ctx.reply(
      'Не понял ввод 😅\n\n' +
      'Примеры расходов и доходов:\n' +
      'кофе 250\n' +
      '250 кофе #карта\n' +
      '+50000 зарплата\n\n' +
      'Примеры долгов:\n' +
      'дал Саша 5000 #карта\n' +
      'вернули Саша 2000 #карта\n' +
      'добавить долг Саша 10000',
      mainKeyboard()
    );
    return;
  }

  if (parsed.action !== 'transaction') {
    return handleDebtOperation(ctx, parsed);
  }

  if (!parsed.categoryKnown) {
    pendingCategoryOperations.set(ctx.chat.id, {
      ...parsed,
      originalCategory: parsed.rawCategory
    });

    return ctx.reply(
      `Не нашёл категорию: "${parsed.rawCategory}"\n\n` +
      `Сумма: ${formatMoney(parsed.amount, getCurrencyByWallet(parsed.wallet))}\n` +
      `Кошелёк: #${parsed.wallet}\n\n` +
      `Выбери категорию из списка или отнеси в "прочее":`,
      categorySelectKeyboard()
    );
  }

  return finishTransaction(ctx, parsed);
}

module.exports = {
  handleFreeInput,
  handleCategorySelected,
  addTransaction,
  lastOperations
};
