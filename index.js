const { Telegraf } = require('telegraf');
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

initDoc().catch(console.error);

// Простой тест — бот отвечает на всё
bot.on('text', (ctx) => {
  ctx.reply(`Ты написал: ${ctx.message.text}\nБот работает на Render! 🚀`);
});

bot.launch();
console.log('Бот запущен!');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
