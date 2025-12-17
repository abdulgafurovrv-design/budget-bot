const { Telegraf } = require('telegraf');
const express = require('express');

const BOT_TOKEN = '8269910739:AAEywu7dOX8WB9TDG6y8WH-fAoV5_foRhzU';

const bot = new Telegraf(BOT_TOKEN);
const app = express();
app.use(express.json());

// Подключаем модули (важно: sheets первым!)
require('./sheets'); // инициализация Google Sheets и global.transactionsSheet, debtsSheet
require('./keyboards');
require('./utils');

// Подключаем функционал
const { sendBalance } = require('./balance');
const { handleInitial } = require('./initial');
const { handleTransfer } = require('./transfer');

// === Приветствие ===
function helpText() {
  return `<b>Привет! Я твой бюджет-бот 🚀</b>

Доступно:
• Баланс (кнопка или /баланс)
• Начальный остаток (/остаток кошелёк сумма)
• Перевод (/перевод от_кошелька к_кошельку сумма)

Нажми кнопки 👇`;
}

bot.start((ctx) => ctx.replyWithHTML(helpText(), require('./keyboards').mainKeyboard()));
bot.help((ctx) => ctx.replyWithHTML(helpText(), require('./keyboards').mainKeyboard()));

// === Команды ===
bot.command('баланс', sendBalance);
bot.command('остаток', handleInitial);
bot.command('перевод', handleTransfer);

// === Кнопки ===
bot.action('balance', sendBalance);
bot.action('transfer', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('Используй команду:\n/перевод <от_кошелька> <к_кошельку> <сумма>\nПример: /перевод карта депозит 50000', require('./keyboards').menuKeyboard());
});

// Заглушки для остальных кнопок
bot.action(['report', 'debtors', 'expense', 'income'], async (ctx) => {
  await ctx.answerCbQuery('В разработке 🚧');
});

bot.action('menu', async (ctx) => {
  await ctx.editMessageText(helpText(), { reply_markup: require('./keyboards').mainKeyboard().reply_markup });
  await ctx.answerCbQuery();
});

// Обработка ошибок
bot.catch((err, ctx) => {
  console.error('Bot error:', err);
  ctx.reply('Произошла ошибка 😔').catch(() => {});
});

// Webhook
app.use(bot.webhookCallback(`/bot${BOT_TOKEN}`));
app.get('/', (req, res) => res.send('Бюджет-бот работает! 🚀'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
