// sheets.js
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const SHEET_ID = '1qu5qJSv1jVZAU5yBbHC0AlC07udvv869SIarN3qdkzs';

global.transactionsSheet = null;
global.debtsSheet = null;
global.budgetsSheet = null;
global.doc = null;

const TRANSACTION_HEADERS = [
  'ID',
  'Дата',
  'Тип',
  'Сумма',
  'Категория',
  'Подкатегория',
  'Комментарий',
  'Кошелёк'
];

const DEBT_HEADERS = [
  'ID',
  'Дата',
  'Должник',
  'Сумма',
  'Тип',
  'Коммент'
];

const BUDGET_HEADERS = [
  'Месяц',
  'Категория',
  'Лимит',
  'Валюта'
];

async function ensureSheet(doc, title, headers) {
  let sheet = doc.sheetsByTitle[title];

  if (!sheet) {
    sheet = await doc.addSheet({
      title,
      headerValues: headers
    });

    return sheet;
  }

  try {
    await sheet.loadHeaderRow();

    const currentHeaders = sheet.headerValues || [];
    const hasAllHeaders = headers.every(header => currentHeaders.includes(header));

    if (!hasAllHeaders) {
      await sheet.setHeaderRow(headers);
    }
  } catch {
    await sheet.setHeaderRow(headers);
  }

  return sheet;
}

module.exports = (async () => {
  try {
    const serviceAccountAuth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const doc = new GoogleSpreadsheet(SHEET_ID, serviceAccountAuth);

    await doc.loadInfo();

    global.transactionsSheet = await ensureSheet(doc, 'Transactions', TRANSACTION_HEADERS);
    global.debtsSheet = await ensureSheet(doc, 'Debts', DEBT_HEADERS);
    global.budgetsSheet = await ensureSheet(doc, 'Budgets', BUDGET_HEADERS);

    global.doc = doc;

    console.log('Google Sheets инициализированы');
    console.log('Листы подключены: Transactions, Debts, Budgets');

  } catch (error) {
    console.error('Ошибка инициализации Google Sheets:', error);
    throw error;
  }
})();
