const { Telegraf } = require('telegraf');

const TOKEN = '8269910739:AAEywu7dOX8WB9TDG6y8WH-fAoV5_foRhzU';

const bot = new Telegraf(TOKEN);

require('./sheets'); // инициализация таблиц
const { handleText, handleCallback } = require('./handlers');
const { mainKeyboard } = require('./keyboards');

// Обработка сообщений
bot.on('text', handleText);

// Обработка нажатий на кнопки
bot.on('callback_query', handleCallback);

bot.launch();
console.log('Бот запущен на Telegraf + Render!');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
