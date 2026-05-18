// balance.js
const { transactionsSheet, debtsSheet, doc } = global;
const { mainKeyboard, menuKeyboard } = require('./keyboards');
const { normWallet } = require('./utils');
const { formatMoney } = require('./formatters');

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

  // Основной итог считаем только в рублях
  // Зарубежная карта, доллары и евро сюда не входят
  balances.totalMain =
    balances.карта +
    balances.наличка +
    balances.депозит +
    balances.долги;

  return balances;
}

async function sendBalance(ctx) {
  const balances = await getBalance();

  let msg = '<b>💰 Баланс</b>\n\n';

  msg += '<b>🇷🇺 Рубли</b>\n';
  msg += `💳 Карта: ${formatMoney(balances.карта, '₽')}\n`;
  msg += `💵 Наличка: ${formatMoney(balances.наличка, '₽')}\n`;
  msg += `🏦 Депозит: ${formatMoney(balances.депозит, '₽')}\n`;
  msg += `🤝 Долги: ${formatMoney(balances.долги, '₽')}\n`;

  msg += `\n<b>ИТОГО ₽:</b> ${formatMoney(balances.totalMain, '₽')}\n`;

  msg += '\n<b>🌍 Валюта</b>\n';
  msg += `💳 Зарубежная карта: ${formatMoney(balances.зарубежная_карта, '$')}\n`;
  msg += `💵 Доллары: ${formatMoney(balances.доллары, '$')}\n`;
  msg += `💶 Евро: ${formatMoney(balances.евро, '€')}`;

  const keyboard = ctx.callbackQuery ? menuKeyboard() : mainKeyboard();

  await ctx.replyWithHTML(msg, keyboard);
}

module.exports = {
  sendBalance,
  getBalance
};
