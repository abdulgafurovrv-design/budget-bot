const { Telegraf, Markup } = require('telegraf');
const { GoogleSpreadsheet } = require('google-spreadsheet');

const TOKEN = '8269910739:AAEywu7dOX8WB9TDG6y8WH-fAoV5_foRhzU';
const SHEET_ID = '1qu5qJSv1jVZAU5yBbHC0AlC07udvv869SIarN3qdkzs';

const bot = new Telegraf(TOKEN);
const doc = new GoogleSpreadsheet(SHEET_ID);

async function initDoc() {
  await doc.useServiceAccountAuth({
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  });
  await doc.loadInfo();
}

initDoc().catch(err => console.error('Ошибка подключения к таблице:', err));

let transactionsSheet, debtsSheet;

async function initSheets() {
  await doc.loadInfo();

  let sheet = doc.sheetsByTitle['Transactions'];
  if (!sheet) {
    sheet = await doc.addSheet({
      title: 'Transactions',
      headerValues: ['ID', 'Дата', 'Тип', 'Сумма', 'Категория', 'Комментарий', 'Кошелёк']
    });
  }
  transactionsSheet = sheet;

  sheet = doc.sheetsByTitle['Debts'];
  if (!sheet) {
    sheet = await doc.addSheet({
      title: 'Debts',
      headerValues: ['ID', 'Дата', 'Должник', 'Сумма', 'Тип', 'Коммент']
    });
  }
  debtsSheet = sheet;
}

initSheets();

// === Константы ===
const WALLETS = ["карта", "наличка", "евро", "доллары", "депозит", "долги"];
const DEFAULT_WALLET = "карта";
const DEFAULT_ISSUE_WALLET = "карта";
const DEFAULT_RETURN_WALLET = "карта";

// === Утилиты ===
function normWallet(w) {
  w = String(w || "").toLowerCase().trim();
  if (/^нал/.test(w)) return "наличка";
  if (/^карт/.test(w)) return "карта";
  if (/^евро/.test(w)) return "евро";
  if (/^доллар|бакс|usd/.test(w)) return "доллары";
  if (/^деп|вклад/.test(w)) return "депозит";
  if (/^долг/.test(w)) return "долги";
  return w || DEFAULT_WALLET;
}

function extractWallet(text) {
  const m = text.match(/#([а-яa-z0-9_]+)/i);
  if (m) {
    const wallet = normWallet(m[1]);
    const cleaned = text.replace(m[0], "").trim();
    return { wallet, cleaned };
  }
  return { wallet: DEFAULT_WALLET, cleaned: text };
}

// === Кнопки ===
function mainKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Баланс", "balance"), Markup.button.callback("Отчёт", "report")],
    [Markup.button.callback("Должники", "debtors"), Markup.button.callback("Перевод", "transfer")],
    [Markup.button.callback("Расход +", "expense"), Markup.button.callback("Доход +", "income")]
  ]);
}

function cancelLastKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Отменить последнюю", "cancel_last")]
  ]);
}

function menuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Меню", "menu")]
  ]);
}

// === Баланс ===
async function getBalance() {
  const rows = await transactionsSheet.getRows();
  const balances = {};
  WALLETS.forEach(w => balances[w] = 0);

  rows.forEach(row => {
    const w = normWallet(row.get('Кошелёк') || DEFAULT_WALLET);
    if (w === "долги") return;
    const sum = Number(row.get('Сумма')) || 0;
    balances[w] += sum;
  });

  // Долги из отдельного листа
  const debtRows = await debtsSheet.getRows();
  let debtTotal = 0;
  debtRows.forEach(row => {
    const amt = Number(row.get('Сумма')) || 0;
    debtTotal += amt > 0 ? amt : 0;
  });
  balances["долги"] = debtTotal;

  return balances;
}

