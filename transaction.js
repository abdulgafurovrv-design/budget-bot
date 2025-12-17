// transaction.js
const { transactionsSheet, doc } = global; // ← добавили doc
const { cancelLastKeyboard, mainKeyboard } = require('./keyboards');
const { normWallet, extractWallet, DEFAULT_WALLET } = require('./utils');
const { getBalance } = require('./balance');

const lastOperations = new Map();

async function addTransaction(type, amount, category, comment = '', wallet = DEFAULT_WALLET) {
  const date = new Date().toLocaleString('ru-RU');
  const sign = type === 'доход' ? amount : -amount;
  wallet = normWallet(wallet);

  await doc.loadInfo(); // ← перед getRows()
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

  return { id };
}

function parseFreeInput(text) {
  const lower = text.toLowerCase();

  if (lower.startsWith('дал ') || lower.startsWith('выдал ')) {
    const parts = text.split(' ');
    if (parts.length < 3) return null;
    const debtor = parts[1].charAt(0).toUpperCase() + parts[1].slice(1).toLowerCase();
    const amount = parseFloat(parts[2]);
    const comment = parts.slice(3).join(' ');
    if (isNaN(amount) || amount <= 0) return null;
    return { action: 'lend', debtor, amount, comment };
  }

  if (lower.startsWith('вернули ') || lower.startsWith('вернул ')) {
    const parts = text.split(' ');
    if (parts.length < 3) return null;
    const debtor = parts[1].charAt(0).toUpperCase() + parts[1].slice(1).toLowerCase();
    const amount = parseFloat(parts[2]);
    const comment = parts.slice(3).join(' ');
    if (isNaN(amount) || amount <= 0) return null;
    return { action: 'return_debt', debtor, amount, comment };
  }

  if (lower.startsWith('добавить долг ')) {
    const rest = text.slice(13).trim();
    const words = rest.split(' ');
    let amount = 0, amountIndex = -1;
    for (let i = 0; i < words.length; i++) {
      amount = parseFloat(words[i]);
      if (!isNaN(amount) && amount > 0) { amountIndex = i; break; }
    }
    if (amountIndex === -1 || amount <= 0 || amountIndex === 0) return null;
    const debtor = words.slice(0, amountIndex).join(' ').replace(/^\w/, c => c.toUpperCase());
    const comment = words.slice(amountIndex + 1).join(' ');
    return { action: 'opening_debt', debtor, amount, comment };
  }

  const { wallet, cleaned } = extractWallet(text);
  const words = cleaned.trim().split(/\s+/);

  let amount = 0, amountIndex = -1;
  for (let i = 0; i < words.length; i++) {
    let numStr = words[i].replace('+', '');
    amount = parseFloat(numStr);
    if (!isNaN(amount) && amount > 0) { amountIndex = i; break; }
  }

  if (amountIndex === -1 || amount <= 0) return null;

  const hasPlus = text.includes('+') || /зарплат|зп|аванс|кешбэк|подарок|премия|возврат/i.test(lower);
  const kind = hasPlus ? 'доход' : 'расход';

  const categoryWords = [...words];
  categoryWords.splice(amountIndex, 1);
  const category = categoryWords.join(' ').trim() || 'разное';

  return { action: 'transaction', kind, amount, category, wallet };
}

async function handleFreeInput(ctx) {
  const text = ctx.message.text.trim();
  const parsed = parseFreeInput(text);

  if (!parsed) {
    await ctx.reply('Не понял ввод 😅\nПримеры:\nкофе 250\n250 кофе #карта\n+15000 зп\nдал Иван 5000', mainKeyboard());
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
