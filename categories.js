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

  развлечения: [
    'развлечения',
    'кино',
    'бар',
    'клуб',
    'театр',
    'концерт'
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
  ]
};

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeCategory(category) {
  const value = normalizeText(category);

  if (!value) {
    return 'разное';
  }

  for (const [categoryName, synonyms] of Object.entries(CATEGORY_SYNONYMS)) {
    if (synonyms.includes(value)) {
      return categoryName;
    }
  }

  return value;
}

function getCategoryList() {
  return Object.keys(CATEGORY_SYNONYMS).sort();
}

module.exports = {
  CATEGORY_SYNONYMS,
  normalizeCategory,
  getCategoryList
};
