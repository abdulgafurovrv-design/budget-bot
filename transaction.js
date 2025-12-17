// transaction.js
const { transactionsSheet } = global;
const { cancelLastKeyboard, mainKeyboard } = require('./keyboards');
const { normWallet, extractWallet, DEFAULT_WALLET } = require('./utils');
const { getBalance } = require('./balance');

const lastOperations = new Map(); // chatId → { type: 'trans', id }

async function addTransaction(type, amount, category, comment = '', wallet = DEFAULT_WALLET) {
  const date = new Date().toLocaleString('ru-RU');
  const sign = type === 'доход' ? amount : -amount;
  wallet = normWallet(wallet);

  await transactionsSheet.loadInfo(); // ← обязательно перед getRows()
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

  // Кэш уже сброшен после addRow, но для следующего вызова getBalance он будет перезагружен
  return { id };
}

function parseFreeInput(text) {
  const lower = text.toLowerCase();

  // Доход — только если есть "+" или слова вроде зарплат*
  if (text.includes('+') || /зарплат|зп|аванс|премия|кешбэк|подарок|возврат/i.test(lower)) {
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

    if (amountIndex === -1) return null;

    const categoryWords = [...words];
    categoryWords.splice(amountIndex, 1);
    const category = categoryWords.join(' ').trim() || 'доход';

    return { type: 'доход', amount, category, wallet };
  }

  // Расход — всё остальное с числом
  const { wallet, cleaned } = extractWallet(text);
  const words = cleaned.trim().split(/\s+/);

  let amount = 0, amountIndex = -1;
  for (let i = 0; i < words.length; i++) {
    amount = parseFloat(words[i]);
    if (!isNaN(amount) && amount > 0) {
      amountIndex = i;
      break;
    }
  }

  if (amountIndex === -1) return null;

  const categoryWords = [...words];
  categoryWords.splice(amountIndex, 1);
  const category = categoryWords.join(' ').trim() || 'разное';

  return { type: 'расход', amount, category, wallet };
}

async function handleFreeInput(ctx) {
  const text = ctx.message.text.trim();
  const parsed = parseFreeInput(text);

  if (!parsed) {
    await ctx.reply('Не понял ввод 😅\nПримеры:\nкофе 250\n250 кофе #наличка\n+100000 зарплата', mainKeyboard());
    return;
  }

  const chatId = ctx.chat.id;
  const result = await addTransaction(parsed.type, parsed.amount, parsed.category, parsed.wallet);

  const kindText = parsed.type === 'доход' ? 'доход' : 'расход';
  const balances = await getBalance();
  const message = `Добавлен ${kindText}: ${parsed.amount.toFixed(2)} ₽ — ${parsed.category}\nКошелёк: #${parsed.wallet}\nБаланс: ${balances[parsed.wallet].toFixed(2)} ₽`;

  lastOperations.set(chatId, { type: 'trans', id: result.id });

  await ctx.reply(message, cancelLastKeyboard());
}

module.exports = { handleFreeInput, addTransaction, lastOperations };
