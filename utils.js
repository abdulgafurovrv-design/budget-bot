const DEFAULT_WALLET = "карта";

function normWallet(w) {
  w = String(w || "").toLowerCase().trim();
  if (/^нал/.test(w)) return "наличка";
  if (/^карт/.test(w)) return "карта";
  if (/^евро/.test(w)) return "евро";
  if (/^доллар|бакс|usd/.test(w)) return "доллары";
  if (/^деп|вклад/.test(w)) return "депозит";
  if (/^долг/.test(w)) return "долги";
  return w || DEFAULT_WALLET;
}

function extractWallet(text) {
  const m = text.match(/#([а-яa-z0-9_]+)/i);
  if (m) {
    const wallet = normWallet(m[1]);
    const cleaned = text.replace(m[0], "").trim();
    return { wallet, cleaned };
  }
  return { wallet: DEFAULT_WALLET, cleaned: text };
}

function parseFreeInput(text) {
  const { wallet, cleaned } = extractWallet(text);
  const words = cleaned.split(/\s+/);

  let amount = 0;
  let amountIndex = -1;

  for (let i = 0; i < words.length; i++) {
    if (/^[-+]?[0-9]*\.?[0-9]+$/.test(words[i])) {
      amount = parseFloat(words[i]);
      amountIndex = i;
      break;
    }
  }

  if (amountIndex === -1 || amount <= 0) return null;

  const hasPlus = text.includes("+") || words.some(w => /зарплат|зп|аванс|кешбэк|подарок/i.test(w));
  const kind = hasPlus ? "доход" : "расход";
  amount = Math.abs(amount);

  let categoryWords = [...words];
  categoryWords.splice(amountIndex, 1);
  let category = categoryWords.join(" ").trim() || "разное";

  return { amount, category, kind, wallet };
}

module.exports = { normWallet, extractWallet, parseFreeInput };
