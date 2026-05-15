
// cancel.js
const { transactionsSheet, doc } = global;
const { menuKeyboard } = require('./keyboards');
const { getBalance } = require('./balance');
const { lastOperations } = require('./transaction');

async function handleCancelLast(ctx) {
  try {
    await ctx.answerCbQuery();

    const chatId = ctx.chat.id;
    const last = lastOperations.get(chatId);

    if (!last || !last.id) {
      return ctx.reply('Нет операции для отмены', menuKeyboard());
    }

    await doc.loadInfo();
    const rows = await transactionsSheet.getRows();

    const rowToDelete = rows.find(row => {
      return String(row.get('ID')) === String(last.id);
    });

    if (!rowToDelete) {
      lastOperations.delete(chatId);
      return ctx.reply('Операция уже не найдена в таблице. Возможно, она была удалена ранее.', menuKeyboard());
    }

    const amount = Number(rowToDelete.get('Сумма')) || 0;
    const category = rowToDelete.get('Категория') || '';
    const wallet = rowToDelete.get('Кошелёк') || '';
    const type = rowToDelete.get('Тип') || '';

    await rowToDelete.delete();

    lastOperations.delete(chatId);

    const balances = await getBalance();
    const walletBalance = balances[wallet] || 0;
    const totalMain = balances.карта + balances.наличка + balances.депозит + balances.долги;

    const absAmount = Math.abs(amount);

    const message =
      `Последняя операция отменена ✅\n\n` +
      `Удалено: ${type} ${absAmount.toFixed(2)} ₽ — ${category}\n` +
      `Кошелёк: #${wallet}\n\n` +
      `Текущий баланс кошелька: ${walletBalance.toFixed(2)} ₽\n` +
      `Общий итог (основные): ${totalMain.toFixed(2)} ₽`;

    return ctx.reply(message, menuKeyboard());

  } catch (error) {
    console.error('Ошибка отмены операции:', error);
    return ctx.reply('Ошибка отмены операции ❌', menuKeyboard());
  }
}

module.exports = { handleCancelLast };
