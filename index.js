const { Telegraf } = require('telegraf');

const TOKEN = '8269910739:AAEywu7dOX8WB9TDG6y8WH-fAoV5_foRhzU';

const bot = new Telegraf(TOKEN);

bot.start((ctx) => ctx.reply('Бот запущен на Render! 🚀\nТвой чат ID: ' + ctx.chat.id));

bot.on('text', (ctx) => {
  ctx.reply('Ты написал: ' + ctx.message.text + '\nБот работает мгновенно!');
});

bot.launch();
console.log('Бот запущен!');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
