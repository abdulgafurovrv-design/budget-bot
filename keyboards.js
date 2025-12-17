const { Markup } = require('telegraf');

function mainKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Баланс", "balance"), Markup.button.callback("Отчёт", "report")],
    [Markup.button.callback("Должники", "debtors"), Markup.button.callback("Перевод", "transfer")],
    [Markup.button.callback("Расход +", "expense"), Markup.button.callback("Доход +", "income")]
  ]);
}

function cancelLastKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Отменить последнюю", "cancel_last")]
  ]);
}

function menuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Меню", "menu")]
  ]);
}

module.exports = { mainKeyboard, cancelLastKeyboard, menuKeyboard };
