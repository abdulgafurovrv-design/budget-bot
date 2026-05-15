const { menuKeyboard } = require('./keyboards');
const { getBalance } = require('./balance');
const { lastOperations } = require('./transaction');

async function deleteRowsByIds(sheet, ids) {
  if (!ids || ids.length === 0) return [];

  const rows = await sheet.getRows();
  const deleted = [];

  for (const id of ids) {
    const row = rows.find(r => String(r.get('ID')) === String(id));

    if (row) {
      deleted.push({
        id,
        type: row.get('Тип') || '',
        amount: Number(row.get('Сумма')) || 0,
        category: row.get('Категория') || '',
        wallet: row.get('Кошелёк') || '',
        debtor: row.get('Должник') || ''
      });

      await row.delete();
    }
  }

  return deleted;
}

async function handleCancelLast(ctx) {
  try {
    await ctx.answerCbQuery();

    const chatId = ctx.chat.id;
    const last = lastOperations.get(chatId);

    if (!last) {
      return ctx.reply('Нет операции для отмены', menuKeyboard());
    }

    const transactionsSheet = global.transactionsSheet;
    const debtsSheet = global.debtsSheet;

    if (!transactionsSheet || !debtsSheet) {
      return ctx.reply('Ошибка: таблицы не инициализированы', menuKeyboard());
    }

    // Обычная транзакция: кофе, сигареты, зарплата и т.д.
    if (last.type === 'trans') {
      const deletedTransactions = await deleteRowsByIds(transactionsSheet, [last.id]);

      lastOperations.delete(chatId);

      if (deletedTransactions.length === 0) {
        return ctx.reply(
          'Операция уже не найдена в таблице. Возможно, она была удалена ранее.',
          menuKeyboard()
        );
      }

      const deleted = deletedTransactions[0];

      const balances = await getBalance();
      const wallet = deleted.wallet;
      const walletBalance = balances[wallet] || 0;
      const totalMain =
        (balances.карта || 0) +
        (balances.наличка || 0) +
        (balances.депозит || 0) +
        (balances.долги || 0);

      return ctx.reply(
        `Последняя операция отменена ✅\n\n` +
        `Удалено: ${deleted.type} ${Math.abs(deleted.amount).toFixed(2)} ₽ — ${deleted.category}\n` +
        `Кошелёк: #${wallet}\n\n` +
        `Текущий баланс кошелька: ${walletBalance.toFixed(2)} ₽\n` +
        `Общий итог (основные): ${totalMain.toFixed(2)} ₽`,
        menuKeyboard()
      );
    }

    // Долговые операции: дал, вернули, добавить долг
    if (
      last.type === 'debt_lend' ||
      last.type === 'debt_return' ||
      last.type === 'debt_opening'
    ) {
      const deletedTransactions = await deleteRowsByIds(
        transactionsSheet,
        last.transactionIds || []
      );

      const deletedDebts = await deleteRowsByIds(
        debtsSheet,
        last.debtIds || []
      );

      lastOperations.delete(chatId);

      if (deletedTransactions.length === 0 && deletedDebts.length === 0) {
        return ctx.reply(
          'Долговая операция уже не найдена в таблице. Возможно, она была удалена ранее.',
          menuKeyboard()
        );
      }

      const balances = await getBalance();
      const wallet = last.wallet;
      const walletBalance = wallet ? (balances[wallet] || 0) : 0;
      const totalMain =
        (balances.карта || 0) +
        (balances.наличка || 0) +
        (balances.депозит || 0) +
        (balances.долги || 0);

      let operationName = 'долговая операция';

      if (last.type === 'debt_lend') {
        operationName = 'выдача долга';
      }

      if (last.type === 'debt_return') {
        operationName = 'возврат долга';
      }

      if (last.type === 'debt_opening') {
        operationName = 'начальный долг';
      }

      let message =
        `Последняя долговая операция отменена ✅\n\n` +
        `Удалено: ${operationName}\n` +
        `Должник: ${last.debtor}\n` +
        `Сумма: ${Number(last.amount).toFixed(2)} ₽\n`;

      if (wallet) {
        message += `Кошелёк: #${wallet}\n\n`;
        message += `Текущий баланс кошелька: ${walletBalance.toFixed(2)} ₽\n`;
      } else {
        message += `\n`;
      }

      message +=
        `Итого долгов: ${(balances.долги || 0).toFixed(2)} ₽\n` +
        `Общий итог (основные): ${totalMain.toFixed(2)} ₽`;

      return ctx.reply(message, menuKeyboard());
    }

    return ctx.reply('Неизвестный тип операции для отмены', menuKeyboard());

  } catch (error) {
    console.error('Ошибка отмены операции:', error);
    return ctx.reply('Ошибка отмены операции ❌', menuKeyboard());
  }
}

module.exports = { handleCancelLast };
