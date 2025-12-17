// transaction.js
const { transactionsSheet, doc } = global;
const { cancelLastKeyboard, mainKeyboard } = require('./keyboards');
const { normWallet, extractWallet, DEFAULT_WALLET } = require('./utils');
const { getBalance } = require('./balance');

const lastOperations = new Map();

async function addTransaction(type, amount, category, comment = '', wallet = DEFAULT_WALLET) {
  try {
    const date = new Date().toLocaleString('ru-RU');
    const sign = type === 'доход' ? amount : -amount;
    wallet = normWallet(wallet);

    await doc.loadInfo();
    const rows = await transactionsSheet.getRows();

    let maxId = 0;
    rows.forEach(r => {
      const id = Number(r.get('ID')) || 0;
      if (id > maxId) maxId = id;
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

  if (lower.startsWith('дал ') || lower.startsWith('выдал ')) {
    // ... (твой код для долгов без изменений)
    return { action: 'lend', ... };
  }

  if (lower.startsWith('вернули ') || lower.startsWith('вернул ')) {
    // ... 
    return { action: 'return_debt', ... };
  }

  if (lower.startsWith('добавить долг ')) {
    // ...
    return { action: 'opening_debt', ... };
  }

  const { wallet, cleaned } = extractWallet(text);
  const words = cleaned.trim().split(/\s+/);

  let amount = 0, amountIndex = -1;
  for (let i = 0; i < words.length; i++) {
    let numStr = words[i].replace('+', '');
    amount = parseFloat(numStr);
    if (!isNaN(amount) && amount > 0) {
      amountIndex = i;
      break;
    }
  }

  if (amountIndex === -1 || amount <= 0) return null;

  const hasIncomeKeyword = /зарплат|зп|аванс|премия|кешбэк|подарок|возврат|доход/i.test(lower);
  const hasPlus = text.includes('+');
  const kind = hasPlus || hasIncomeKeyword ? 'доход' : 'расход';

  const categoryWords = [...words];
  categoryWords.splice(amountIndex, 1);
  const category = categoryWords.join(' ').trim() || 'разное';

  return { action: 'transaction', kind, amount, category, wallet };
}

async function handleFreeInput(ctx) {
  const text = ctx.message.text.trim();

  const parsed = parseFreeInput(text);

  if (!parsed || parsed.action !== 'transaction') {
    await ctx.reply('Не понял ввод 😅\nПримеры:\nкофе 250\n250 кофе #карта\nзарплата 100000\n+50000 премия', mainKeyboard());
    return;
  }

  const result = await addTransaction(parsed.kind, parsed.amount, parsed.category, '', parsed.wallet);

  if (!result.success) {
    await ctx.reply('Ошибка операции ❌\nНе удалось добавить запись в таблицу', mainKeyboard());
    return;
  }

  const kindText = parsed.kind === 'доход' ? 'доход' : 'расход';
  const balances = await getBalance();

  const walletBalance = balances[parsed.wallet] || 0;
  const totalMain = balances.карта + balances.наличка + balances.депозит + balances.долги;

  const message = `Операция прошла успешно ✅\n\n` +
    `Добавлен ${kindText}: ${parsed.amount.toFixed(2)} ₽ — ${parsed.category}\n` +
    `Кошелёк: #${parsed.wallet}\n\n` +
    `Текущий баланс кошелька: ${walletBalance.toFixed(2)} ₽\n` +
    `Общий итог (основные): ${totalMain.toFixed(2)} ₽`;

  lastOperations.set(ctx.chat.id, { type: 'trans', id: result.id });

  await ctx.reply(message, cancelLastKeyboard());
}

module.exports = { handleFreeInput, addTransaction, lastOperations };
