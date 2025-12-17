// transfer.js
const { transactionsSheet } = global;
const { menuKeyboard } = require('./keyboards');
const { normWallet } = require('./utils');
const { getBalance } = require('./balance');

async function handleTransfer(ctx) {
  const parts = ctx.message.text.trim().split(' ');
  if (parts.length < 4 || parts[0] !== '/перевод') {
    return ctx.reply('Формат: /перевод <от_кошелька> <к_кошельку> <сумма>\nПример: /перевод карта депозит 50000', menuKeyboard());
  }

  const fromWallet = normWallet(parts[1]);
  const toWallet = normWallet(parts[2]);
  const amount = parseFloat(parts[3].replace(',', '.'));

  if (isNaN(amount) || amount <= 0) {
    return ctx.reply('Сумма должна быть положительной цифрой', menuKeyboard());
  }

  if (!['карта', 'наличка', 'евро', 'доллары', 'депозит'].includes(fromWallet) || 
      !['карта', 'наличка', 'евро', 'доллары', 'депозит'].includes(toWallet)) {
    return ctx.reply('Поддерживаемые кошельки: карта, наличка, евро, доллары, депозит', menuKeyboard());
  }

  if (fromWallet === toWallet) {
    return ctx.reply('Нельзя переводить на тот же кошелёк', menuKeyboard());
  }

  const balances = await getBalance();
  if (balances[fromWallet] < amount) {
    return ctx.reply(`Недостаточно средств на #${fromWallet}: ${balances[fromWallet].toFixed(2)} ₽`, menuKeyboard());
  }

  const date = new Date().toLocaleString('ru-RU');

  // Перед getRows() — loadInfo()
  await transactionsSheet.loadInfo();
  const rows = await transactionsSheet.getRows();

  let maxId = 0;
  rows.forEach(r => {
    const id = Number(r.get('ID')) || 0;
    if (id > maxId) maxId = id;
  });

  // Расход с fromWallet
  await transactionsSheet.addRow({
    ID: maxId + 1,
    Дата: date,
    Тип: 'расход',
    Сумма: -amount,
    Категория: 'перевод',
    Комментарий: `на ${toWallet}`,
    Кошелёк: fromWallet
  });

  // Доход на toWallet
  await transactionsSheet.addRow({
    ID: maxId + 2,
    Дата: date,
    Тип: 'доход',
    Сумма: amount,
    Категория: 'перевод',
    Комментарий: `с ${fromWallet}`,
    Кошелёк: toWallet
  });

  const newBalances = await getBalance();
  await ctx.reply(`Перевод ${amount.toFixed(2)} ₽ с #${fromWallet} на #${toWallet} выполнен!\nНовый баланс:\n• ${fromWallet}: ${newBalances[fromWallet].toFixed(2)} ₽\n• ${toWallet}: ${newBalances[toWallet].toFixed(2)} ₽`, menuKeyboard());
}

module.exports = { handleTransfer };
