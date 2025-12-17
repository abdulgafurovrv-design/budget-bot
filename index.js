const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const BOT_TOKEN = '8269910739:AAEywu7dOX8WB9TDG6y8WH-fAoV5_foRhzU';
const SHEET_ID = '1qu5qJSv1jVZAU5yBbHC0AlC07udvv869SIarN3qdkzs';

const bot = new Telegraf(BOT_TOKEN);
const app = express();
app.use(express.json());

let transactionsSheet, debtsSheet;
const DEFAULT_WALLET = 'карта';

const lastOperations = new Map(); // chatId → { type: 'trans'|'debt', id }

// === Клавиатуры ===
function mainKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Баланс', 'balance'), Markup.button.callback('Отчёт', 'report')],
    [Markup.button.callback('Должники', 'debtors'), Markup.button.callback('Перевод', 'transfer')],
    [Markup.button.callback('Расход +', 'expense'), Markup.button.callback('Доход +', 'income')]
  ]);
}

function menuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Меню', 'menu')]
  ]);
}

function cancelLastKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Отменить последнюю', 'cancel_last')]
  ]);
}

// === Утилиты ===
function normWallet(w) {
  w = String(w || '').toLowerCase().trim();
  if (/^нал/.test(w)) return 'наличка';
  if (/^карт/.test(w)) return 'карта';
  if (/^евро/.test(w)) return 'евро';
  if (/^доллар|бакс|usd/.test(w)) return 'доллары';
  if (/^деп|вклад/.test(w)) return 'депозит';
  if (/^долг/.test(w)) return 'долги';
  return w || DEFAULT_WALLET;
}

