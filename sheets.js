const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const SHEET_ID = '1qu5qJSv1jVZAU5yBbHC0AlC07udvv869SIarN3qdkzs';

global.transactionsSheet = null;
global.debtsSheet = null;

(async () => {
  try {
    const serviceAccountAuth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();

    let sheet = doc.sheetsByTitle['Transactions'];
    if (!sheet) {
      sheet = await doc.addSheet({
        title: 'Transactions',
        headerValues: ['ID', 'Дата', 'Тип', 'Сумма', 'Категория', 'Комментарий', 'Кошелёк']
      });
    } else {
      try {
        await sheet.loadHeaderRow();
      } catch {
        await sheet.setHeaderRow(['ID', 'Дата', 'Тип', 'Сумма', 'Категория', 'Комментарий', 'Кошелёк']);
      }
    }
    global.transactionsSheet = sheet;

    sheet = doc.sheetsByTitle['Debts'];
    if (!sheet) {
      sheet = await doc.addSheet({
        title: 'Debts',
        headerValues: ['ID', 'Дата', 'Должник', 'Сумма', 'Тип', 'Коммент']
      });
    } else {
      try {
        await sheet.loadHeaderRow();
      } catch {
        await sheet.setHeaderRow(['ID', 'Дата', 'Должник', 'Сумма', 'Тип', 'Коммент']);
      }
    }
    global.debtsSheet = sheet;

    console.log('Google Sheets подключены и готовы');
  } catch (error) {
    console.error('Ошибка подключения к Google Sheets:', error);
  }
})();
