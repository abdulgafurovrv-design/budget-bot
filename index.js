const { Telegraf } = require('telegraf');
const { GoogleSpreadsheet } = require('google-spreadsheet');

const TOKEN = '8269910739:AAEywu7dOX8WB9TDG6y8WH-fAoV5_foRhzU';
const SHEET_ID = '1qu5qJSv1jVZAU5yBbHC0AlC07udvv869SIarN3qdkzs';

const bot = new Telegraf(TOKEN);
const doc = new GoogleSpreadsheet(SHEET_ID);

// Авторизация Google Sheets (создай сервисный аккаунт)
async function loadDoc() {
  await doc.useServiceAccountAuth({
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  });
  await doc.loadInfo();
}

loadDoc();

// Твои листы
let transactionsSheet, debtsSheet;

// Инициализация листов
async function initSheets() {
  await doc.loadInfo();
  let sheet = doc.sheetsByTitle['Transactions'];
  if (!sheet) {
    sheet = await doc.addSheet({ title: 'Transactions', headerValues: ['Дата', 'Тип', 'Сумма', 'Категория', 'Комментарий', 'Кошелёк'] });
  }
  transactionsSheet = sheet;

  sheet = doc.sheetsByTitle['Debts'];
  if (!sheet) {
    sheet = await doc.addSheet({ title: 'Debts', headerValues: ['Дата', 'Должник', 'Сумма', 'Тип', 'Коммент'] });
  }
  debtsSheet = sheet;
}

initSheets();

// Твой полный код логики (handleText, баланс, долги, категории и т.д.) — скопируй из текущего Logic.gs
// Только замени SpreadsheetApp на doc, getRange на await sheet.getRows() и т.д.
// Я пришлю адаптированный код в следующем сообщении, если скажешь "да".

bot.launch();
console.log('Бот запущен на Telegraf');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
