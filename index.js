// ... (всё сверху остаётся без изменений: импорты, клавиатуры, normWallet, getBalance, sendBalance, helpText, initSheets)

// === Добавление транзакции ===
async function addTransaction(type, amount, category, comment = '', wallet = DEFAULT_WALLET) {
  const date = new Date().toLocaleString('ru-RU');
  const sign = type === 'доход' ? amount : -amount;
  wallet = normWallet(wallet);

  // Генерируем ID: максимальный + 1
  const rows = await transactionsSheet.getRows();
  let maxId = 0;
  rows.forEach(row => {
    const id = Number(row.get('ID')) || 0;
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

  return { id, type, amount: Math.abs(amount), category, comment, wallet };
}

// === Добавление долга ===
async function addDebt(type, debtor, amount, comment = '') {
  const date = new Date().toLocaleString('ru-RU');
  const sign = (type === 'issue' || type === 'opening') ? amount : -amount;

  const rows = await debtsSheet.getRows();
  let maxId = 0;
  rows.forEach(row => {
    const id = Number(row.get('ID')) || 0;
    if (id > maxId) maxId = id;
  });
  const id = maxId + 1;

  await debtsSheet.addRow({
    ID: id,
    Дата: date,
    Должник: debtor,
    Сумма: sign,
    Тип: type,
    Коммент: comment
  });

  return { id, type, debtor, amount: Math.abs(amount), comment };
}

// === Парсер свободного ввода ===
function parseFreeInput(text) {
  const lower = text.toLowerCase();

  // Обработка долгов
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
    const rest = text.slice(13).trim(); // после "добавить долг "
    const words = rest.split(' ');
    let amountIndex = -1;
    let amount = 0;
    for (let i = 0; i < words.length; i++) {
      if (!isNaN(parseFloat(words[i]))) {
        amount = parseFloat(words[i]);
        amountIndex = i;
        break;
      }
    }
    if (amountIndex <= 0 || amount <= 0) return null;
    const debtor = words.slice(0, amountIndex).join(' ').charAt(0).toUpperCase() + words.slice(0, amountIndex).join(' ').slice(1);
    const comment = words.slice(amountIndex + 1).join(' ');
    return { action: 'opening_debt', debtor, amount, comment };
  }

  // Обычные доходы/расходы
  const { wallet, cleaned } = extractWallet(text);
  const words = cleaned.split(/\s+/);

  let amount = 0;
  let amountIndex = -1;
  for (let i = 0; i < words.length; i++) {
    const num = parseFloat(words[i].replace('+', ''));
    if (!isNaN(num) && num > 0) {
      amount = num;
      amountIndex = i;
      break;
    }
  }

  if (amountIndex === -1 || amount <= 0) return null;

  const hasPlus = text.includes('+') || /зарплат|зп|аванс|кешбэк|подарок|премия/i.test(text);
  const kind = hasPlus ? 'доход' : 'расход';

  let categoryWords = [...words];
  categoryWords.splice(amountIndex, 1);
  const category = categoryWords.join(' ').trim() || 'разное';

  return { action: 'transaction', kind, amount, category, wallet };
}

function extractWallet(text) {
  const m = text.match(/#([а-яa-z0-9_]+)/i);
  if (m) {
    return { wallet: normWallet(m[1]), cleaned: text.replace(m[0], '').trim() };
  }
  return { wallet: DEFAULT_WALLET, cleaned: text };
}

// === Хранение последней операции (для отмены) ===
// Простой способ: сохраняем в глобальных переменных по chatId
const lastOperations = new Map(); // chatId → { type: 'trans'|'debt', rowIndex или id }

// === Обработка текста ===
bot.on('text', async (ctx) => {
  const text = ctx.message.text.trim();
  const chatId = ctx.chat.id;

  if (text.startsWith('/')) {
    if (['/start', '/help', '/баланс'].includes(text)) return; // уже обработаны
    await ctx.reply('Команда в разработке 🚧', mainKeyboard());
    return;
  }

  const parsed = parseFreeInput(text);
  if (!parsed) {
    await ctx.reply('Не понял ввод 😅\nПримеры:\n500 кофе #карта\n+10000 зарплата\nдал Иван 500\nвернули Петр 200', mainKeyboard());
    return;
  }

  let result, message;

  if (parsed.action === 'transaction') {
    result = await addTransaction(parsed.kind, parsed.amount, parsed.category, '', parsed.wallet);
    const kindText = parsed.kind === 'доход' ? 'доход' : 'расход';
    const balances = await getBalance();
    const currentBal = balances[parsed.wallet].toFixed(2);
    message = `Добавлен ${kindText}: ${parsed.amount.toFixed(2)} ₽ — ${parsed.category}\nКошелёк: #${parsed.wallet}\nБаланс: ${currentBal} ₽`;
    lastOperations.set(chatId, { type: 'trans', id: result.id });
  } else if (parsed.action === 'lend') {
    result = await addDebt('issue', parsed.debtor, parsed.amount, parsed.comment);
    const balances = await getBalance();
    message = `Выдал долг ${parsed.debtor}: ${parsed.amount.toFixed(2)} ₽${parsed.comment ? ' (' + parsed.comment + ')' : ''}\nБаланс долгов: ${balances.долги.toFixed(2)} ₽`;
    lastOperations.set(chatId, { type: 'debt', id: result.id });
  } else if (parsed.action === 'return_debt') {
    result = await addDebt('return', parsed.debtor, parsed.amount, parsed.comment);
    const balances = await getBalance();
    message = `Возврат долга от ${parsed.debtor}: ${parsed.amount.toFixed(2)} ₽${parsed.comment ? ' (' + parsed.comment + ')' : ''}\nБаланс долгов: ${balances.долги.toFixed(2)} ₽`;
    lastOperations.set(chatId, { type: 'debt', id: result.id });
  } else if (parsed.action === 'opening_debt') {
    result = await addDebt('opening', parsed.debtor, parsed.amount, parsed.comment);
    const balances = await getBalance();
    message = `Добавлен текущий долг от ${parsed.debtor}: ${parsed.amount.toFixed(2)} ₽${parsed.comment ? ' (' + parsed.comment + ')' : ''}\nБаланс долгов: ${balances.долги.toFixed(2)} ₽`;
    lastOperations.set(chatId, { type: 'debt', id: result.id });
  }

  await ctx.reply(message, cancelLastKeyboard());
});

// === Отмена последней ===
bot.action('cancel_last', async (ctx) => {
  await ctx.answerCbQuery();
  const chatId = ctx.chat.id;
  const lastOp = lastOperations.get(chatId);

  if (!lastOp) {
    await ctx.reply('Нет операций для отмены 😅', menuKeyboard());
    return;
  }

  let deleted;
  if (lastOp.type === 'trans') {
    const rows = await transactionsSheet.getRows();
    const rowIndex = rows.findIndex(r => Number(r.get('ID')) === lastOp.id);
    if (rowIndex !== -1) {
      await rows[rowIndex].delete();
      deleted = true;
    }
  } else if (lastOp.type === 'debt') {
    const rows = await debtsSheet.getRows();
    const rowIndex = rows.findIndex(r => Number(r.get('ID')) === lastOp.id);
    if (rowIndex !== -1) {
      await rows[rowIndex].delete();
      deleted = true;
    }
  }

  if (deleted) {
    lastOperations.delete(chatId);
    await ctx.reply('Последняя операция отменена ✅', menuKeyboard());
  } else {
    await ctx.reply('Не удалось отменить (возможно, уже удалено)', menuKeyboard());
  }
});

// ... (остальной код: app.listen и т.д. остаётся без изменений)
