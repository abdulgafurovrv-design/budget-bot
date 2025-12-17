// initial.js
const { addTransaction } = require('./transaction'); // пока заглушка, потом подключим настоящий
const { menuKeyboard } = require('./keyboards');
const { normWallet } = require('./utils');
const { getBalance } = require('./balance');

async function handleInitial(ctx) {
  const parts = ctx.message.text.trim().split(' ');
  if (parts.length < 3) {
    return ctx.reply('Формат: /остаток <кошелёк> <сумма>\nПример: /остаток карта 150000', menuKeyboard());
  }

  const wallet = normWallet(parts[1]);
  const amount = parseFloat(parts[2].replace(',', '.'));

  if (isNaN(amount) || amount < 0) {
    return ctx.reply('Сумма должна быть положительной цифрой', menuKeyboard());
  }

  if (!['карта', 'наличка', 'евро', 'доллары', 'депозит'].includes(wallet)) {
    return ctx.reply('Поддерживаемые кошельки: карта, наличка, евро, доллары, депозит', menuKeyboard());
  }

  // Используем addTransaction из transaction.js (создадим позже) или временно дублируем
  const date = new Date().toLocaleString('ru-RU');
  const rows = await global.transactionsSheet.getRows();
  let maxId = 0;
  rows.forEach(r => {
    const id = Number(r.get('ID')) || 0;
    if (id > maxId) maxId = id;
  });
  const id = maxId + 1;

  await global.transactionsSheet.addRow({
    ID: id,
    Дата: date,
    Тип: 'доход',
    Сумма: amount,
    Категория: 'начальный остаток',
    Комментарий: '',
    Кошелёк: wallet
  });

  const balances = await getBalance();
  await ctx.reply(`Начальный остаток установлен: ${amount.toFixed(2)} ₽ на #${wallet}\nТекущий баланс: ${balances[wallet].toFixed(2)} ₽`, menuKeyboard());
}

module.exports = { handleInitial };
