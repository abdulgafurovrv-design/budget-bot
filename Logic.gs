/***** Logic.gs — полная обработка сообщений с рабочими кнопками *****/

function handleText(chatId, text) {
  text = text.trim();
  const lowerText = text.toLowerCase();

  // Сохраняем chatId для автоотчёта
  PROPS.setProperty("CHAT_ID", chatId);

  // === Справка ===
  if (text === "/start" || text === "/help") {
    sendMessage(chatId, helpText_(), mainKeyboard());
    return;
  }

  // === Баланс ===
  if (text === "/баланс" || text === "/balance") {
    const balances = getBalance();
    let msg = "<b>Баланс по кошелькам:</b>\n\n";

    const mainWallets = ["карта", "наличка", "депозит", "долги"];
    let total = 0;

    mainWallets.forEach(w => {
      const bal = balances[w] || 0;
      total += bal;
      msg += `• ${w.charAt(0).toUpperCase() + w.slice(1)}: ${bal.toFixed(2)} ₽\n`;
    });

    msg += `\n• Евро: ${(balances["евро"] || 0).toFixed(2)} ₽\n`;
    msg += `• Доллары: ${(balances["доллары"] || 0).toFixed(2)} ₽\n`;

    msg += `\n<b>ИТОГ (основные):</b> ${total.toFixed(2)} ₽`;

    sendMessage(chatId, msg, menuKeyboard());
    return;
  }

  // === Отчёт ===
  if (text === "/отчет" || text === "/report") {
    sendMessage(chatId, getReport(), menuKeyboard());
    return;
  }

  // === Должники ===
  if (text === "/debtors") {
    const list = getDebtorsList();
    if (list.length === 0) {
      sendMessage(chatId, "Нет должников 😎", menuKeyboard());
    } else {
      let msg = "<b>Список должников:</b>\n\n";
      list.forEach(d => {
        msg += `• ${d.debtor}: ${d.amount.toFixed(2)} ₽\n`;
      });
      sendMessage(chatId, msg, menuKeyboard());
    }
    return;
  }

  // === Начальный остаток ===
  if (text.startsWith("/остаток ") || text.startsWith("/opening ")) {
    const parts = text.split(" ");
    if (parts.length < 3) {
      sendMessage(chatId, "Формат: /остаток <кошелёк> <сумма>\nПример: /остаток карта 50000", menuKeyboard());
      return;
    }
    const wallet = normWallet(parts[1]);
    const amount = parseFloat(parts[2]);
    if (isNaN(amount)) {
      sendMessage(chatId, "Сумма должна быть числом", menuKeyboard());
      return;
    }
    setOpeningBalance(wallet, amount);
    const currentBalance = getBalance(wallet).toFixed(2);
    sendMessage(chatId, `Начальный остаток для "${wallet}" установлен: ${amount.toFixed(2)} ₽\nТекущий баланс: ${currentBalance} ₽`, menuKeyboard());
    return;
  }

  // === Перевод между кошельками ===
  if (text.startsWith("/перевод ") || text.startsWith("/transfer ")) {
    const parts = text.split(" ");
    if (parts.length < 4) {
      sendMessage(chatId, "Формат: /перевод <сумма> <с кошелька> <на кошелёк> [коммент]", menuKeyboard());
      return;
    }
    const amount = parseFloat(parts[1]);
    const fromWallet = normWallet(parts[2]);
    const toWallet = normWallet(parts[3]);
    const comment = parts.slice(4).join(" ");

    if (isNaN(amount) || amount <= 0) {
      sendMessage(chatId, "Сумма должна быть положительной", menuKeyboard());
      return;
    }
    if (fromWallet === toWallet) {
      sendMessage(chatId, "Кошельки должны быть разными", menuKeyboard());
      return;
    }

    addTransaction("расход", amount, "перевод", `На ${toWallet}${comment ? " (" + comment + ")" : ""}`, fromWallet);
    addTransaction("доход", amount, "перевод", `С ${fromWallet}${comment ? " (" + comment + ")" : ""}`, toWallet);

    const balances = getBalance();
    const balanceFrom = balances[fromWallet].toFixed(2);
    const balanceTo = balances[toWallet].toFixed(2);
    sendMessage(chatId, `Перевод ${amount.toFixed(2)} ₽\nС #${fromWallet} (баланс: ${balanceFrom} ₽) → на #${toWallet} (баланс: ${balanceTo} ₽)${comment ? " (" + comment + ")" : ""}`, cancelLastKeyboard());
    return;
  }

  // === Удаление ===
  if (text.startsWith("/удалить ") || text.startsWith("/delete ")) {
    const parts = text.split(" ");
    if (parts.length < 2) {
      sendMessage(chatId, "Формат: /удалить <ID> [debts]", menuKeyboard());
      return;
    }
    const id = parseInt(parts[1]);
    if (isNaN(id)) {
      sendMessage(chatId, "ID должен быть числом", menuKeyboard());
      return;
    }
    const isDebt = parts[2] && parts[2].toLowerCase() === "debts";

    if (isDebt) {
      if (deleteDebt(id)) {
        sendMessage(chatId, `Долг ID ${id} удалён`, menuKeyboard());
      } else {
        sendMessage(chatId, `Долг ID ${id} не найден`, menuKeyboard());
      }
    } else {
      if (deleteTransaction(id)) {
        sendMessage(chatId, `Транзакция ID ${id} удалена`, menuKeyboard());
      } else {
        sendMessage(chatId, `Транзакция ID ${id} не найдена`, menuKeyboard());
      }
    }
    return;
  }

  // === Обработка долгов ===
  if (lowerText.startsWith("дал ") || lowerText.startsWith("/дал ")) {
    const parts = text.split(" ");
    if (parts.length < 3) {
      sendMessage(chatId, "Формат: дал <Имя> <сумма> [коммент]", menuKeyboard());
      return;
    }
    const debtor = parts[1].charAt(0).toUpperCase() + parts[1].slice(1).toLowerCase();
    const amount = parseFloat(parts[2]);
    const comment = parts.slice(3).join(" ");
    if (isNaN(amount) || amount <= 0) {
      sendMessage(chatId, "Сумма должна быть положительной", menuKeyboard());
      return;
    }

    const { wallet: issueWallet } = extractWallet(text);
    const usedWallet = issueWallet !== DEFAULT_WALLET ? issueWallet : DEFAULT_ISSUE_WALLET;

    addTransaction("расход", amount, "долг выдан", `Дал ${debtor}${comment ? " (" + comment + ")" : ""}`, usedWallet);
    addDebt("issue", debtor, amount, comment);

    const balances = getBalance();
    const currentBalance = balances[usedWallet].toFixed(2);
    sendMessage(chatId, `Выдал долг ${debtor}: ${amount.toFixed(2)} ₽\nСписано с #${usedWallet}\nБаланс: ${currentBalance} ₽${comment ? " (" + comment + ")" : ""}`, cancelLastKeyboard());
    return;
  }

  if (lowerText.startsWith("вернули ") || lowerText.startsWith("/вернули ")) {
    const parts = text.split(" ");
    if (parts.length < 3) {
      sendMessage(chatId, "Формат: вернули <Имя> <сумма> [коммент]", menuKeyboard());
      return;
    }
    const debtor = parts[1].charAt(0).toUpperCase() + parts[1].slice(1).toLowerCase();
    const amount = parseFloat(parts[2]);
    const comment = parts.slice(3).join(" ");
    if (isNaN(amount) || amount <= 0) {
      sendMessage(chatId, "Сумма должна быть положительной", menuKeyboard());
      return;
    }

    const { wallet: returnWallet } = extractWallet(text);
    const usedWallet = returnWallet !== DEFAULT_WALLET ? returnWallet : DEFAULT_RETURN_WALLET;

    addTransaction("доход", amount, "возврат долга", `Вернули от ${debtor}${comment ? " (" + comment + ")" : ""}`, usedWallet);
    addDebt("return", debtor, amount, comment);

    const balances = getBalance();
    const currentBalance = balances[usedWallet].toFixed(2);
    sendMessage(chatId, `Вернули долг от ${debtor}: ${amount.toFixed(2)} ₽\nДобавлено в #${usedWallet}\nБаланс: ${currentBalance} ₽${comment ? " (" + comment + ")" : ""}`, cancelLastKeyboard());
    return;
  }

  if (lowerText.startsWith("добавить долг ") || lowerText.startsWith("/добавить_долг ")) {
    const parts = text.split(" ");
    let startIndex = lowerText.startsWith("/добавить_долг ") ? 1 : 2;
    if (parts.length < startIndex + 2) {
      sendMessage(chatId, "Формат: добавить долг <Имя> <сумма> [коммент]", menuKeyboard());
      return;
    }
    const debtor = parts[startIndex].charAt(0).toUpperCase() + parts[startIndex].slice(1).toLowerCase();
    const amount = parseFloat(parts[startIndex + 1]);
    const comment = parts.slice(startIndex + 2).join(" ");
    if (isNaN(amount) || amount <= 0) {
      sendMessage(chatId, "Сумма должна быть положительной", menuKeyboard());
      return;
    }

    addDebt("opening", debtor, amount, comment);

    const balances = getBalance();
    const currentBalance = balances["долги"].toFixed(2);
    sendMessage(chatId, `Добавлен текущий долг от ${debtor}: ${amount.toFixed(2)} ₽\nБаланс долгов: ${currentBalance} ₽${comment ? " (" + comment + ")" : ""}`, cancelLastKeyboard());
    return;
  }

  // === Свободный ввод ===
  const parsed = parseFreeInput(text);
  if (parsed) {
    addTransaction(parsed.kind, parsed.amount, parsed.category, "", parsed.wallet);
    const kindText = parsed.kind === "доход" ? "доход" : "расход";
    const balances = getBalance();
    const currentBalance = balances[parsed.wallet].toFixed(2);
    sendMessage(chatId, `Добавлен ${kindText}: ${parsed.amount.toFixed(2)} ₽ — ${parsed.category}\nКошелёк: #${parsed.wallet}\nБаланс: ${currentBalance} ₽`, cancelLastKeyboard());
    return;
  }

  // === Неизвестная команда ===
  sendMessage(chatId, "Команда не поддерживается 😅\nНапиши /start для меню", mainKeyboard());
}

// === Обработка нажатий на кнопки ===
function handleCallback(chatId, data) {
  if (data === "balance") {
    handleText(chatId, "/баланс");
  } else if (data === "report") {
    handleText(chatId, "/отчет");
  } else if (data === "debtors") {
    handleText(chatId, "/debtors");
  } else if (data === "menu") {
    sendMessage(chatId, "Главное меню", mainKeyboard());
  } else if (data === "cancel_last") {
    sendMessage(chatId, "Отмена последней — в разработке 😅\nНапиши /удалить <ID> вручную");
  } else {
    sendMessage(chatId, "Неизвестная кнопка");
  }
}
