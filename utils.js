const DEFAULT_WALLET = 'карта';

function normWallet(wallet) {
  const w = String(wallet || '')
    .toLowerCase()
    .trim()
    .replace(/^#/, '');

  if (['карта', 'card'].includes(w)) return 'карта';
  if (['наличка', 'наличные', 'cash'].includes(w)) return 'наличка';
  if (['депозит', 'deposit'].includes(w)) return 'депозит';
  if (['евро', 'eur', 'euro'].includes(w)) return 'евро';
  if (['доллары', 'доллар', 'usd', 'dollar'].includes(w)) return 'доллары';

  if (
    [
      'зарубежная карта',
      'зарубежная_карта',
      'заркарт',
      'заркарта',
      'foreign_card',
      'foreign'
    ].includes(w)
  ) return 'зарубежная_карта';

  return DEFAULT_WALLET;
}

function extractWallet(text) {
  const str = String(text || '');

  const walletMatch = str.match(/#([а-яА-ЯёЁa-zA-Z0-9_ ]+)/);

  if (!walletMatch) {
    return {
      wallet: DEFAULT_WALLET,
      cleaned: str
    };
  }

  const rawWallet = walletMatch[1].trim();
  const wallet = normWallet(rawWallet);
  const cleaned = str.replace(walletMatch[0], '').trim();

  return { wallet, cleaned };
}

module.exports = {
  DEFAULT_WALLET,
  normWallet,
  extractWallet
};
