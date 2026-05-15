// initial.js
const { transactionsSheet, doc } = global;
const { menuKeyboard } = require('./keyboards');
const { normWallet } = require('./utils');
const { getBalance } = require('./balance');

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

async function handleInitial(ctx) {
  try {
    const text = ctx.message.text.trim();

    const match = text.match(/^\/?остаток\s+(.+?)\s+(-?\d+(?:[.,]\d+)?)$/i);

    if (!match) {
      return ctx.reply(
        'Формат: /остаток <кошелёк> <сумма>\n\n' +
        'Примеры:\n' +
        '/остаток карта 150000\n' +
        '/остаток депозит 0\n' +
        '/остаток наличка 5000',
        menuKeyboard()
      );
    }

    const wallet = normWallet(match[1]);
    const targetAmount = Number(String(match[2]).replace(',', '.'));

    if (Number.isNaN(targetAmount)) {
      return ctx.reply('Сумма должна быть числом', menuKeyboard());
    }

    if (!['карта', 'наличка', 'евро', 'доллары', 'депозит'].includes(wallet)) {
      return ctx.reply(
        'Поддерживаемые кошельки: карта, наличка, евро, доллары, депозит',
        menuKeyboard()
      );
    }

    const balancesBefore = await getBalance();
    const currentAmount = balancesBefore[wallet] || 0;
    const correctionAmount = targetAmount - currentAmount;

    const id = await getNextTransactionId();
    const date = new Date().toLocaleString('ru-RU');

    await transactionsSheet.addRow({
      ID: id,
      Дата: date,
      Тип: correctionAmount >= 0 ? 'доход' : 'расход',
      Сумма: correctionAmount,
      Категория: 'корректировка остатка',
      Комментарий: `установка фактического остатка ${targetAmount}`,
      Кошелёк: wallet
    });

    const balancesAfter = await getBalance();

    return ctx.reply(
      `Остаток актуализирован ✅\n\n` +
      `Кошелёк: #${wallet}\n` +
      `Было: ${currentAmount.toFixed(2)}\n` +
      `Стало: ${balancesAfter[wallet].toFixed(2)}\n` +
      `Корректировка: ${correctionAmount.toFixed(2)}`,
      menuKeyboard()
    );

  } catch (error) {
    console.error('Ошибка установки остатка:', error);
    return ctx.reply('Ошибка актуализации остатка ❌', menuKeyboard());
  }
}

module.exports = { handleInitial };
