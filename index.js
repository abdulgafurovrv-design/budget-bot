const { Telegraf } = require('telegraf');
const express = require('express');

const BOT_TOKEN = '8269910739:AAEywu7dOX8WB9TDG6y8WH-fAoV5_foRhzU';

const bot = new Telegraf(BOT_TOKEN);
const app = express();

app.use(express.json());

// Логируем callback-кнопки, чтобы быстро поймать старые/неправильные кнопки в Render Logs
bot.use(async (ctx, next) => {
  if (ctx.callbackQuery && ctx.callbackQuery.data) {
    console.log('DEBUG CALLBACK:', ctx.callbackQuery.data);
  }

  return next();
});

// === 1. Сначала инициализируем Google Sheets ===
const initSheets = require('./sheets');

// === 2. Клавиатуры ===
const { mainKeyboard, menuKeyboard } = require('./keyboards');

// === Состояние кнопок Расход+/Доход+ ===
const pendingModes = new Map();

// === Приветствие ===
function helpText() {
  return `<b>Привет! Я твой бюджет-бот 🚀</b>

Доступно:
• Баланс
• Бюджеты по категориям
• Начальный остаток
• Перевод
• Обмен валюты
• Долги
• Отчёты день / неделя / месяц
• Свободный ввод расходов и доходов

Примеры:
• Кофе 290
• Сигареты 299 нал
• Кофе 10 зарубежка
• +10000 зарплата

Остатки:
• /остаток карта 100000
• /остаток зарубежная_карта 1000

Переводы и обмен:
• /перевод карта депозит 50000
• /перевод доллары зарубежная_карта 100
• /обмен карта зарубежная_карта 9000 100

Долги:
• дал Саша 5000 #карта
• вернули Саша 2000 #карта
• добавить долг Саша 10000

Бюджеты:
• /бюджет кафе 15000
• /бюджет доход зарплата 550000
• /бюджет след продукты 60000
• /бюджеты
• /бюджеты след

Отчёты:
• отчёт
• день
• неделя
• месяц
• /report_now

Нажми кнопки 👇`;
}

