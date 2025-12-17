const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library'); // Новый импорт

const BOT_TOKEN = '8269910739:AAEywu7dOX8WB9TDG6y8WH-fAoV5_foRhzU';
const SHEET_ID = '1qu5qJSv1jVZAU5yBbHC0AlC07udvv869SIarN3qdkzs';

const bot = new Telegraf(BOT_TOKEN);
const app = express();
app.use(express.json());

// Глобальные переменные для листов
let transactionsSheet, debtsSheet;

const DEFAULT_WALLET = 'карта';

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

// === Приветствие ===
function helpText() {
  return `<b>Привет! Я твой бюджет-бот 🚀</b>

Теперь работаю мгновенно на Render!

<b>Кошельки:</b> Карта, Наличка, Евро, Доллары, Депозит, Долги

<b>Свободный ввод:</b>
• 500 кофе #карта
• +10000 зарплата
• дал Иван 500
• вернули Иван 200
• добавить долг Петр 1500

<b>Команды:</b>
/баланс — остатки
/отчет — последние операции
/debtors — должники

Нажми кнопки ниже 👇`;
}

// === Инициализация Google Sheets (новый способ для v4+) ===
async function initSheets() {
  // Создаём JWT-клиент
  const serviceAccountAuth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const doc = new GoogleSpreadsheet(SHEET_ID, serviceAccountAuth);

  await doc.loadInfo(); // Загружаем метаданные таблицы

  // Transactions
  let sheet = doc.sheetsByTitle['Transactions'];
  if (!sheet) sheet = await doc.addSheet({ title: 'Transactions', headerValues: ['ID', 'Дата', 'Тип', 'Сумма', 'Категория', 'Комментарий', 'Кошелёк'] });
  transactionsSheet = sheet;

  // Debts
  sheet = doc.sheetsByTitle['Debts'];
  if (!sheet) sheet = await doc.addSheet({ title: 'Debts', headerValues: ['ID', 'Дата', 'Должник', 'Сумма', 'Тип', 'Коммент'] });
  debtsSheet = sheet;

  console.log('Google Sheets инициализированы и подключены');
}

// === Запуск ===
(async () => {
  try {
    await initSheets();

    bot.start((ctx) => ctx.replyWithHTML(helpText(), mainKeyboard()));
    bot.help((ctx) => ctx.replyWithHTML(helpText(), mainKeyboard()));
    bot.command('баланс', sendBalance);

    bot.action('balance', sendBalance);
    bot.action('menu', async (ctx) => {
      await ctx.editMessageText('Главное меню', { reply_markup: mainKeyboard().reply_markup });
      await ctx.answerCbQuery();
    });

    // Заглушки
    bot.action(['report', 'debtors', 'transfer', 'expense', 'income', 'cancel_last'], async (ctx) => {
      await ctx.answerCbQuery('В разработке 🚧');
    });

    bot.on('text', async (ctx) => {
      const text = ctx.message.text.trim();
      if (text.startsWith('/')) {
        await ctx.reply('Команда в разработке 🚧', mainKeyboard());
      } else {
        await ctx.reply('Свободный ввод скоро заработает 😎', mainKeyboard());
      }
    });

    bot.catch((err) => console.error('Bot error:', err));

    // Webhook
    app.use(bot.webhookCallback(`/bot${BOT_TOKEN}`));

    app.get('/', (req, res) => res.send('Бюджет-бот жив! 🚀'));

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, '0.0.0.0', async () => {
      console.log(`Сервер запущен на порту ${PORT} и интерфейсе 0.0.0.0`);

      // Установка webhook (раскомментируй только на первом деплое после успеха)
      // const url = `https://${process.env.RENDER_EXTERNAL_HOSTNAME}/bot${BOT_TOKEN}`;
      // await bot.telegram.setWebhook(url);
      // console.log('Webhook установлен:', url);
    });

  } catch (error) {
    console.error('Критическая ошибка при запуске:', error);
  }
})();
