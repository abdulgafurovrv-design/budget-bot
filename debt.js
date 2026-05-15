// debt.js
const { menuKeyboard, cancelLastKeyboard } = require('./keyboards');
const { getBalance } = require('./balance');
const { normWallet, extractWallet, DEFAULT_WALLET } = require('./utils');

const ALLOWED_WALLETS = [
  'карта',
  'наличка',
  'евро',
  'доллары',
  'депозит',
  'зарубежная_карта'
];

function normalizeName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/^./, c => c.toUpperCase());
}

function parseAmount(value) {
  return Number(String(value || '').replace(',', '.'));
}

async function getNextTransactionId() {
  const transactionsSheet = global.transactionsSheet;
  const rows = await transactionsSheet.getRows();

  let maxId = 0;

  rows.forEach(row => {
    const id = Number(row.get('ID')) || 0;
    if (id > maxId) maxId = id;
  });

  return maxId + 1;
}

async function getNextDebtId() {
  const debtsSheet = global.debtsSheet;
  const rows = await debtsSheet.getRows();

  let maxId = 0;

  rows.forEach(row => {
    const id = Number(row.get('ID')) || 0;
    if (id > maxId) maxId = id;
  });

  return maxId + 1;
}

async function addTransactionRow({ type, amount, category, comment, wallet }) {
  const transactionsSheet = global.transactionsSheet;
  const date = new Date().toLocaleString('ru-RU');
  const id = await getNextTransactionId();

  await transactionsSheet.addRow({
    ID: id,
    Дата: date,
    Тип: type,
    Сумма: amount,
    Категория: category,
    Комментарий: comment || '',
    Кошелёк: wallet
  });

  return id;
}

async function addDebtRow({ debtor, amount, type, comment }) {
  const debtsSheet = global.debtsSheet;
  const date = new Date().toLocaleString('ru-RU');
  const id = await getNextDebtId();

  await debtsSheet.addRow({
    ID: id,
    Дата: date,
    Должник: debtor,
    Сумма: amount,
    Тип: type,
    Коммент: comment || ''
  });

  return id;
}

async function sendDebtors(ctx) {
  try {
    const debtsSheet = global.debtsSheet;
    const rows = await debtsSheet.getRows();

    const totals = {};

    rows.forEach(row => {
      const debtor = normalizeName(row.get('Должник'));
      const amount = Number(row.get('Сумма')) || 0;

      if (!debtor) return;

      if (!totals[debtor]) {
        totals[debtor] = 0;
      }

      totals[debtor] += amount;
    });

    const activeDebts = Object.entries(totals)
      .filter(([, amount]) => Math.abs(amount) > 0.009)
      .sort((a, b) => b[1] - a[1]);

    if (ctx.callbackQuery) {
      await ctx.answerCbQuery();
    }

    if (activeDebts.length === 0) {
      return ctx.reply('Активных долгов нет ✅', menuKeyboard());
    }

    let msg = '<b>Кто мне должен:</b>\n\n';

    activeDebts.forEach(([debtor, amount]) => {
      msg += `• ${debtor}: ${amount.toFixed(2)} ₽\n`;
    });

    const total = activeDebts.reduce((sum, [, amount]) => sum + amount, 0);

    msg += `\n<b>Итого долгов:</b> ${total.toFixed(2)} ₽`;

    return ctx.replyWithHTML(msg, menuKeyboard());

  } catch (error) {
    console.error('Ошибка вывода долгов:', error);
    return ctx.reply('Ошибка получения долгов ❌', menuKeyboard());
  }
}