// === Должники ===
async function getDebtorsList() {
  const rows = await debtsSheet.getRows();
  const balances = {};
  rows.forEach(row => {
    const debtor = row.get('Должник').toLowerCase();
    if (!balances[debtor]) balances[debtor] = 0;
    balances[debtor] += Number(row.get('Сумма')) || 0;
  });

  const list = [];
  Object.keys(balances).forEach(key => {
    if (balances[key] > 0) {
      list.push({ debtor: key.charAt(0).toUpperCase() + key.slice(1), amount: balances[key] });
    }
  });
  list.sort((a, b) => b.amount - a.amount);
  return list;
}

// === Отчёт ===
async function getReport() {
  const rows = await transactionsSheet.getRows();
  if (rows.length === 0) return "Нет транзакций";
  let report = "Последние 10 транзакций:\n\n";
  const start = Math.max(0, rows.length - 10);
  for (let i = start; i < rows.length; i++) {
    const row = rows[i];
    const sign = row.get('Тип') === "доход" ? "+" : "-";
    report += `ID:${row.get('ID')} | ${row.get('Дата')} | ${row.get('Категория')} | ${sign}${Math.abs(row.get('Сумма'))} ₽ | #${row.get('Кошелёк')}${row.get('Комментарий') ? " (" + row.get('Комментарий') + ")" : ""}\n`;
  }
  return report;
}

// === Добавление транзакции ===
async function addTransaction(type, amount, category, comment = "", wallet = DEFAULT_WALLET) {
  const rows = await transactionsSheet.getRows();
  let maxId = 0;
  rows.forEach(row => {
    const id = Number(row.get('ID')) || 0;
    if (id > maxId) maxId = id;
  });
  const id = maxId + 1;

  const sign = type === "доход" ? amount : -amount;
  wallet = normWallet(wallet);

  await transactionsSheet.addRow({
    ID: id,
    Дата: new Date().toLocaleString("ru-RU"),
    Тип: type,
    Сумма: sign,
    Категория: category,
    Комментарий: comment,
    Кошелёк: wallet
  });
}

// === Добавление долга ===
async function addDebt(type, debtor, amount, comment = "") {
  const rows = await debtsSheet.getRows();
  let maxId = 0;
  rows.forEach(row => {
    const id = Number(row.get('ID')) || 0;
    if (id > maxId) maxId = id;
  });
  const id = maxId + 1;

  const sign = type === "issue" || type === "opening" ? amount : -amount;

  await debtsSheet.addRow({
    ID: id,
    Дата: new Date().toLocaleString("ru-RU"),
    Должник: debtor,
    Сумма: sign,
    Тип: type,
    Коммент: comment
  });
}

// === Обработка сообщений ===
bot.on('text', async (ctx) => {
  const chatId = ctx.chat.id;
  const text = ctx.message.text.trim();
  const lowerText = text.toLowerCase();

  if (text === "/start") {
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

  if (text === "/отчет") {
    ctx.reply(await getReport(), menuKeyboard());
    return;
  }

  if (text === "/debtors") {
    const list = await getDebtorsList();
    if (list.length === 0) {
      ctx.reply("Нет должников 😎", menuKeyboard());
    } else {
      let msg = "<b>Список должников:</b>\n\n";
      list.forEach(d => {
        msg += `• ${d.debtor}: ${d.amount.toFixed(2)} ₽\n`;
      });
      ctx.reply(msg, menuKeyboard());
    }
    return;
  }

  // Остальные команды (остаток, перевод, долги, свободный ввод) — добавь как в твоём Logic.gs

  ctx.reply("Не понял команду 😅\nНапиши /start для меню", mainKeyboard());
});

// === Обработка кнопок ===
bot.action(/balance|report|debtors|menu|cancel_last/, async (ctx) => {
  const data = ctx.match[0];
  if (data === "balance") ctx.reply(await getBalanceText(), menuKeyboard());
  else if (data === "report") ctx.reply(await getReport(), menuKeyboard());
  else if (data === "debtors") ctx.reply(await getDebtorsText(), menuKeyboard());
  else if (data === "menu") ctx.reply("Главное меню", mainKeyboard());
  else if (data === "cancel_last") ctx.reply("Отмена — в разработке 😅");
  await ctx.answerCbQuery();
});

bot.launch();
console.log('Бот запущен на Telegraf + Render!');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
