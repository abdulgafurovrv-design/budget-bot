const { transactionsSheet, debtsSheet } = global;
const { mainKeyboard, cancelLastKeyboard, menuKeyboard } = require('./keyboards');
const { normWallet, extractWallet, parseFreeInput } = require('./utils');

const DEFAULT_WALLET = "карта";
const DEFAULT_ISSUE_WALLET = "карта";
const DEFAULT_RETURN_WALLET = "карта";

async function getBalance() {
  const rows = await transactionsSheet.getRows();
  const balances = { "карта": 0, "наличка": 0, "евро": 0, "доллары": 0, "депозит": 0, "долги": 0 };

  rows.forEach(row => {
    const w = normWallet(row.get('Кошелёк') || DEFAULT_WALLET);
    if (w === "долги") return;
    const sum = Number(row.get('Сумма')) || 0;
    balances[w] += sum;
  });

  const debtRows = await debtsSheet.getRows();
  let debtTotal = 0;
  debtRows.forEach(row => {
    const amt = Number(row.get('Сумма')) || 0;
    debtTotal += amt > 0 ? amt : 0;
  });
  balances["долги"] = debtTotal;

  return balances;
}

function helpText_() {
  return "<b>Привет! Я твой бюджет-бот 🚀</b>\n\n" +
         "Теперь я работаю мгновенно на Render!\n\n" +
         "<b>Кошельки:</b> Карта, Наличка, Евро, Доллары, Депозит, Долги\n\n" +
         "<b>Свободный ввод:</b>\n" +
         "• 500 кофе #карта\n" +
         "• +10000 зарплата\n" +
         "• дал Иван 500\n" +
         "• вернули Иван 200\n" +
         "• добавить долг Петр 1500\n\n" +
         "<b>Команды:</b>\n" +
         "/баланс — остатки + ИТОГ\n" +
         "/отчет — последние транзакции\n" +
         "/debtors — должники\n" +
         "/остаток карта 50000 — начальный остаток\n" +
         "/перевод 10000 карта депозит — перевод\n" +
         "/удалить 5 — удалить по ID\n\n" +
         "Кнопки — в меню после /start";
}

async function handleText(ctx) {
  const chatId = ctx.chat.id;
  const text = ctx.message.text.trim();
  const lowerText = text.toLowerCase();

  if (text === "/start" || text === "/help") {
    ctx.reply(helpText_(), mainKeyboard());
    return;
  }

  if (text === "/баланс") {
    const balances = await getBalance();
    let msg = "<b>Баланс по кошелькам:</b>\n\n";

    const mainWallets = ["карта", "наличка", "депозит", "долги"];
    let total = 0;

    mainWallets.forEach(w => {
      const bal = balances[w] || 0;
      total += bal;
      msg += `• ${w.charAt(0).toUpperCase() + w.slice(1)}: ${bal.toFixed(2)} ₽\n`;
    });

    msg += `\n• Евро: ${(balances["евро"] || 0).toFixed(2)} ₽\n`;
    msg += `• Доллары: ${(balances["доллары"] || 0).toFixed(2)} ₽\n`;

    msg += `\n<b>ИТОГ (основные):</b> ${total.toFixed(2)} ₽`;

    ctx.reply(msg, menuKeyboard());
    return;
  }

  // Добавь остальные команды (отчет, должники, остаток, перевод, долги, свободный ввод) — как в твоём предыдущем Logic.gs

  ctx.reply("Команда в разработке 😅", mainKeyboard());
}

function handleCallback(ctx) {
  const data = ctx.callbackQuery.data;
  if (data === "balance") {
    handleText(ctx);
  } // и т.д.

  ctx.answerCbQuery();
}

module.exports = { handleText, handleCallback };
