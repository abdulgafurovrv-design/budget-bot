// transaction.js
const { cancelLastKeyboard, mainKeyboard } = require('./keyboards');
const { normWallet, extractWallet, DEFAULT_WALLET } = require('./utils');
const { getBalance } = require('./balance');
const { handleDebtOperation, sendDebtors } = require('./debt');

const lastOperations = new Map();
global.lastOperations = lastOperations;

async function addTransaction(type, amount, category, comment = '', wallet = DEFAULT_WALLET) {
  try {
    const transactionsSheet = global.transactionsSheet;
    const doc = global.doc;

    if (!transactionsSheet || !doc) {
      console.error('transactionsSheet или doc не инициализированы');
      return { success: false, error: 'Таблицы не инициализированы' };
    }

    const date = new Date().toLocaleString('ru-RU');
    const sign = type === 'доход' ? amount : -amount;
    wallet = normWallet(wallet);

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
      Комментарий: comment,
      Кошелёк: wallet
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

  const hasIncomeKeyword = /зарплат|зп|аванс|премия|кешбэк|подарок|возврат|доход/i.test(lower);
  const hasPlus = text.includes('+');

  const kind = hasPlus || hasIncomeKeyword ? 'доход' : 'расход';

  const categoryWords = [...words];
  categoryWords.splice(amountIndex, 1);

  const category = categoryWords.join(' ').trim() || 'разное';

  return {
    action: 'transaction',
    kind,
    amount,
    category,
    wallet
  };
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

  const result = await addTransaction(
    parsed.kind,
    parsed.amount,
    parsed.category,
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

  const message =
    `Операция прошла успешно ✅\n\n` +
    `Добавлен ${kindText}: ${parsed.amount.toFixed(2)} ₽ — ${parsed.category}\n` +
    `Кошелёк: #${parsed.wallet}\n\n` +
    `Текущий баланс кошелька: ${walletBalance.toFixed(2)} ₽\n` +
    `Общий итог (основные): ${totalMain.toFixed(2)} ₽`;

  lastOperations.set(ctx.chat.id, {
    type: 'trans',
    id: result.id
  });

  await ctx.reply(message, cancelLastKeyboard());
}

module.exports = {
  handleFreeInput,
  addTransaction,
  lastOperations
};
