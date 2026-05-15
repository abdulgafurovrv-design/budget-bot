// autoReport.js
const cron = require('node-cron');
const { buildReport } = require('./report');

const CHAT_ID = '78731034';

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
      timezone: 'Europe/Moscow'
    }
  );

  console.log('Автоотчёт настроен на 23:59 Europe/Moscow');
}

module.exports = {
  startAutoReport
};
