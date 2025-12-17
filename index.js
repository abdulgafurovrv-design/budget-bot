const { Telegraf } = require('telegraf');
const { initDoc, initSheets } = require('./sheets');
const { handleText } = require('./handlers');
const { mainKeyboard } = require('./keyboards');

const TOKEN = '8269910739:AAEywu7dOX8WB9TDG6y8WH-fAoV5_foRhzU';

const bot = new Telegraf(TOKEN);

initDoc().catch(console.error);
initSheets();

bot.on('text', handleText);

bot.launch();
console.log('Бот запущен!');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
