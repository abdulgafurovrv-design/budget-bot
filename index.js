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

// === Список должников ===
async function getDebtorsList() {
  const debtRows = await debtsSheet.getRows();
  const debtors = {};

  debtRows.forEach(row => {
    const debtor = row.get('Должник');
    if (!debtor) return;
    const amount = Number(row.get('Сумма')) || 0;
    const normalizedDebtor = debtor.trim();
    debtors[normalizedDebtor] = (debtors[normalizedDebtor] || 0) + amount;
  });

  // Фильтруем только положительные долги и сортируем по убыванию
  const list = Object.entries(debtors)
    .filter(([_, amount]) => amount > 0)
    .map(([debtor, amount]) => ({ debtor, amount }))
    .sort((a, b) => b.amount - a.amount);

  const total = list.reduce((sum, d) => sum + d.amount, 0);

  return { list, total };
}

async function sendDebtors(ctx) {
  const { list, total } = await getDebtorsList();

  let msg;
  if (list.length === 0) {
    msg = 'Нет должников 😎';
    await ctx.reply(msg, menuKeyboard());
    return;
  }

  msg = '<b>Список должников:</b>\n\n';
  list.forEach(d => {
    msg += `• ${d.debtor}: ${d.amount.toFixed(2)} ₽\n`;
  });
  msg += `\n<b>Всего должны:</b> ${total.toFixed(2)} ₽`;

  const keyboard = ctx.callbackQuery ? menuKeyboard() : mainKeyboard();
  await ctx.replyWithHTML(msg, keyboard);
}

// === Приветствие ===
function helpText() {
  return `<b>Привет! Я твой бюджет-бот 🚀</b>

Теперь работаю мгновенно!

<b>Свободный ввод работает:</b>
• 500 кофе #карта
• +10000 зарплата
• дал Иван 500
• вернули Иван 200
• добавить долг Петр 1500 ремонт

После добавления — кнопка отмены последней операции.

Нажми кнопки ниже 👇`;
}

// === Добавление транзакции ===
async function addTransaction(type, amount, category, comment = '', wallet = DEFAULT_WALLET) {
  const date = new Date().toLocaleString('ru-RU');
  const sign = type === 'доход' ? amount : -amount;
  wallet = normWallet(wallet);

  const rows = await transactionsSheet.getRows();
  let maxId = 0;
  rows.forEach(r => { const id = Number(r.get('ID')) || 0; if (id > maxId) maxId = id; });
  const id = maxId + 1;

  await transactionsSheet.addRow({ ID: id, Дата: date, Тип: type, Сумма: sign, Категория: category, Комментарий: comment, Кошелёк: wallet });
  return { id, type, amount: Math.abs(amount), category, comment, wallet };
}

// === Добавление долга ===
async function addDebt(type, debtor, amount, comment = '') {
  const date = new Date().toLocaleString('ru-RU');
  const sign = (type === 'issue' || type === 'opening') ? amount : -amount;

  const rows = await debtsSheet.getRows();
  let maxId = 0;
  rows.forEach(r => { const id = Number(r.get('ID')) || 0; if (id > maxId) maxId = id; });
  const id = maxId + 1;

  await debtsSheet.addRow({ ID: id, Дата: date, Должник: debtor, Сумма: sign, Тип: type, Коммент: comment });
  return { id, type, debtor, amount: Math.abs(amount), comment };
}

// === Парсер свободного ввода ===
function parseFreeInput(text) {
  const lower = text.toLowerCase();

  // Долги
  if (lower.startsWith('дал ') || lower.startsWith('выдал ')) {
    const parts = text.split(' ');
    if (parts.length < 3) return null;
    const debtor = parts[1].charAt(0).toUpperCase() + parts[1].slice(1).toLowerCase();
    const amount = parseFloat(parts[2]);
    const comment = parts.slice(3).join(' ');
    if (isNaN(amount) || amount <= 0) return null;
    return { action: 'lend', debtor, amount, comment };
  }

  if (lower.startsWith('вернули ') || lower.startsWith('вернул ')) {
    const parts = text.split(' ');
    if (parts.length < 3) return null;
    const debtor = parts[1].charAt(0).toUpperCase() + parts[1].slice(1).toLowerCase();
    const amount = parseFloat(parts[2]);
    const comment = parts.slice(3).join(' ');
    if (isNaN(amount) || amount <= 0) return null;
    return { action: 'return_debt', debtor, amount, comment };
  }

  if (lower.startsWith('добавить долг ')) {
    const rest = text.slice(13).trim();
    const words = rest.split(' ');
    let amountIndex = -1;
    let amount = 0;
    for (let i = 0; i < words.length; i++) {
      amount = parseFloat(words[i]);
      if (!isNaN(amount)) { amountIndex = i; break; }
    }
    if (amountIndex <= 0 || amount <= 0) return null;
    const debtor = words.slice(0, amountIndex).join(' ').replace(/^\w/, c => c.toUpperCase());
    const comment = words.slice(amountIndex + 1).join(' ');
    return { action: 'opening_debt', debtor, amount, comment };
  }

  // Транзакции
  const { wallet, cleaned } = extractWallet(text);
  const words = cleaned.split(/\s+/);
  let amount = 0, amountIndex = -1;
  for (let i = 0; i < words.length; i++) {
    const num = parseFloat(words[i].replace('+', ''));
    if (!isNaN(num) && num > 0) { amount = num; amountIndex = i; break; }
  }
  if (amountIndex === -1 || amount <= 0) return null;

  const hasPlus = text.includes('+') || /зарплат|зп|аванс|кешбэк|подарок|премия/i.test(lower);
  const kind = hasPlus ? 'доход' : 'расход';

  const categoryWords = [...words];
  categoryWords.splice(amountIndex, 1);
  const category = categoryWords.join(' ').trim() || 'разное';

  return { action: 'transaction', kind, amount, category, wallet };
}

