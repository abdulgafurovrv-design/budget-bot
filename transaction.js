// transaction.js
const { transactionsSheet, doc } = global;
const { cancelLastKeyboard, mainKeyboard } = require('./keyboards');
const { normWallet, extractWallet, DEFAULT_WALLET } = require('./utils');
const { getBalance } = require('./balance');
const { handleDebtOperation, sendDebtors } = require('./debt');

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

  // Долги — оставляем как есть (временно не обрабатываем)
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
      if (!isNaN(amount) && amount > 0) {
        amountIndex = i;
        break;
      }
    }
    if (amountIndex === -1 || amount <= 0 || amountIndex === 0) return null;
    const debtor = words.slice(0, amountIndex).join(' ').replace(/^\w/, c => c.toUpperCase());
    const comment = words.slice(amountIndex + 1).join(' ');
    return { action: 'opening_debt', debtor, amount, comment };
  }

  // Обычные транзакции
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


module.exports = { handleFreeInput, addTransaction, lastOperations };