async function handleDebtOperation(ctx, parsed) {
  try {
    const doc = global.doc;

    if (!doc || !global.transactionsSheet || !global.debtsSheet) {
      return ctx.reply('Ошибка: таблицы ещё не инициализированы', menuKeyboard());
    }

    await doc.loadInfo();

    const debtor = normalizeName(parsed.debtor);
    const amount = parseAmount(parsed.amount);

    if (!debtor || !amount || amount <= 0) {
      return ctx.reply(
        'Не понял долг 😅\n\n' +
        'Примеры:\n' +
        'дал Саша 5000 #карта\n' +
        'вернули Саша 2000 #карта\n' +
        'добавить долг Саша 10000',
        menuKeyboard()
      );
    }

    const rawComment = parsed.comment || '';
    const walletData = extractWallet(rawComment);
    const wallet = normWallet(walletData.wallet || DEFAULT_WALLET);
    const comment = walletData.cleaned || '';

    if (!ALLOWED_WALLETS.includes(wallet)) {
      return ctx.reply(
        `Поддерживаемые кошельки: ${ALLOWED_WALLETS.join(', ')}`,
        menuKeyboard()
      );
    }

    // === 1. Выдал деньги в долг ===
    if (parsed.action === 'lend') {
      const transactionId = await addTransactionRow({
        type: 'расход',
        amount: -amount,
        category: 'долг',
        comment: `дал ${debtor}${comment ? `; ${comment}` : ''}`,
        wallet
      });

      const debtId = await addDebtRow({
        debtor,
        amount,
        type: 'выдал',
        comment
      });

      if (global.lastOperations) {
        global.lastOperations.set(ctx.chat.id, {
          type: 'debt_lend',
          transactionIds: [transactionId],
          debtIds: [debtId],
          debtor,
          amount,
          wallet
        });
      }

      const balances = await getBalance();

      return ctx.reply(
        `Долг записан ✅\n\n` +
        `Дал: ${debtor}\n` +
        `Сумма: ${amount.toFixed(2)} ₽\n` +
        `Кошелёк: #${wallet}\n\n` +
        `Текущий баланс кошелька: ${(balances[wallet] || 0).toFixed(2)} ₽\n` +
        `Итого долгов: ${(balances.долги || 0).toFixed(2)} ₽`,
        cancelLastKeyboard()
      );
    }

    // === 2. Мне вернули долг ===
    if (parsed.action === 'return_debt') {
      const transactionId = await addTransactionRow({
        type: 'доход',
        amount,
        category: 'возврат долга',
        comment: `вернул ${debtor}${comment ? `; ${comment}` : ''}`,
        wallet
      });

      const debtId = await addDebtRow({
        debtor,
        amount: -amount,
        type: 'вернули',
        comment
      });

      if (global.lastOperations) {
        global.lastOperations.set(ctx.chat.id, {
          type: 'debt_return',
          transactionIds: [transactionId],
          debtIds: [debtId],
          debtor,
          amount,
          wallet
        });
      }

      const balances = await getBalance();

      return ctx.reply(
        `Возврат долга записан ✅\n\n` +
        `Вернул: ${debtor}\n` +
        `Сумма: ${amount.toFixed(2)} ₽\n` +
        `Кошелёк: #${wallet}\n\n` +
        `Текущий баланс кошелька: ${(balances[wallet] || 0).toFixed(2)} ₽\n` +
        `Итого долгов: ${(balances.долги || 0).toFixed(2)} ₽`,
        cancelLastKeyboard()
      );
    }

    // === 3. Начальный долг без движения денег ===
    if (parsed.action === 'opening_debt') {
      const debtId = await addDebtRow({
        debtor,
        amount,
        type: 'начальный долг',
        comment
      });

      if (global.lastOperations) {
        global.lastOperations.set(ctx.chat.id, {
          type: 'debt_opening',
          transactionIds: [],
          debtIds: [debtId],
          debtor,
          amount,
          wallet: ''
        });
      }

      const balances = await getBalance();

      return ctx.reply(
        `Начальный долг добавлен ✅\n\n` +
        `Должник: ${debtor}\n` +
        `Сумма: ${amount.toFixed(2)} ₽\n\n` +
        `Итого долгов: ${(balances.долги || 0).toFixed(2)} ₽`,
        cancelLastKeyboard()
      );
    }

    return ctx.reply('Не понял операцию с долгом', menuKeyboard());

  } catch (error) {
    console.error('Ошибка операции с долгом:', error);
    return ctx.reply('Ошибка операции с долгом ❌', menuKeyboard());
  }
}

module.exports = {
  handleDebtOperation,
  sendDebtors
};