// === Инициализация и запуск ===
(async () => {
  try {
    // Auth и Sheets
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

    // Команды и действия
    bot.start((ctx) => ctx.replyWithHTML(helpText(), mainKeyboard()));
    bot.help((ctx) => ctx.replyWithHTML(helpText(), mainKeyboard()));
    bot.command('баланс', sendBalance);

    bot.action('balance', sendBalance);
    bot.action('menu', async (ctx) => {
      await ctx.editMessageText('Главное меню', { reply_markup: mainKeyboard().reply_markup });
      await ctx.answerCbQuery();
    });

    bot.action('cancel_last', async (ctx) => {
      await ctx.answerCbQuery();
      const chatId = ctx.chat.id;
      const lastOp = lastOperations.get(chatId);
      if (!lastOp) return ctx.reply('Нет операций для отмены 😅', menuKeyboard());

      let deleted = false;
      if (lastOp.type === 'trans') {
        const rows = await transactionsSheet.getRows();
        const row = rows.find(r => Number(r.get('ID')) === lastOp.id);
        if (row) { await row.delete(); deleted = true; }
      } else if (lastOp.type === 'debt') {
        const rows = await debtsSheet.getRows();
        const row = rows.find(r => Number(r.get('ID')) === lastOp.id);
        if (row) { await row.delete(); deleted = true; }
      }

      if (deleted) {
        lastOperations.delete(chatId);
        await ctx.reply('Последняя операция отменена ✅', menuKeyboard());
      } else {
        await ctx.reply('Не удалось найти запись для отмены', menuKeyboard());
      }
    });

    // Заглушки для остальных кнопок
    bot.action(['report', 'debtors', 'transfer', 'expense', 'income'], async (ctx) => {
      await ctx.answerCbQuery('В разработке 🚧');
    });

    // Свободный ввод
    bot.on('text', async (ctx) => {
      const text = ctx.message.text.trim();
      if (text.startsWith('/')) return; // команды уже обработаны выше

      const parsed = parseFreeInput(text);
      if (!parsed) {
        return ctx.reply('Не понял 😅\nПримеры:\n500 кофе #карта\n+10000 зарплата\nдал Иван 500\nвернули Петр 200\nдобавить долг Анна 1500', mainKeyboard());
      }

      const chatId = ctx.chat.id;
      let message;

      if (parsed.action === 'transaction') {
        const result = await addTransaction(parsed.kind, parsed.amount, parsed.category, '', parsed.wallet);
        const kindText = parsed.kind === 'доход' ? 'доход' : 'расход';
        const balances = await getBalance();
        message = `Добавлен ${kindText}: ${parsed.amount.toFixed(2)} ₽ — ${parsed.category}\nКошелёк: #${parsed.wallet}\nБаланс: ${balances[parsed.wallet].toFixed(2)} ₽`;
        lastOperations.set(chatId, { type: 'trans', id: result.id });
      } else {
        let result;
        if (parsed.action === 'lend') result = await addDebt('issue', parsed.debtor, parsed.amount, parsed.comment);
        if (parsed.action === 'return_debt') result = await addDebt('return', parsed.debtor, parsed.amount, parsed.comment);
        if (parsed.action === 'opening_debt') result = await addDebt('opening', parsed.debtor, parsed.amount, parsed.comment);

        const balances = await getBalance();
        const actionText = parsed.action === 'lend' ? 'Выдал долг' : parsed.action === 'return_debt' ? 'Возврат от' : 'Добавлен долг от';
        message = `${actionText} ${parsed.debtor}: ${parsed.amount.toFixed(2)} ₽${parsed.comment ? ' (' + parsed.comment + ')' : ''}\nБаланс долгов: ${balances.долги.toFixed(2)} ₽`;
        lastOperations.set(chatId, { type: 'debt', id: result.id });
      }

      await ctx.reply(message, cancelLastKeyboard());
    });

    bot.catch((err) => console.error('Bot error:', err));

    // Webhook
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
