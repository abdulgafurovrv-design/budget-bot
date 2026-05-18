// exchange.js
const { transactionsSheet, doc } = global;
const { menuKeyboard, cancelLastKeyboard } = require('./keyboards');
const { normWallet, walletCurrency, parseSheetNumber } = require('./utils');
const { getBalance } = require('./balance');

const ALLOWED_WALLETS = [
  'карта',
  'наличка',
  'депозит',
  'доллары',
  'евро',
  'зарубежная_карта'
];

async function getNextTransactionId() {
  await doc.loadInfo();

  const rows = await transactionsSheet.getRows();

  let maxId = 0;

  rows.forEach(row => {
    const id = Number(row.get('ID')) || 0;
    if (id > maxId) {
      maxId = id;
    }
  });

  return maxId + 1;
}

function parseAmount(value) {
  return parseSheetNumber(value, NaN);
}

async function handleExchange(ctx) {
  try {
    const text = ctx.message.text.trim();
    const parts = text.split(/\s+/);

    if (parts.length < 5) {
      return ctx.reply(
        'Формат обмена:\n' +
        '/обмен <откуда> <куда> <сумма_списания> <сумма_зачисления>\n\n' +
        'Примеры:\n' +
        '/обмен карта зарубежная_карта 9000 100\n' +
        '/обмен зарубежная_карта карта 100 9200\n' +
        '/обмен карта доллары 9200 100',
        menuKeyboard()
      );
    }

    const fromWallet = normWallet(parts[1], null);
    const toWallet = normWallet(parts[2], null);
    const fromAmount = parseAmount(parts[3]);
    const toAmount = parseAmount(parts[4]);

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

    if (!fromAmount || Number.isNaN(fromAmount) || fromAmount <= 0) {
      return ctx.reply('Сумма списания должна быть больше 0', menuKeyboard());
    }

    if (!toAmount || Number.isNaN(toAmount) || toAmount <= 0) {
      return ctx.reply('Сумма зачисления должна быть больше 0', menuKeyboard());
    }

    const fromCurrency = walletCurrency(fromWallet);
    const toCurrency = walletCurrency(toWallet);

    if (fromCurrency === toCurrency) {
      return ctx.reply(
        'Для кошельков в одной валюте используй /перевод.\n\n' +
        'Пример:\n' +
        '/перевод доллары зарубежная_карта 100',
        menuKeyboard()
      );
    }

    const date = new Date().toLocaleString('ru-RU');

    const firstId = await getNextTransactionId();
    const secondId = firstId + 1;

    const rate = fromAmount / toAmount;

    await transactionsSheet.addRow({
      ID: firstId,
      Дата: date,
      Тип: 'обмен',
      Сумма: -fromAmount,
      Категория: 'обмен валюты',
      Комментарий: `обмен в ${toWallet}; получено ${toAmount} ${toCurrency}; курс ${rate.toFixed(4)}`,
      Кошелёк: fromWallet
    });

    await transactionsSheet.addRow({
      ID: secondId,
      Дата: date,
      Тип: 'обмен',
      Сумма: toAmount,
      Категория: 'обмен валюты',
      Комментарий: `обмен из ${fromWallet}; списано ${fromAmount} ${fromCurrency}; курс ${rate.toFixed(4)}`,
      Кошелёк: toWallet
    });

    if (global.lastOperations) {
      global.lastOperations.set(ctx.chat.id, {
        type: 'exchange',
        transactionIds: [firstId, secondId],
        fromWallet,
        toWallet,
        fromAmount,
        toAmount
      });
    }

    const balances = await getBalance();

    return ctx.reply(
      `Обмен выполнен ✅\n\n` +
      `Списано: ${fromAmount.toFixed(2)} ${fromCurrency} с #${fromWallet}\n` +
      `Зачислено: ${toAmount.toFixed(2)} ${toCurrency} на #${toWallet}\n` +
      `Курс: ${rate.toFixed(4)} ${fromCurrency}/${toCurrency}\n\n` +
      `Баланс #${fromWallet}: ${(balances[fromWallet] || 0).toFixed(2)} ${fromCurrency}\n` +
      `Баланс #${toWallet}: ${(balances[toWallet] || 0).toFixed(2)} ${toCurrency}\n\n` +
      `ИТОГ ₽: ${(balances.totalMain || 0).toFixed(2)} ₽`,
      cancelLastKeyboard()
    );

  } catch (error) {
    console.error('Ошибка обмена:', error);
    return ctx.reply('Ошибка обмена валюты ❌', menuKeyboard());
  }
}

module.exports = {
  handleExchange
};
