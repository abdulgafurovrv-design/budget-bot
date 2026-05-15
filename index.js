const { Telegraf } = require('telegraf');
const express = require('express');

const BOT_TOKEN = '8269910739:AAEywu7dOX8WB9TDG6y8WH-fAoV5_foRhzU';

const bot = new Telegraf(BOT_TOKEN);
const app = express();
app.use(express.json());

// === 1. Сначала инициализируем Google Sheets (асинхронно) ===
const initSheets = require('./sheets'); // sheets.js возвращает промис

// === 2. Клавиатуры и утилиты (синхронные) ===
const { mainKeyboard, menuKeyboard, cancelLastKeyboard } = require('./keyboards');
const { normWallet } = require('./utils');

// === Приветствие ===
function helpText() {
  return `<b>Привет! Я твой бюджет-бот 🚀</b>

Доступно:
• Баланс
• Начальный остаток (/остаток)
• Перевод (/перевод)
• Свободный ввод расходов и доходов

Нажми кнопки 👇`;
}

// === Запуск после инициализации Sheets ===
(async () => {
  try {
    await initSheets; // ЖДЁМ, пока таблицы полностью инициализированы
    console.log('Sheets инициализированы, подключаем модули функционала');

    // === 3. Теперь подключаем модули, зависящие от global.transactionsSheet ===
    const { sendBalance } = require('./balance');
    const { handleInitial } = require('./initial');
    const { handleTransfer } = require('./transfer');
    const { handleFreeInput } = require('./transaction');
    const { handleCancelLast } = require('./cancel');

    // === Команды и обработчики ===
    bot.start((ctx) => ctx.replyWithHTML(helpText(), mainKeyboard()));
    bot.help((ctx) => ctx.replyWithHTML(helpText(), mainKeyboard()));

    bot.command('баланс', sendBalance);
    bot.command('остаток', handleInitial);
    bot.command('перевод', handleTransfer);

    bot.action('balance', sendBalance);
    bot.action('transfer', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply('Используй команду:\n/перевод <от_кошелька> <к_кошельку> <сумма>\nПример: /перевод карта депозит 50000', menuKeyboard());
    });

    bot.action('menu', async (ctx) => {
      await ctx.editMessageText(helpText(), { reply_markup: mainKeyboard().reply_markup });
      await ctx.answerCbQuery();
    });

  // Отмена последней операции
bot.action('cancel_last', handleCancelLast);

// Заглушки
bot.action(['report', 'debtors', 'expense', 'income'], async (ctx) => {
  await ctx.answerCbQuery('В разработке 🚧');
});
    });

    // Свободный ввод
    bot.on('text', handleFreeInput);

    bot.catch((err) => {
      console.error('Bot error:', err);
    });

    // Webhook
    app.use(bot.webhookCallback(`/bot${BOT_TOKEN}`));
    app.get('/', (req, res) => res.send('Бюджет-бот работает! 🚀'));

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Сервер запущен на порту ${PORT}`);
    });

  } catch (error) {
    console.error('Критическая ошибка запуска:', error);
  }
})();
