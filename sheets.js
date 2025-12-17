const { GoogleSpreadsheet } = require('google-spreadsheet');

const SHEET_ID = '1qu5qJSv1jVZAU5yBbHC0AlC07udvv869SIarN3qdkzs';
const doc = new GoogleSpreadsheet(SHEET_ID);

let transactionsSheet, debtsSheet;

async function initDoc() {
  await doc.useServiceAccountAuth({
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  });
  await doc.loadInfo();
}

async function initSheets() {
  // ... код инициализации листов ...
}

module.exports = { initDoc, initSheets, transactionsSheet, debtsSheet };
