const { Telegraf, Markup } = require('telegraf');
const express = require('express');

const BOT_TOKEN = '8269910739:AAEywu7dOX8WB9TDG6y8WH-fAoV5_foRhzU';

const bot = new Telegraf(BOT_TOKEN);
const app = express();
app.use(express.json());

// Подключаем модули
require('./sheets'); // инициализация Google Sheets
require('./keyboards'); // клавиатуры
require('./utils'); // утилиты

// Подключаем функционал (пока заглушки)
require('./balance');
require('./initial');
require('./transfer');
// require('./transaction');
// require('./debt');
// require('./cancel');

// === Приветствие ===
function helpText() {
  return `<b>Привет! Я твой бюджет-бот 🚀</b>

Функционал добавляем по шагам.

Доступно:
• Баланс
• Начальный остаток (/остаток)
• Перевод между кошельками

Нажми кнопки 👇`;
}

bot.start((ctx) => ctx.replyWithHTML(helpText(), require('./keyboards').mainKeyboard()));
bot.help((ctx) => ctx.replyWithHTML(helpText(), require('./keyboards').mainKeyboard()));

// Заглушки для кнопок, которые ещё не реализованы
bot.action(['report', 'debtors', 'expense', 'income', 'cancel_last'], async (ctx) => {
  await ctx.answerCbQuery('В разработке 🚧');
});

bot.catch((err) => console.error('Bot error:', err));

// Webhook
app.use(bot.webhookCallback(`/bot${BOT_TOKEN}`));
app.get('/', (req, res) => res.send('Бюджет-бот жив! 🚀'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});

