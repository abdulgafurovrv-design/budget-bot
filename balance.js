// balance.js
const { transactionsSheet, debtsSheet } = global;
const { mainKeyboard, menuKeyboard } = require('./keyboards');
const { normWallet } = require('./utils');

async function getBalance() {
  const transRows = await transactionsSheet.getRows();
  const balances = {
    карта: 0,
    наличка: 0,
    евро: 0,
    доллары: 0,
    депозит: 0,
    долги: 0
  };

  transRows.forEach(row => {
    const wallet = normWallet(row.get('Кошелёк') || 'карта');
    if (wallet === 'долги') return;
    balances[wallet] += Number(row.get('Сумма')) || 0;
  });

  const debtRows = await debtsSheet.getRows();
  const debtTotal = debtRows.reduce((sum, row) => {
    const amount = Number(row.get('Сумма')) || 0;
    return sum + (amount > 0 ? amount : 0);
  }, 0);

  balances.долги = debtTotal;
  return balances;
}

// balance.js — исправленный sendBalance
async function sendBalance(ctx) {
  const balances = await getBalance();

  let msg = '<b>Баланс по кошелькам:</b>\n\n';

  const mainWallets = ['карта', 'наличка', 'депозит', 'долги'];
  let totalMain = 0;

  mainWallets.forEach(w => {
    const bal = balances[w] || 0;
    totalMain += bal;  // ← теперь долги тоже входят в итог
    msg += `• ${w.charAt(0).toUpperCase() + w.slice(1)}: ${bal.toFixed(2)} ₽\n`;
  });

  msg += `\n• Евро: ${balances.евро.toFixed(2)} ₽\n`;
  msg += `• Доллары: ${balances.доллары.toFixed(2)} ₽\n`;
  msg += `\n<b>ИТОГ (основные):</b> ${totalMain.toFixed(2)} ₽`;

  const keyboard = ctx.callbackQuery ? menuKeyboard() : mainKeyboard();
  await ctx.replyWithHTML(msg, keyboard);
}

module.exports = { sendBalance, getBalance };
