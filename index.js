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

// === Клавиатуры ===
function mainKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Баланс', 'balance'), Markup.button.callback('Отчёт', 'report')],
    [Markup.button.callback('Должники', 'debtors'), Markup.button.callback('Перевод', 'transfer')],
    [Markup.button.callback('Расход +', 'expense'), Markup.button.callback('Доход +', 'income')]
  ]);
}

// === Приветствие ===
function helpText() {
  return `<b>Привет! Я твой бюджет-бот 🚀</b>

Бот запущен в базовом режиме.

Скоро добавим весь функционал по шагам.

Нажми кнопки ниже 👇`;
}

// === Инициализация Google Sheets с правильной проверкой заголовков ===
(async () => {
  try {
    const serviceAccountAuth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();

    // Transactions
    let sheet = doc.sheetsByTitle['Transactions'];
    if (!sheet) {
      sheet = await doc.addSheet({
        title: 'Transactions',
        headerValues: ['ID', 'Дата', 'Тип', 'Сумма', 'Категория', 'Комментарий', 'Кошелёк']
      });
    } else {
      const headers = await sheet.headerValues;
      if (!headers || headers.length === 0 || headers.every(h => !h || h.trim() === '')) {
        await sheet.setHeaderRow(['ID', 'Дата', 'Тип', 'Сумма', 'Категория', 'Комментарий', 'Кошелёк']);
      }
    }
    transactionsSheet = sheet;

    // Debts
    sheet = doc.sheetsByTitle['Debts'];
    if (!sheet) {
      sheet = await doc.addSheet({
        title: 'Debts',
        headerValues: ['ID', 'Дата', 'Должник', 'Сумма', 'Тип', 'Коммент']
      });
    } else {
      const headers = await sheet.headerValues;
      if (!headers || headers.length === 0 || headers.every(h => !h || h.trim() === '')) {
        await sheet.setHeaderRow(['ID', 'Дата', 'Должник', 'Сумма', 'Тип', 'Коммент']);
      }
    }
    debtsSheet = sheet;

    console.log('Google Sheets подключены, заголовки проверены');

    // Только /start и меню
    bot.start((ctx) => ctx.replyWithHTML(helpText(), mainKeyboard()));
    bot.help((ctx) => ctx.replyWithHTML(helpText(), mainKeyboard()));

    // Заглушки для всех кнопок
    bot.action(['balance', 'report', 'debtors', 'transfer', 'expense', 'income'], async (ctx) => {
      await ctx.answerCbQuery('Функция в разработке 🚧');
    });

    bot.catch((err) => console.error('Bot error:', err));

    // Webhook
    app.use(bot.webhookCallback(`/bot${BOT_TOKEN}`));
    app.get('/', (req, res) => res.send('Бюджет-бот жив (базовая версия)! 🚀'));

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Сервер запущен на порту ${PORT}`);
    });

  } catch (error) {
    console.error('Ошибка запуска:', error);
  }
})();
