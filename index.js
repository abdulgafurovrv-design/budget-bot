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
  console.log('Таблица подключена:', doc.title);
}

initDoc().catch(err => console.error('Ошибка подключения к таблице:', err));

let transactionsSheet, debtsSheet;

async function initSheets() {
  await doc.loadInfo();
  let sheet = doc.sheetsByTitle['Transactions'];
  if (!sheet) {
    sheet = await doc.addSheet({ title: 'Transactions', headerValues: ['ID', 'Дата', 'Тип', 'Сумма', 'Категория', 'Комментарий', 'Кошелёк'] });
  }
  transactionsSheet = sheet;

  sheet = doc.sheetsByTitle['Debts'];
  if (!sheet) {
    sheet = await doc.addSheet({ title: 'Debts', headerValues: ['ID', 'Дата', 'Должник', 'Сумма', 'Тип', 'Коммент'] });
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

// === Основная логика (handleText) ===
bot.on('text', async (ctx) => {
  const chatId = ctx.chat.id;
  const text = ctx.message.text.trim();
  const lowerText = text.toLowerCase();

  if (text === "/start") {
    ctx.reply("Привет! Я твой бюджет-бот 🚀\n\nТеперь я работаю мгновенно на Render!", mainKeyboard());
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

  // Добавь остальные команды (отчет, должники, остаток, перевод, долги, свободный ввод) — как в твоём GAS-коде
  // Я пришлю полный в следующем сообщении

  ctx.reply("Команда в разработке 😅\nНапиши /start для меню", mainKeyboard());
});

// === Обработка кнопок ===
bot.action('balance', async (ctx) => {
  // Вызов /баланс
  await ctx.answerCbQuery();
  // Логика баланса (дублируем или вызываем функцию)
});

bot.action('cancel_last', async (ctx) => {
  await ctx.answerCbQuery("Отмена — в разработке 😅");
});

bot.launch();
console.log('Бот запущен на Telegraf + Render!');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
