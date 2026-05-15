const { Markup } = require('telegraf');

function mainKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('Баланс', 'balance'),
      Markup.button.callback('Отчёт', 'report')
    ],
    [
      Markup.button.callback('Бюджеты', 'budgets'),
      Markup.button.callback('Должники', 'debtors')
    ],
    [
      Markup.button.callback('Перевод', 'transfer'),
      Markup.button.callback('Обмен', 'exchange_help')
    ],
    [
      Markup.button.callback('Расход +', 'add_expense'),
      Markup.button.callback('Доход +', 'add_income')
    ]
  ]);
}

function menuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Меню', 'menu')]
  ]);
}

function cancelLastKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Отменить последнюю', 'cancel_last')],
    [Markup.button.callback('Меню', 'menu')]
  ]);
}

module.exports = {
  mainKeyboard,
  menuKeyboard,
  cancelLastKeyboard
};
