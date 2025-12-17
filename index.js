const { Telegraf } = require('telegraf');
const express = require('express');

const BOT_TOKEN = '8269910739:AAEywu7dOX8WB9TDG6y8WH-fAoV5_foRhzU';

const bot = new Telegraf(BOT_TOKEN);
const app = express();
app.use(express.json());

// Подключаем клавиатуры и утилиты (синхронные)
require('./keyboards');
require('./utils');

// === Инициализация Google Sheets (асинхронная) ===
const initSheets = require('./sheets'); // sheets.js экспортирует промис или функцию

const { handleFreeInput } = require('./transaction');

// === Приветствие ===
function helpText() {
  return `<b>Привет! Я твой бюджет-бот 🚀</b>

Доступно:
• Баланс (кнопка или /баланс)
• Начальный остаток (/остаток кошелёк сумма)
• Перевод (/перевод от_кошелька к_кошельку сумма)

Нажми кнопки 👇`;
}

// Запуск после полной инициализации
(async () => {
  try {
    await initSheets; // ждём, пока sheets.js завершит инициализацию

    console.log('Все модули инициализированы');

    // Теперь подключаем функционал (когда таблицы уже готовы)
    const { sendBalance } = require('./balance');
    const { handleInitial } = require('./initial');
    const { handleTransfer } = require('./transfer');

       // Команды
    bot.start((ctx) => ctx.replyWithHTML(helpText(), require('./keyboards').mainKeyboard()));
    bot.help((ctx) => ctx.replyWithHTML(helpText(), require('./keyboards').mainKeyboard()));

    bot.command('баланс', sendBalance);

    // Команды с аргументами — через hears
    bot.hears(/^\/остаток\s+/i, handleInitial);
    bot.hears(/^\/перевод\s+/i, handleTransfer);

    // Кнопки
    bot.action('balance', sendBalance);
    bot.action('transfer', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply('Используй команду:\n/перевод <от_кошелька> <к_кошельку> <сумма>\nПример: /перевод карта депозит 50000', require('./keyboards').menuKeyboard());
    });

    bot.action('menu', async (ctx) => {
      await ctx.editMessageText(helpText(), { reply_markup: require('./keyboards').mainKeyboard().reply_markup });
      await ctx.answerCbQuery();
    });

    // Заглушки
    bot.action(['report', 'debtors', 'expense', 'income'], async (ctx) => {
      await ctx.answerCbQuery('В разработке 🚧');
    });

   // Свободный ввод расходов и доходов
bot.on('text', handleFreeInput);
    
    bot.catch((err) => console.error('Bot error:', err));

    // Webhook
    app.use(bot.webhookCallback(`/bot${BOT_TOKEN}`));
    app.get('/', (req, res) => res.send('Бюджет-бот работает! 🚀'));

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Сервер запущен на порту ${PORT}`);
    });

  } catch (error) {
    console.error('Ошибка при запуске:', error);
  }
})();
