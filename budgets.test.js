const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const budgets = require('./budgets');

let rows;
function row(values) {
  return { get: key => values[key], set: (key, value) => { values[key] = value; }, save: async () => {} };
}
function context(data, text) {
  const replies = [];
  return {
    chat: { id: 1 }, callbackQuery: data ? { data } : undefined,
    message: { text }, replies, answerCbQuery: async () => {},
    reply: async (message, options) => { replies.push({ message, options }); },
    replyWithHTML: async (message, options) => { replies.push({ message, options }); }
  };
}
beforeEach(() => {
  rows = [];
  global.budgetsSheet = { getRows: async () => rows, addRow: async values => rows.push(row(values)) };
  global.transactionsSheet = { getRows: async () => [] };
  budgets.clearPendingBudgetInput(1);
});

test('editing starts in the selected month and category buttons fit Telegram limits', async () => {
  const month = budgets.getNextMonthKey();
  const ctx = context(`budget_add:${month}`);
  await budgets.showBudgetCategories(ctx);
  assert.match(ctx.replies[0].message, new RegExp(month));
  assert.match(ctx.replies[0].options.reply_markup.inline_keyboard[0][0].callback_data, new RegExp(month));
  for (const type of ['expense', 'income']) {
    const picker = context(`budget_type:${month}:${type}`);
    await budgets.handleBudgetTypeSelected(picker);
    for (const button of picker.replies[0].options.reply_markup.inline_keyboard.flat()) {
      assert.ok(Buffer.byteLength(button.callback_data) <= 64);
    }
  }
});

test('existing limits are shown and grouped decimal input updates the same row', async () => {
  const month = budgets.getCurrentMonthKey();
  rows.push(row({ Месяц: month, Тип: 'расход', Категория: 'кафе', Лимит: 10000, Валюта: '₽' }));
  const picker = context(`budget_type:${month}:expense`);
  await budgets.handleBudgetTypeSelected(picker);
  const button = picker.replies[0].options.reply_markup.inline_keyboard.flat().find(b => b.text.startsWith('кафе:'));
  assert.ok(button);
  const selected = context(button.callback_data);
  await budgets.handleBudgetCategorySelected(selected);
  assert.match(selected.replies[0].message, /Текущий лимит:/);
  assert.equal(await budgets.handleBudgetAmountInput(context(null, '15 000,50')), true);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].get('Лимит'), 15000.5);
});

test('currency buttons set the correct currency and reject invalid amounts', async () => {
  const month = budgets.getCurrentMonthKey();
  const picker = context(`budget_type:${month}:income`);
  await budgets.handleBudgetTypeSelected(picker);
  const button = picker.replies[0].options.reply_markup.inline_keyboard[0][0];
  const selected = context(button.callback_data);
  await budgets.handleBudgetCategorySelected(selected);
  const dollar = selected.replies[0].options.reply_markup.inline_keyboard[0].find(b => b.text === '$');
  await budgets.handleBudgetCategorySelected(context(dollar.callback_data));
  for (const amount of ['Infinity', '1e5', '12 34', '-20', '0']) {
    await budgets.handleBudgetAmountInput(context(null, amount));
    assert.equal(rows.length, 0);
  }
  await budgets.handleBudgetAmountInput(context(null, '2\u202f000,25'));
  assert.equal(rows[0].get('Валюта'), '$');
  assert.equal(rows[0].get('Тип'), 'доход');
  assert.equal(rows[0].get('Лимит'), 2000.25);
});

test('legacy category buttons work and cancel prevents saving', async () => {
  const month = budgets.getCurrentMonthKey();
  await budgets.handleBudgetCategorySelected(context(`budgetcat:${month}:расход:кафе`));
  await budgets.handleBudgetCancel(context('budget_cancel'));
  assert.equal(await budgets.handleBudgetAmountInput(context(null, '1000')), false);
  assert.equal(rows.length, 0);
});

test('commands accept grouped amounts and cannot save invalid months', async () => {
  await budgets.handleSetBudget(context(null, '/бюджет кафе 15 000,50'));
  assert.equal(rows[0].get('Лимит'), 15000.5);
  const ctx = context(null, '/бюджет 2026-13 кафе 2000');
  await budgets.handleSetBudget(ctx);
  assert.equal(rows.length, 1);
  assert.match(ctx.replies[0].message, /Некорректный месяц/);
});
