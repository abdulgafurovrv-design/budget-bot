const { GoogleSpreadsheet } = require('google-spreadsheet');

const SHEET_ID = '1qu5qJSv1jVZAU5yBbHC0AlC07udvv869SIarN3qdkzs';
const doc = new GoogleSpreadsheet(SHEET_ID);

global.transactionsSheet = null;
global.debtsSheet = null;

async function initDoc() {
  await doc.useServiceAccountAuth({
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  });
  await doc.loadInfo();
  console.log('Таблица подключена:', doc.title);
}

async function initSheets() {
  await doc.loadInfo();

  let sheet = doc.sheetsByTitle['Transactions'];
  if (!sheet) {
    sheet = await doc.addSheet({
      title: 'Transactions',
      headerValues: ['ID', 'Дата', 'Тип', 'Сумма', 'Категория', 'Комментарий', 'Кошелёк']
    });
  }
  global.transactionsSheet = sheet;

  sheet = doc.sheetsByTitle['Debts'];
  if (!sheet) {
    sheet = await doc.addSheet({
      title: 'Debts',
      headerValues: ['ID', 'Дата', 'Должник', 'Сумма', 'Тип', 'Коммент']
    });
  }
  global.debtsSheet = sheet;

  console.log('Листы инициализированы');
}

initDoc().catch(err => console.error('Ошибка авторизации:', err));
initSheets().catch(err => console.error('Ошибка инициализации листов:', err));

module.exports = {};