function extractWallet(text) {
  const m = text.match(/#([а-яa-z0-9_]+)/i);
  if (m) {
    return { wallet: normWallet(m[1]), cleaned: text.replace(m[0], '').trim() };
  }
  return { wallet: DEFAULT_WALLET, cleaned: text };
}

// === Баланс ===
async function getBalance() {
  const transRows = await transactionsSheet.getRows();
  const balances = { карта: 0, наличка: 0, евро: 0, доллары: 0, депозит: 0, долги: 0 };

  transRows.forEach(row => {
    const wallet = normWallet(row.get('Кошелёк') || DEFAULT_WALLET);
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

async function sendBalance(ctx) {
  const balances = await getBalance();
  let msg = '<b>Баланс по кошелькам:</b>\n\n';
  const mainWallets = ['карта', 'наличка', 'депозит', 'долги'];
  let total = 0;

  mainWallets.forEach(w => {
    const bal = balances[w] || 0;
    if (w !== 'долги') total += bal;
    msg += `• ${w.charAt(0).toUpperCase() + w.slice(1)}: ${bal.toFixed(2)} ₽\n`;
  });

  msg += `\n• Евро: ${balances.евро.toFixed(2)} ₽\n`;
  msg += `• Доллары: ${balances.доллары.toFixed(2)} ₽\n`;
  msg += `\n<b>ИТОГ (основные):</b> ${total.toFixed(2)} ₽`;

  const keyboard = ctx.callbackQuery ? menuKeyboard() : mainKeyboard();
  await ctx.replyWithHTML(msg, keyboard);
}

// === Должники ===
async function getDebtorsList() {
  const debtRows = await debtsSheet.getRows();
  const debtors = {};

  debtRows.forEach(row => {
    const debtor = row.get('Должник')?.trim();
    if (!debtor) return;
    const amount = Number(row.get('Сумма')) || 0;
    debtors[debtor] = (debtors[debtor] || 0) + amount;
  });

  const list = Object.entries(debtors)
    .filter(([_, amt]) => amt > 0)
    .map(([debtor, amt]) => ({ debtor, amount: amt }))
    .sort((a, b) => b.amount - a.amount);

  const total = list.reduce((sum, d) => sum + d.amount, 0);
  return { list, total };
}

async function sendDebtors(ctx) {
  const { list, total } = await getDebtorsList();

  let msg;
  if (list.length === 0) {
    msg = 'Нет должников 😎';
  } else {
    msg = '<b>Список должников:</b>\n\n';
    list.forEach(d => {
      msg += `• ${d.debtor}: ${d.amount.toFixed(2)} ₽\n`;
    });
    msg += `\n<b>Всего должны:</b> ${total.toFixed(2)} ₽`;
  }

  const keyboard = ctx.callbackQuery ? menuKeyboard() : mainKeyboard();
  await ctx.replyWithHTML(msg, keyboard);
}

// === Приветствие ===
function helpText() {
  return `<b>Привет! Я твой бюджет-бот 🚀</b>

Работаю мгновенно!

<b>Готово:</b>
• Свободный ввод
• Отмена последней
• Баланс
• Должники

Скоро: отчёт, переводы и остатки.

Нажми кнопки 👇`;
}

// === Добавление транзакции и долга ===
async function addTransaction(type, amount, category, comment = '', wallet = DEFAULT_WALLET) {
  const date = new Date().toLocaleString('ru-RU');
  const sign = type === 'доход' ? amount : -amount;
  wallet = normWallet(wallet);

  const rows = await transactionsSheet.getRows();
  let maxId = 0;
  rows.forEach(r => { const id = Number(r.get('ID')) || 0; if (id > maxId) maxId = id; });
  const id = maxId + 1;

  await transactionsSheet.addRow({ ID: id, Дата: date, Тип: type, Сумма: sign, Категория: category, Комментарий: comment, Кошелёк: wallet });
  return { id };
}

async function addDebt(type, debtor, amount, comment = '') {
  const date = new Date().toLocaleString('ru-RU');
  const sign = (type === 'issue' || type === 'opening') ? amount : -amount;

  const rows = await debtsSheet.getRows();
  let maxId = 0;
  rows.forEach(r => { const id = Number(r.get('ID')) || 0; if (id > maxId) maxId = id; });
  const id = maxId + 1;

  await debtsSheet.addRow({ ID: id, Дата: date, Должник: debtor, Сумма: sign, Тип: type, Коммент: comment });
  return { id };
}

// === Парсер ===
function parseFreeInput(text) {
  // ... (оставляем тот же парсер, что был раньше — он работает)
  // Если нужно — могу повторить, но он уже есть в твоём коде
  // (чтобы не удлинять — предполагаем, что он остался)
}

// === Запуск ===
(async () => {
  try {
    const serviceAccountAuth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();

    let sheet = doc.sheetsByTitle['Transactions'];
    if (!sheet) sheet = await doc.addSheet({ title: 'Transactions', headerValues: ['ID', 'Дата', 'Тип', 'Сумма', 'Категория', 'Комментарий', 'Кошелёк'] });
    transactionsSheet = sheet;

    sheet = doc.sheetsByTitle['Debts'];
    if (!sheet) sheet = await doc.addSheet({ title: 'Debts', headerValues: ['ID', 'Дата', 'Должник', 'Сумма', 'Тип', 'Коммент'] });
    debtsSheet = sheet;

    console.log('Google Sheets подключены');

    bot.start((ctx) => ctx.replyWithHTML(helpText(), mainKeyboard()));
    bot.help((ctx) => ctx.replyWithHTML(helpText(), mainKeyboard()));
    bot.command('баланс', sendBalance);
    bot.command('debtors', sendDebtors);

    bot.action('balance', sendBalance);
    bot.action('debtors', sendDebtors);
    bot.action('menu', async (ctx) => {
      await ctx.editMessageText('Главное меню', { reply_markup: mainKeyboard().reply_markup });
      await ctx.answerCbQuery();
    });

    bot.action('cancel_last', async (ctx) => {
      // ... (код отмены из предыдущего сообщения)
    });

    // Остальные заглушки и свободный ввод — как было

    bot.catch((err) => console.error('Bot error:', err));

    app.use(bot.webhookCallback(`/bot${BOT_TOKEN}`));
    app.get('/', (req, res) => res.send('Бюджет-бот жив! 🚀'));

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Сервер запущен на порту ${PORT}`);
    });

  } catch (error) {
    console.error('Ошибка запуска:', error);
  }
})();
