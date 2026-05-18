// utils.js

const DEFAULT_WALLET = 'карта';

const WALLET_SYNONYMS = {
  карта: [
    'карта',
    'карт',
    'к',
    'card',
    'bank',
    'банк'
  ],

  наличка: [
    'наличка',
    'наличные',
    'нал',
    'кэш',
    'кеш',
    'cash'
  ],

  депозит: [
    'депозит',
    'деп',
    'deposit',
    'вклад'
  ],

  доллары: [
    'доллары',
    'доллар',
    'дол',
    'баксы',
    'usd',
    '$'
  ],

  евро: [
    'евро',
    'eur',
    '€'
  ],

  зарубежная_карта: [
    'зарубежная_карта',
    'зарубежная карта',
    'зарубежка',
    'зар карта',
    'заркарта',
    'иностранная карта',
    'foreign_card',
    'foreign'
  ]
};

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/^#/, '')
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ');
}

function findWalletName(wallet) {
  const w = normalizeText(wallet);

  if (!w) {
    return null;
  }

  for (const [walletName, synonyms] of Object.entries(WALLET_SYNONYMS)) {
    if (synonyms.map(normalizeText).includes(w)) {
      return walletName;
    }
  }

  return null;
}

function normWallet(wallet, fallback = DEFAULT_WALLET) {
  return findWalletName(wallet) || fallback;
}

function parseSheetNumber(value, fallback = 0) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }

  let str = String(value ?? '')
    .trim()
    .replace(/\u00a0/g, ' ')
    .replace(/[₽$€]/g, '')
    .replace(/\s+/g, '')
    .replace(/[^0-9,.-]/g, '');

  if (!str) {
    return fallback;
  }

  const commaIndex = str.lastIndexOf(',');
  const dotIndex = str.lastIndexOf('.');

  if (commaIndex !== -1 && dotIndex !== -1) {
    if (commaIndex > dotIndex) {
      // Формат 1.234,56
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // Формат 1,234.56
      str = str.replace(/,/g, '');
    }
  } else if (commaIndex !== -1) {
    // Формат 1234,56
    str = str.replace(',', '.');
  }

  const num = Number(str);
  return Number.isFinite(num) ? num : fallback;
}

function findWalletAtEnd(text) {
  const source = String(text || '').trim();

  const candidates = [];

  for (const [walletName, synonyms] of Object.entries(WALLET_SYNONYMS)) {
    synonyms.forEach(synonym => {
      candidates.push({
        wallet: walletName,
        synonym
      });
    });
  }

  // Сначала проверяем длинные варианты, чтобы "зарубежная карта"
  // нашлась раньше, чем просто "карта"
  candidates.sort((a, b) => b.synonym.length - a.synonym.length);

  for (const candidate of candidates) {
    const escaped = candidate.synonym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const regex = new RegExp(`(?:^|\\s)(${escaped})$`, 'i');

    if (regex.test(source)) {
      const cleaned = source.replace(regex, '').trim();

      return {
        wallet: candidate.wallet,
        cleaned
      };
    }
  }

  return null;
}

function extractWallet(text) {
  const source = String(text || '').trim();

  // 1. Сначала ищем кошелёк через #
  // Примеры:
  // кофе 300 #нал
  // кофе 300 #наличка
  // кофе 300 #зарубежная_карта
  const hashMatch = source.match(/#([а-яА-ЯёЁa-zA-Z0-9_ ]+)$/);

  if (hashMatch) {
    const rawWallet = hashMatch[1].trim();
    const wallet = normWallet(rawWallet, null);
    const cleaned = source.replace(hashMatch[0], '').trim();

    return {
      wallet: wallet || DEFAULT_WALLET,
      cleaned,
      unknownWallet: wallet ? '' : rawWallet
    };
  }

  // 2. Потом ищем кошелёк последним словом/словами без #
  // Примеры:
  // кофе 300 нал
  // кофе 300 наличка
  // кофе 300 карта
  // кофе 300 зарубежная карта
  const walletAtEnd = findWalletAtEnd(source);

  if (walletAtEnd) {
    return walletAtEnd;
  }

  // 3. Если кошелёк не указан — карта по умолчанию
  return {
    wallet: DEFAULT_WALLET,
    cleaned: source
  };
}

function walletCurrency(wallet) {
  const w = normWallet(wallet);

  if (w === 'доллары' || w === 'зарубежная_карта') {
    return '$';
  }

  if (w === 'евро') {
    return '€';
  }

  return '₽';
}

module.exports = {
  DEFAULT_WALLET,
  WALLET_SYNONYMS,
  findWalletName,
  normWallet,
  extractWallet,
  walletCurrency,
  parseSheetNumber
};
