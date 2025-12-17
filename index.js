const { Telegraf } = require('telegraf');
const { GoogleSpreadsheet } = require('google-spreadsheet');

const TOKEN = '8269910739:AAEywu7dOX8WB9TDG6y8WH-fAoV5_foRhzU';
const SHEET_ID = '1qu5qJSv1jVZAU5yBbHC0AlC07udvv869SIarN3qdkzs';

const bot = new Telegraf(TOKEN);
const doc = new GoogleSpreadsheet(SHEET_ID);

// Правильная авторизация для google-spreadsheet v4+
async function initDoc() {
  await doc.useServiceAccountAuth({
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  });
  await doc.loadInfo();
  console.log('Таблица подключена:', doc.title);
}

initDoc().catch(err => console.error('Ошибка подключения к таблице:', err));

// Инициализация листов
let transactionsSheet, debtsSheet;

async function initSheets() {
  try {
    await doc.loadInfo();

    // Транзакции
    let sheet = doc.sheetsByTitle['Transactions'];
    if (!sheet) {
      sheet = await doc.addSheet({
        title: 'Transactions',
        headerValues: ['ID', 'Дата', 'Тип', 'Сумма', 'Категория', 'Комментарий', 'Кошелёк']
      });
    }
    transactionsSheet = sheet;

    // Долги
    sheet = doc.sheetsByTitle['Debts'];
    if (!sheet) {
      sheet = await doc.addSheet({
        title: 'Debts',
        headerValues: ['ID', 'Дата', 'Должник', 'Сумма', 'Тип', 'Коммент']
      });
    }
    debtsSheet = sheet;

    console.log('Листы инициализированы');
  } catch (err) {
    console.error('Ошибка инициализации листов:', err);
  }
}

initSheets();

// === Простой тест — бот отвечает на всё ===
bot.on('text', (ctx) => {
  ctx.reply(`Ты написал: ${ctx.message.text}\nБот работает на Render мгновенно! 🚀`);
});

bot.start((ctx) => ctx.reply('Бот запущен на Render! 🚀'));

bot.launch();
console.log('Бот запущен!');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
