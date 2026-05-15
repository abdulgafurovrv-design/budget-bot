// transfer.js
const { transactionsSheet, doc } = global;
const { menuKeyboard } = require('./keyboards');
const { normWallet } = require('./utils');
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

    // Формат:
    // /перевод карта депозит 50000
    // перевод карта зарубежная_карта 5000
    if (parts.length < 4) {
      return ctx.reply(
        'Формат перевода:\n' +
        '/перевод <откуда> <куда> <сумма>\n\n' +
        'Примеры:\n' +
        '/перевод карта депозит 50000\n' +
        '/перевод карта зарубежная_карта 5000\n' +
        '/перевод зарубежная_карта карта 1000',
        menuKeyboard()
      );
    }

    const fromWallet = normWallet(parts[1]);
    const toWallet = normWallet(parts[2]);
    const amount = Number(String(parts[3]).replace(',', '.'));

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

    const balances = await getBalance();

    const totalMain =
      (balances.карта || 0) +
      (balances.наличка || 0) +
      (balances.депозит || 0) +
      (balances.зарубежная_карта || 0) +
      (balances.долги || 0);

    return ctx.reply(
      `Перевод выполнен ✅\n\n` +
      `Сумма: ${amount.toFixed(2)} ₽\n` +
      `Откуда: #${fromWallet}\n` +
      `Куда: #${toWallet}\n\n` +
      `Баланс #${fromWallet}: ${(balances[fromWallet] || 0).toFixed(2)} ₽\n` +
      `Баланс #${toWallet}: ${(balances[toWallet] || 0).toFixed(2)} ₽\n\n` +
      `Общий итог (основные): ${totalMain.toFixed(2)} ₽`,
      menuKeyboard()
    );

  } catch (error) {
    console.error('Ошибка перевода:', error);
    return ctx.reply('Ошибка перевода ❌', menuKeyboard());
  }
}

module.exports = {
  handleTransfer
};
