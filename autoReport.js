// autoReport.js
const cron = require('node-cron');
const { buildReport } = require('./report');
const {
  getCurrentMonthKey,
  getNextMonthKey,
  getMissingBudgetCategories,
  hasMissingBudgetCategories,
  buildBudgetReminderMessage
} = require('./budgets');

const CHAT_ID = '78731034';
const TIMEZONE = 'Europe/Moscow';

function isTwoDaysBeforeMonthEnd(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();

  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  const day = date.getDate();

  return lastDayOfMonth - day === 2;
}

async function sendBudgetReminderIfNeeded(bot) {
  const now = new Date();

  try {
    // 1-го числа напоминаем, если бюджет на текущий месяц не заполнен
    if (now.getDate() === 1) {
      const currentMonthKey = getCurrentMonthKey(now);
      const missing = await getMissingBudgetCategories(currentMonthKey);

      if (hasMissingBudgetCategories(missing)) {
        const message = await buildBudgetReminderMessage(
          currentMonthKey,
          'current_missing',
          missing
        );

        await bot.telegram.sendMessage(CHAT_ID, message, {
          parse_mode: 'HTML'
        });

        console.log(`Напоминание о бюджете текущего месяца отправлено: ${currentMonthKey}`);
      }
    }

    // За 2 дня до конца месяца напоминаем, если бюджет на следующий месяц не заполнен
    if (isTwoDaysBeforeMonthEnd(now)) {
      const nextMonthKey = getNextMonthKey(now);
      const missing = await getMissingBudgetCategories(nextMonthKey);

      if (hasMissingBudgetCategories(missing)) {
        const message = await buildBudgetReminderMessage(
          nextMonthKey,
          'next_missing',
          missing
        );

        await bot.telegram.sendMessage(CHAT_ID, message, {
          parse_mode: 'HTML'
        });

        console.log(`Напоминание о бюджете следующего месяца отправлено: ${nextMonthKey}`);
      }
    }
  } catch (error) {
    console.error('Ошибка проверки бюджетных напоминаний:', error);
  }
}

function startAutoReport(bot) {
  if (!bot) {
    console.error('AutoReport: bot не передан');
    return;
  }

  // Каждый день в 23:59 по Москве
  cron.schedule(
    '59 23 * * *',
    async () => {
      try {
        console.log('Запуск автоотчёта 23:59');

        const report = await buildReport('day');

        await bot.telegram.sendMessage(
          CHAT_ID,
          report,
          {
            parse_mode: 'HTML'
          }
        );

        console.log('Автоотчёт отправлен');
      } catch (error) {
        console.error('Ошибка автоотчёта:', error);
      }
    },
    {
      timezone: TIMEZONE
    }
  );

  // Каждый день в 09:00 проверяем бюджетные напоминания:
  // - 1-го числа: бюджет текущего месяца
  // - за 2 дня до конца месяца: бюджет следующего месяца
  cron.schedule(
    '0 9 * * *',
    async () => {
      console.log('Проверка бюджетных напоминаний 09:00');
      await sendBudgetReminderIfNeeded(bot);
    },
    {
      timezone: TIMEZONE
    }
  );

  console.log('Автоотчёт настроен на 23:59 Europe/Moscow');
  console.log('Бюджетные напоминания настроены на 09:00 Europe/Moscow');
}

module.exports = {
  startAutoReport,
  sendBudgetReminderIfNeeded
};
