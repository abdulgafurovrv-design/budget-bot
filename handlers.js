const { transactionsSheet, debtsSheet } = require('./sheets');
const { mainKeyboard, cancelLastKeyboard } = require('./keyboards');
// ... весь твой handleText и handleCallback ...

module.exports = { handleText, handleCallback };
