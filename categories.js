// categories.js

const CATEGORY_SYNONYMS = {
  кафе: [
    'кофе',
    'кафе',
    'кофейня',
    'капучино',
    'латте',
    'американо',
    'эспрессо',
    'ресторан',
    'еда вне дома',
    'бургер',
    'шаурма'
  ],

  продукты: [
    'продукты',
    'еда',
    'магнит',
    'пятерочка',
    'пятёрочка',
    'перекресток',
    'перекрёсток',
    'лента',
    'ашан',
    'самокат',
    'лавка',
    'вкусвилл'
  ],

  транспорт: [
    'такси',
    'яндекс такси',
    'uber',
    'убер',
    'транспорт',
    'метро',
    'автобус',
    'парковка',
    'бензин',
    'топливо'
  ],

  связь: [
    'связь',
    'телефон',
    'интернет',
    'мтс',
    'билайн',
    'мегафон',
    'теле2'
  ],

  здоровье: [
    'здоровье',
    'аптека',
    'лекарства',
    'врач',
    'стоматолог',
    'анализы',
    'витамины'
  ],

  одежда: [
    'одежда',
    'обувь',
    'магазин одежды',
    'ламода',
    'wb',
    'wildberries',
    'озон',
    'ozon'
  ],

  дом: [
    'дом',
    'быт',
    'хоз',
    'хозтовары',
    'ремонт',
    'мебель',
    'посуда'
  ],

  жилье: [
    'жилье',
    'жильё',
    'аренда',
    'ипотека',
    'квартира',
    'съем',
    'съём',
    'съем квартиры',
    'съём квартиры',
    'коммуналка',
    'жкх'
  ],

  дети: [
    'дети',
    'ребенок',
    'ребёнок',
    'алименты',
    'кружки',
    'кружок',
    'школа',
    'садик',
    'детский сад',
    'игрушки',
    'детская одежда',
    'няня'
  ],

  спорт: [
    'спорт',
    'тренер',
    'зал',
    'фитнес',
    'спортзал',
    'абонемент',
    'бассейн',
    'тренировка',
    'персоналка'
  ],

  алкоголь: [
    'алкоголь',
    'пиво',
    'вино',
    'виски',
    'коньяк',
    'водка',
    'шампанское',
    'просекко',
    'бар'
  ],

  развлечения: [
    'развлечения',
    'кино',
    'клуб',
    'театр',
    'концерт',
    'игры'
  ],

  вредные_привычки: [
    'сигареты',
    'табак',
    'вейп',
    'одноразка',
    'курение'
  ],

  подарки: [
    'подарок',
    'подарки',
    'цветы'
  ],

  зарплата: [
    'зарплата',
    'зп',
    'аванс',
    'премия'
  ],

  кешбэк: [
    'кешбэк',
    'кэшбэк',
    'cashback'
  ],

  прочее: [
    'прочее',
    'разное',
    'другое'
  ]
};

const INCOME_CATEGORIES = [
  'зарплата',
  'кешбэк'
];

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeCategory(category) {
  const value = normalizeText(category);

  if (!value) {
    return 'прочее';
  }

  // 1. Точное совпадение
  for (const [categoryName, synonyms] of Object.entries(CATEGORY_SYNONYMS)) {
    const normalizedSynonyms = synonyms.map(normalizeText);

    if (normalizedSynonyms.includes(value)) {
      return categoryName;
    }
  }

  // 2. Поиск синонима внутри фразы
  // Например: "аренда квартиры" → жилье, "тренер зал" → спорт
  for (const [categoryName, synonyms] of Object.entries(CATEGORY_SYNONYMS)) {
    for (const synonym of synonyms) {
      const normalizedSynonym = normalizeText(synonym);

      if (!normalizedSynonym || normalizedSynonym.length < 3) {
        continue;
      }

      const regex = new RegExp(`(^|\\s)${escapeRegExp(normalizedSynonym)}($|\\s)`, 'i');

      if (regex.test(value)) {
        return categoryName;
      }
    }
  }

  return value;
}

function getCategoryList() {
  return Object.keys(CATEGORY_SYNONYMS).sort();
}

function getExpenseCategoryList() {
  return getCategoryList().filter(category => {
    return !INCOME_CATEGORIES.includes(category);
  });
}

function getIncomeCategoryList() {
  return [...INCOME_CATEGORIES];
}

function isKnownCategory(category) {
  const normalized = normalizeCategory(category);
  return Object.prototype.hasOwnProperty.call(CATEGORY_SYNONYMS, normalized);
}

function isIncomeCategory(category) {
  const normalized = normalizeCategory(category);
  return INCOME_CATEGORIES.includes(normalized);
}

function isExpenseCategory(category) {
  const normalized = normalizeCategory(category);
  return isKnownCategory(normalized) && !isIncomeCategory(normalized);
}

module.exports = {
  CATEGORY_SYNONYMS,
  INCOME_CATEGORIES,
  normalizeCategory,
  getCategoryList,
  getExpenseCategoryList,
  getIncomeCategoryList,
  isKnownCategory,
  isIncomeCategory,
  isExpenseCategory
};
