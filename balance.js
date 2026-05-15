// balance.js
const { transactionsSheet, debtsSheet, doc } = global;
const { mainKeyboard, menuKeyboard } = require('./keyboards');
const { normWallet } = require('./utils');

async function getBalance() {
  await doc.loadInfo();

  const transRows = await transactionsSheet.getRows();

  const balances = {
    карта: 0,
    наличка: 0,
    депозит: 0,
    зарубежная_карта: 0,
    долги: 0,
    евро: 0,
    доллары: 0,
    totalMain: 0
  };

  transRows.forEach(row => {
    const wallet = normWallet(row.get('Кошелёк') || 'карта');
    const amount = Number(row.get('Сумма')) || 0;

    if (!Object.prototype.hasOwnProperty.call(balances, wallet)) {
      return;
    }

    if (wallet === 'долги') {
      return;
    }

    balances[wallet] += amount;
  });

  await doc.loadInfo();

  const debtRows = await debtsSheet.getRows();

  const debtByPerson = {};

  debtRows.forEach(row => {
    const debtor = String(row.get('Должник') || '').trim();
    const amount = Number(row.get('Сумма')) || 0;

    if (!debtor) {
      return;
    }

    if (!debtByPerson[debtor]) {
      debtByPerson[debtor] = 0;
    }

    debtByPerson[debtor] += amount;
  });

  balances.долги = Object.values(debtByPerson).reduce((sum, amount) => {
    return sum + (amount > 0 ? amount : 0);
  }, 0);

  balances.totalMain =
    balances.карта +
    balances.наличка +
    balances.депозит +
    balances.зарубежная_карта +
    balances.долги;

  return balances;
}

async function sendBalance(ctx) {
  const balances = await getBalance();

  let msg = '<b>Баланс по кошелькам:</b>\n\n';

  msg += `• Карта: ${balances.карта.toFixed(2)} ₽\n`;
  msg += `• Наличка: ${balances.наличка.toFixed(2)} ₽\n`;
  msg += `• Депозит: ${balances.депозит.toFixed(2)} ₽\n`;
  msg += `• Зарубежная карта: ${balances.зарубежная_карта.toFixed(2)} ₽\n`;
  msg += `• Долги: ${balances.долги.toFixed(2)} ₽\n`;

  msg += `\n• Евро: ${balances.евро.toFixed(2)} ₽\n`;
  msg += `• Доллары: ${balances.доллары.toFixed(2)} ₽\n`;

  msg += `\n<b>ИТОГ (основные):</b> ${balances.totalMain.toFixed(2)} ₽`;

  const keyboard = ctx.callbackQuery ? menuKeyboard() : mainKeyboard();

  await ctx.replyWithHTML(msg, keyboard);
}

module.exports = {
  sendBalance,
  getBalance
};
