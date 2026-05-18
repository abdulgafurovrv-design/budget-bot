// transfer.js
const { transactionsSheet, doc } = global;
const { menuKeyboard, cancelLastKeyboard } = require('./keyboards');
const { normWallet, walletCurrency, parseSheetNumber } = require('./utils');
const { getBalance } = require('./balance');

const ALLOWED_WALLETS = [
  'карта',
  'наличка',
  'депозит',
  'зарубежная_карта',
  'евро',
  'доллары'
];

async function getNextTransactionId() {
  await doc.loadInfo();

  const rows = await transactionsSheet.getRows();

  let maxId = 0;

  rows.forEach(row => {
    const id = Number(row.get('ID')) || 0;
    if (id > maxId) maxId = id;
  });

  return maxId + 1;
}

async function handleTransfer(ctx) {
  try {
    const text = ctx.message.text.trim();
    const parts = text.split(/\s+/);

    if (parts.length < 4) {
      return ctx.reply(
        'Формат перевода:\n' +
        '/перевод <откуда> <куда> <сумма>\n\n' +
        'Примеры:\n' +
        '/перевод карта депозит 50000\n' +
        '/перевод доллары зарубежная_карта 100\n' +
        '/перевод зарубежная_карта доллары 50',
        menuKeyboard()
      );
    }

    const fromWallet = normWallet(parts[1], null);
    const toWallet = normWallet(parts[2], null);
    const amount = parseSheetNumber(parts[3], NaN);

    if (!ALLOWED_WALLETS.includes(fromWallet)) {
      return ctx.reply(
        `Неизвестный кошелёк списания: ${parts[1]}\n\n` +
        `Доступные кошельки: ${ALLOWED_WALLETS.join(', ')}`,
        menuKeyboard()
      );
    }

    if (!ALLOWED_WALLETS.includes(toWallet)) {
      return ctx.reply(
        `Неизвестный кошелёк зачисления: ${parts[2]}\n\n` +
        `Доступные кошельки: ${ALLOWED_WALLETS.join(', ')}`,
        menuKeyboard()
      );
    }

    if (fromWallet === toWallet) {
      return ctx.reply('Кошелёк списания и кошелёк зачисления совпадают', menuKeyboard());
    }

    if (!amount || Number.isNaN(amount) || amount <= 0) {
      return ctx.reply('Сумма перевода должна быть больше 0', menuKeyboard());
    }

    const fromCurrency = walletCurrency(fromWallet);
    const toCurrency = walletCurrency(toWallet);

    if (fromCurrency !== toCurrency) {
      return ctx.reply(
        'Перевод между разными валютами запрещён.\n\n' +
        'Для обмена используй команду:\n' +
        '/обмен <откуда> <куда> <сумма_списания> <сумма_зачисления>\n\n' +
        'Пример:\n' +
        '/обмен карта зарубежная_карта 9000 100',
        menuKeyboard()
      );
    }

    const date = new Date().toLocaleString('ru-RU');

    const firstId = await getNextTransactionId();
    const secondId = firstId + 1;

    await transactionsSheet.addRow({
      ID: firstId,
      Дата: date,
      Тип: 'перевод',
      Сумма: -amount,
      Категория: 'перевод',
      Комментарий: `перевод в ${toWallet}`,
      Кошелёк: fromWallet
    });

    await transactionsSheet.addRow({
      ID: secondId,
      Дата: date,
      Тип: 'перевод',
      Сумма: amount,
      Категория: 'перевод',
      Комментарий: `перевод из ${fromWallet}`,
      Кошелёк: toWallet
    });

    if (global.lastOperations) {
      global.lastOperations.set(ctx.chat.id, {
        type: 'transfer',
        transactionIds: [firstId, secondId],
        fromWallet,
        toWallet,
        amount
      });
    }

    const balances = await getBalance();

    return ctx.reply(
      `Перевод выполнен ✅\n\n` +
      `Сумма: ${amount.toFixed(2)} ${fromCurrency}\n` +
      `Откуда: #${fromWallet}\n` +
      `Куда: #${toWallet}\n\n` +
      `Баланс #${fromWallet}: ${(balances[fromWallet] || 0).toFixed(2)} ${fromCurrency}\n` +
      `Баланс #${toWallet}: ${(balances[toWallet] || 0).toFixed(2)} ${toCurrency}\n\n` +
      `ИТОГ ₽: ${(balances.totalMain || 0).toFixed(2)} ₽`,
      cancelLastKeyboard()
    );

  } catch (error) {
    console.error('Ошибка перевода:', error);
    return ctx.reply('Ошибка перевода ❌', menuKeyboard());
  }
}

module.exports = {
  handleTransfer
};
