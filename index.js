const { Telegraf } = require('telegraf');
const express = require('express');

const BOT_TOKEN = '8269910739:AAEywu7dOX8WB9TDG6y8WH-fAoV5_foRhzU';

const bot = new Telegraf(BOT_TOKEN);
const app = express();

app.use(express.json());

// === 1. Сначала инициализируем Google Sheets ===
const initSheets = require('./sheets');

// === 2. Клавиатуры и утилиты ===
const { mainKeyboard, menuKeyboard } = require('./keyboards');

// === Приветствие ===
function helpText() {
  return `<b>Привет! Я твой бюджет-бот 🚀</b>

Доступно:
• Баланс
• Начальный остаток (/остаток)
• Перевод (/перевод)
• Свободный ввод расходов и доходов

Примеры:
• Кофе 290
• Сигареты 299
• +10000 зарплата
• /остаток карта 100000
• /перевод карта депозит 50000

Нажми кнопки 👇`;
}

// === Запуск после инициализации Sheets ===
(async () => {
  try {
    await initSheets;

    console.log('Sheets инициализированы, подключаем модули функционала');

    // === Подключаем модули после инициализации sheets ===
    const { sendBalance } = require('./balance');
    const { handleInitial } = require('./initial');
    const { handleTransfer } = require('./transfer');
    const { handleFreeInput } = require('./transaction');
    const { handleCancelLast } = require('./cancel');
    const { sendDebtors } = require('./debt');
    const { sendTodayReport, sendMonthReport } = require('./report');
    const { startAutoReport } = require('./autoReport');

    console.log('DEBUG handlers:', {
  sendBalance: typeof sendBalance,
  handleInitial: typeof handleInitial,
  handleTransfer: typeof handleTransfer,
  handleFreeInput: typeof handleFreeInput,
  handleCancelLast: typeof handleCancelLast,
  sendDebtors: typeof sendDebtors
});

 // === Команды ===
bot.start((ctx) => ctx.replyWithHTML(helpText(), mainKeyboard()));
bot.help((ctx) => ctx.replyWithHTML(helpText(), mainKeyboard()));

// Кириллические команды ловим как текст, чтобы они не уходили в свободный ввод
bot.hears(/^\/?баланс$/i, sendBalance);
bot.hears(/^\/?остаток\s+/i, handleInitial);
bot.hears(/^\/?перевод\s+/i, handleTransfer);
    bot.hears(/^\/?обмен\s+/i, handleExchange);
    bot.hears(/^\/?(отчет|отчёт|сегодня)$/i, sendTodayReport);
bot.hears(/^\/?(месяц|отчет месяц|отчёт месяц)$/i, sendMonthReport);
    bot.hears(/^\/?(report_now|отчет сейчас|отчёт сейчас)$/i, sendTodayReport);

// Запуск ежедневного автоотчёта
startAutoReport(bot);

    // === Кнопки ===
    bot.action('balance', sendBalance);

    bot.action('transfer', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply(
        'Используй команду:\n/перевод <от_кошелька> <к_кошельку> <сумма>\n\nПример:\n/перевод карта депозит 50000',
        menuKeyboard()
      );
    });

    bot.action('menu', async (ctx) => {
      await ctx.answerCbQuery();

      try {
        await ctx.editMessageText(helpText(), {
          parse_mode: 'HTML',
          reply_markup: mainKeyboard().reply_markup
        });
      } catch (error) {
        await ctx.replyWithHTML(helpText(), mainKeyboard());
      }
    });

    // === Отмена последней операции ===
    bot.action('cancel_last', handleCancelLast);

    // === Пока заглушки ===
  bot.action('debtors', sendDebtors);
bot.action('report', sendTodayReport);

bot.action(['expense', 'income'], async (ctx) => {
  await ctx.answerCbQuery('В разработке 🚧');
});

    // === Свободный ввод ===
    bot.on('text', handleFreeInput);

    // === Глобальная обработка ошибок бота ===
    bot.catch((err) => {
      console.error('Bot error:', err);
    });

    // === Webhook ===
    app.use(bot.webhookCallback(`/bot${BOT_TOKEN}`));

    app.get('/', (req, res) => {
      res.send('Бюджет-бот работает! 🚀');
    });

    const PORT = process.env.PORT || 3000;

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Сервер запущен на порту ${PORT}`);
    });

  } catch (error) {
    console.error('Критическая ошибка запуска:', error);
    process.exit(1);
  }
})();
