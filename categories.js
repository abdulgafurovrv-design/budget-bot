// categories.js

const CATEGORY_DATA = {
  кафе: {
    synonyms: [
      'кофе',
      'кафе',
      'кофейня',
      'капучино',
      'латте',
      'американо',
      'эспрессо',
      'ресторан',
      'еда вне дома',
      'завтрак',
      'обед',
      'бургер',
      'шаурма'
    ],
    subcategories: {
      завтрак: ['завтрак'],
      обед: ['обед'],
      кофе: ['кофе', 'капучино', 'латте', 'американо', 'эспрессо'],
      ресторан: ['ресторан'],
      фастфуд: ['бургер', 'шаурма', 'фастфуд'],
      кофейня: ['кофейня'],
      доставка_еды: ['доставка еды', 'еда вне дома']
    }
  },

  продукты: {
    synonyms: [
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
      'вкусвилл',
      'рынок'
    ],
    subcategories: {
      магнит: ['магнит'],
      пятерочка: ['пятерочка', 'пятёрочка'],
      перекресток: ['перекресток', 'перекрёсток'],
      лента: ['лента'],
      ашан: ['ашан'],
      вкусвилл: ['вкусвилл'],
      самокат: ['самокат'],
      лавка: ['лавка'],
      рынок: ['рынок'],
      продукты: ['продукты', 'еда']
    }
  },

  транспорт: {
    synonyms: [
      'такси',
      'яндекс такси',
      'uber',
      'убер',
      'транспорт',
      'метро',
      'автобус',
      'парковка',
      'бензин',
      'топливо',
      'мойка',
      'ремонт авто'
    ],
    subcategories: {
      такси: ['такси', 'яндекс такси', 'uber', 'убер'],
      бензин: ['бензин', 'топливо'],
      парковка: ['парковка'],
      метро: ['метро'],
      автобус: ['автобус'],
      мойка: ['мойка'],
      ремонт_авто: ['ремонт авто']
    }
  },

  связь: {
    synonyms: [
      'связь',
      'телефон',
      'интернет',
      'мтс',
      'билайн',
      'мегафон',
      'теле2',
      'подписка',
      'подписки'
    ],
    subcategories: {
      телефон: ['телефон', 'мтс', 'билайн', 'мегафон', 'теле2'],
      интернет: ['интернет'],
      подписки: ['подписка', 'подписки']
    }
  },

  здоровье: {
    synonyms: [
      'здоровье',
      'аптека',
      'лекарства',
      'врач',
      'стоматолог',
      'анализы',
      'витамины'
    ],
    subcategories: {
      аптека: ['аптека', 'лекарства'],
      врач: ['врач'],
      стоматолог: ['стоматолог'],
      анализы: ['анализы'],
      витамины: ['витамины']
    }
  },

  одежда: {
    synonyms: [
      'одежда',
      'обувь',
      'магазин одежды',
      'ламода',
      'wb',
      'wildberries',
      'озон',
      'ozon',
      'химчистка'
    ],
    subcategories: {
      одежда: ['одежда', 'магазин одежды'],
      обувь: ['обувь'],
      маркетплейсы: ['ламода', 'wb', 'wildberries', 'озон', 'ozon'],
      химчистка: ['химчистка']
    }
  },

  дом: {
    synonyms: [
      'дом',
      'быт',
      'хоз',
      'хозтовары',
      'ремонт',
      'мебель',
      'посуда',
      'техника'
    ],
    subcategories: {
      хозтовары: ['хоз', 'хозтовары', 'быт'],
      ремонт: ['ремонт'],
      мебель: ['мебель'],
      посуда: ['посуда'],
      техника: ['техника'],
      дом: ['дом']
    }
  },
  хоз_нужды: {
    synonyms: [
      'хоз нужды',
      'хоз_нужды',
      'хознужды',
      'бытовые услуги',
      'услуги',
      'парикмахер',
      'парикмахерская',
      'стрижка',
      'барбер',
      'барбершоп',
      'салон',
      'ремонт обуви',
      'обувная мастерская',
      'ателье',
      'ремонт одежды',
      'химчистка',
      'ключи',
      'изготовление ключей'
    ],
    subcategories: {
      парикмахер: [
        'парикмахер',
        'парикмахерская',
        'стрижка',
        'барбер',
        'барбершоп',
        'салон'
      ],
      ремонт_обуви: [
        'ремонт обуви',
        'обувная мастерская'
      ],
      ателье: [
        'ателье',
        'ремонт одежды'
      ],
      химчистка: [
        'химчистка'
      ],
      ключи: [
        'ключи',
        'изготовление ключей'
      ],
      бытовые_услуги: [
        'хоз нужды',
        'хоз_нужды',
        'хознужды',
        'бытовые услуги',
        'услуги'
      ]
    }
  },
  жилье: {
    synonyms: [
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
    subcategories: {
      аренда: ['аренда', 'съем', 'съём', 'съем квартиры', 'съём квартиры'],
      ипотека: ['ипотека'],
      жкх: ['жкх', 'коммуналка'],
      квартира: ['квартира']
    }
  },

  дети: {
    synonyms: [
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
    subcategories: {
      алименты: ['алименты'],
      кружки: ['кружки', 'кружок'],
      школа: ['школа'],
      садик: ['садик', 'детский сад'],
      игрушки: ['игрушки'],
      одежда: ['детская одежда'],
      няня: ['няня'],
      дети: ['дети', 'ребенок', 'ребёнок']
    }
  },

  спорт: {
    synonyms: [
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
    subcategories: {
      тренер: ['тренер', 'персоналка'],
      зал: ['зал', 'фитнес', 'спортзал'],
      абонемент: ['абонемент'],
      бассейн: ['бассейн'],
      тренировка: ['тренировка'],
      спорт: ['спорт']
    }
  },

  алкоголь: {
    synonyms: [
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
    subcategories: {
      пиво: ['пиво'],
      вино: ['вино'],
      крепкий_алкоголь: ['виски', 'коньяк', 'водка'],
      шампанское: ['шампанское', 'просекко'],
      бар: ['бар'],
      алкоголь: ['алкоголь']
    }
  },

  развлечения: {
    synonyms: [
      'развлечения',
      'кино',
      'клуб',
      'театр',
      'концерт',
      'игры'
    ],
    subcategories: {
      кино: ['кино'],
      театр: ['театр'],
      концерт: ['концерт'],
      игры: ['игры'],
      клуб: ['клуб'],
      развлечения: ['развлечения']
    }
  },

  вредные_привычки: {
    synonyms: [
      'сигареты',
      'табак',
      'вейп',
      'одноразка',
      'курение'
    ],
    subcategories: {
      сигареты: ['сигареты'],
      вейп: ['вейп', 'одноразка'],
      табак: ['табак'],
      курение: ['курение']
    }
  },

  подарки: {
    synonyms: [
      'подарок',
      'подарки',
      'цветы',
      'праздник',
      'праздники'
    ],
    subcategories: {
      цветы: ['цветы'],
      подарки: ['подарок', 'подарки'],
      праздники: ['праздник', 'праздники']
    }
  },

  зарплата: {
    synonyms: [
      'зарплата',
      'зп',
      'аванс',
      'премия'
    ],
    subcategories: {
      зарплата: ['зарплата', 'зп'],
      аванс: ['аванс'],
      премия: ['премия']
    }
  },

  кешбэк: {
    synonyms: [
      'кешбэк',
      'кэшбэк',
      'cashback'
    ],
    subcategories: {
      кешбэк: ['кешбэк', 'кэшбэк', 'cashback']
    }
  },

  прочее: {
    synonyms: [
      'прочее',
      'разное',
      'другое'
    ],
    subcategories: {
      прочее: ['прочее', 'разное', 'другое']
    }
  }
};

const INCOME_CATEGORIES = [
  'зарплата',
  'кешбэк'
];

const CATEGORY_SYNONYMS = Object.fromEntries(
  Object.entries(CATEGORY_DATA).map(([category, data]) => {
    return [category, data.synonyms];
  })
);

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

function findMatchInList(value, list) {
  const normalizedValue = normalizeText(value);
  const normalizedList = list.map(normalizeText);

  if (normalizedList.includes(normalizedValue)) {
    return true;
  }

  for (const item of normalizedList) {
    if (!item || item.length < 3) continue;

    const regex = new RegExp(`(^|\\s)${escapeRegExp(item)}($|\\s)`, 'i');

    if (regex.test(normalizedValue)) {
      return true;
    }
  }

  return false;
}

function normalizeCategory(category) {
  const info = getCategoryInfo(category);
  return info.category;
}

function getCategoryInfo(input) {
  const value = normalizeText(input);

  if (!value) {
    return {
      category: 'прочее',
      subcategory: 'прочее',
      isKnown: true
    };
  }

  for (const [categoryName, data] of Object.entries(CATEGORY_DATA)) {
    if (findMatchInList(value, data.synonyms)) {
      const subcategory = detectSubcategory(value, categoryName);

      return {
        category: categoryName,
        subcategory,
        isKnown: true
      };
    }
  }

  return {
    category: value,
    subcategory: value,
    isKnown: false
  };
}

function detectSubcategory(input, category) {
  const value = normalizeText(input);
  const data = CATEGORY_DATA[category];

  if (!data || !data.subcategories) {
    return category;
  }

  for (const [subcategoryName, synonyms] of Object.entries(data.subcategories)) {
    if (findMatchInList(value, synonyms)) {
      return subcategoryName;
    }
  }

  return category;
}

function getCategoryList() {
  return Object.keys(CATEGORY_DATA).sort();
}

function getExpenseCategoryList() {
  return getCategoryList().filter(category => {
    return !INCOME_CATEGORIES.includes(category);
  });
}

function getIncomeCategoryList() {
  return [...INCOME_CATEGORIES];
}

function getSubcategoryList(category) {
  const normalizedCategory = normalizeCategory(category);
  const data = CATEGORY_DATA[normalizedCategory];

  if (!data || !data.subcategories) {
    return [];
  }

  return Object.keys(data.subcategories).sort();
}

function isKnownCategory(category) {
  const normalized = normalizeCategory(category);
  return Object.prototype.hasOwnProperty.call(CATEGORY_DATA, normalized);
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
  CATEGORY_DATA,
  CATEGORY_SYNONYMS,
  INCOME_CATEGORIES,
  normalizeCategory,
  getCategoryInfo,
  detectSubcategory,
  getCategoryList,
  getExpenseCategoryList,
  getIncomeCategoryList,
  getSubcategoryList,
  isKnownCategory,
  isIncomeCategory,
  isExpenseCategory
};
