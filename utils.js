const DEFAULT_WALLET = 'карта';

function normWallet(w) {
  w = String(w || '').toLowerCase().trim();
  if (/^нал/.test(w)) return 'наличка';
  if (/^карт/.test(w)) return 'карта';
  if (/^евро/.test(w)) return 'евро';
  if (/^доллар|бакс|usd/.test(w)) return 'доллары';
  if (/^деп|вклад/.test(w)) return 'депозит';
  if (/^долг/.test(w)) return 'долги';
  return w || DEFAULT_WALLET;
}

function extractWallet(text) {
  const m = text.match(/#([а-яa-z0-9_]+)/i);
  if (m) {
    return { wallet: normWallet(m[1]), cleaned: text.replace(m[0], '').trim() };
  }
  return { wallet: DEFAULT_WALLET, cleaned: text };
}

module.exports = { normWallet, extractWallet, DEFAULT_WALLET };