function isCancelText(text) {
  const value = String(text || '').trim().toLowerCase();

  return [
    'отмена',
    'отменить',
    'назад',
    'меню',
    '/cancel',
    '/start'
  ].includes(value);
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
    const { handleExchange } = require('./exchange');
    const { handleFreeInput, handleCategorySelected } = require('./transaction');
    const { handleCancelLast } = require('./cancel');
    const { sendDebtors } = require('./debt');

    const {
      sendReportMenu,
      sendTodayReport,
      sendWeekReport,
      sendMonthReport
    } = require('./report');

    const {
      handleSetBudget,
      sendBudgets,
      showBudgetCategories,
      handleBudgetPeriodSelected,
      handleBudgetTypeSelected,
      handleBudgetCategorySelected,
      handleBudgetCancel,
      handleBudgetAmountInput,
      clearPendingBudgetInput
    } = require('./budgets');

    const { startAutoReport } = require('./autoReport');

    console.log('DEBUG handlers:', {
      sendBalance: typeof sendBalance,
      handleInitial: typeof handleInitial,
      handleTransfer: typeof handleTransfer,
      handleExchange: typeof handleExchange,
      handleFreeInput: typeof handleFreeInput,
      handleCancelLast: typeof handleCancelLast,
      sendDebtors: typeof sendDebtors,
      sendReportMenu: typeof sendReportMenu,
      sendTodayReport: typeof sendTodayReport,
      sendWeekReport: typeof sendWeekReport,
      sendMonthReport: typeof sendMonthReport,
      handleSetBudget: typeof handleSetBudget,
      sendBudgets: typeof sendBudgets,
      handleBudgetPeriodSelected: typeof handleBudgetPeriodSelected,
      handleBudgetTypeSelected: typeof handleBudgetTypeSelected,
      startAutoReport: typeof startAutoReport
    });

    // === Команды ===
    bot.start((ctx) => {
      pendingModes.delete(ctx.chat.id);
      clearPendingBudgetInput(ctx.chat.id);
      return ctx.replyWithHTML(helpText(), mainKeyboard());
    });

    bot.help((ctx) => {
      pendingModes.delete(ctx.chat.id);
      clearPendingBudgetInput(ctx.chat.id);
      return ctx.replyWithHTML(helpText(), mainKeyboard());
    });

    // === Основные команды ===
    bot.hears(/^\/?баланс$/i, sendBalance);
    bot.hears(/^\/?остаток\s+/i, handleInitial);
    bot.hears(/^\/?перевод\s+/i, handleTransfer);
    bot.hears(/^\/?обмен\s+/i, handleExchange);

    // === Отчёты ===
    bot.hears(/^\/?(отчет|отчёт)$/i, sendReportMenu);
    bot.hears(/^\/?(день|сегодня|отчет день|отчёт день|отчет сегодня|отчёт сегодня)$/i, sendTodayReport);
    bot.hears(/^\/?(неделя|отчет неделя|отчёт неделя)$/i, sendWeekReport);
    bot.hears(/^\/?(месяц|отчет месяц|отчёт месяц)$/i, sendMonthReport);
    bot.hears(/^\/?(report_now|отчет сейчас|отчёт сейчас)$/i, sendTodayReport);

    // === Бюджеты ===
    bot.hears(/^\/?бюджет\s+/i, handleSetBudget);
    bot.hears(/^\/?(бюджеты|лимиты)\s+(след|следующий|next)$/i, sendBudgets);
    bot.hears(/^\/?(бюджеты|лимиты)$/i, sendBudgets);

    // === Автоотчёт и напоминания ===
    startAutoReport(bot);

    // === Кнопки главного меню ===
    bot.action('balance', sendBalance);
    bot.action('debtors', sendDebtors);

    // Кнопка "Отчёт" теперь открывает меню выбора периода
    bot.action('report', sendReportMenu);
    bot.action('report_day', sendTodayReport);
    bot.action('report_week', sendWeekReport);
    bot.action('report_month', sendMonthReport);

    bot.action('budgets', async (ctx) => {
      clearPendingBudgetInput(ctx.chat.id);
      return sendBudgets(ctx);
    });

    bot.action('budget_view_current', sendBudgets);
    bot.action('budget_view_next', sendBudgets);

    bot.action('budget_add', async (ctx) => {
      clearPendingBudgetInput(ctx.chat.id);
      return showBudgetCategories(ctx);
    });

    bot.action(/^budget_period:/, handleBudgetPeriodSelected);
    bot.action(/^budget_type:/, handleBudgetTypeSelected);
    bot.action(/^budgetcat:/, handleBudgetCategorySelected);
    bot.action('budget_cancel', handleBudgetCancel);

    bot.action('transfer', async (ctx) => {
      await ctx.answerCbQuery();

      await ctx.reply(
        'Используй команду:\n' +
        '/перевод <от_кошелька> <к_кошельку> <сумма>\n\n' +
        'Примеры:\n' +
        '/перевод карта депозит 50000\n' +
        '/перевод доллары зарубежная_карта 100\n' +
        '/перевод зарубежная_карта доллары 50',
        menuKeyboard()
      );
    });

    bot.action('exchange_help', async (ctx) => {
      await ctx.answerCbQuery();

      await ctx.reply(
        'Используй команду:\n' +
        '/обмен <откуда> <куда> <сумма_списания> <сумма_зачисления>\n\n' +
        'Примеры:\n' +
        '/обмен карта зарубежная_карта 9000 100\n' +
        '/обмен зарубежная_карта карта 100 9200\n' +
        '/обмен карта доллары 9200 100',
        menuKeyboard()
      );
    });

    // === Кнопка Расход + ===
    bot.action(['add_expense', 'expense'], async (ctx) => {
      await ctx.answerCbQuery();

      pendingModes.set(ctx.chat.id, 'expense');
      clearPendingBudgetInput(ctx.chat.id);

      await ctx.reply(
        'Введи расход одним сообщением.\n\n' +
        'Примеры:\n' +
        'кофе 300\n' +
        'продукты 1200 нал\n' +
        'такси 800 карта\n' +
        'кофе 10 зарубежка\n\n' +
        'Для отмены напиши: отмена',
        menuKeyboard()
      );
    });

    // === Кнопка Доход + ===
    bot.action(['add_income', 'income'], async (ctx) => {
      await ctx.answerCbQuery();

      pendingModes.set(ctx.chat.id, 'income');
      clearPendingBudgetInput(ctx.chat.id);

      await ctx.reply(
        'Введи доход одним сообщением.\n\n' +
        'Примеры:\n' +
        'зарплата 100000 карта\n' +
        'аванс 30000\n' +
        'кешбэк 500 карта\n' +
        'подарок 100 зарубежка\n\n' +
        'Плюс ставить не обязательно.\n' +
        'Для отмены напиши: отмена',
        menuKeyboard()
      );
    });

    bot.action('menu', async (ctx) => {
      await ctx.answerCbQuery();

      pendingModes.delete(ctx.chat.id);
      clearPendingBudgetInput(ctx.chat.id);

      try {
        await ctx.editMessageText(helpText(), {
          parse_mode: 'HTML',
          reply_markup: mainKeyboard().reply_markup
        });
      } catch (error) {
        await ctx.replyWithHTML(helpText(), mainKeyboard());
      }
    });

    bot.action(/^catselect:/, handleCategorySelected);
    bot.action('catselect_cancel', handleCategorySelected);

    // === Отмена последней операции ===
    bot.action('cancel_last', handleCancelLast);

    // === Свободный ввод должен быть последним ===
    bot.on('text', async (ctx) => {
      const chatId = ctx.chat.id;
      const text = ctx.message.text.trim();
      const mode = pendingModes.get(chatId);

      const budgetHandled = await handleBudgetAmountInput(ctx);

      if (budgetHandled) {
        return;
      }

      if (mode) {
        if (isCancelText(text)) {
          pendingModes.delete(chatId);
          return ctx.reply('Ввод отменён', mainKeyboard());
        }

        pendingModes.delete(chatId);

        // Если нажали "Доход +", принудительно делаем доход.
        if (mode === 'income') {
          if (!text.startsWith('+')) {
            ctx.message.text = `+${text}`;
          }
        }

        // Если нажали "Расход +", принудительно убираем плюс, если он случайно поставлен.
        if (mode === 'expense') {
          ctx.message.text = text.replace(/^\+/, '');
        }

        return handleFreeInput(ctx);
      }

      return handleFreeInput(ctx);
    });

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
