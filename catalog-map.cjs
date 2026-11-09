// Curated per-SKU data the site does not carry in a usable form: the title parts
// (product type + product name), the product_type path and the Google category.
// Keyed by the OpenCart product_id (= g:id).
//
// title = `${type} ${name}, ${volume}, ${brand}` (volume omitted when unknown).

const PT = {
  creams: 'Обличчя > Креми',
  serums: 'Обличчя > Сироватки',
  masks: 'Обличчя > Маски',
  spf: 'Обличчя > SPF',
  cleansing: 'Обличчя > Очищення',
  toners: 'Обличчя > Тонери та лосьйони',
  eyes: 'Обличчя > Засоби для зони навколо очей',
  lashes: 'Обличчя > Засоби для вій та брів',
  shampoos: 'Волосся > Шампуні',
  hairLotions: 'Волосся > Лосьйони',
  hairPeels: 'Волосся > Пілінги',
  hairBalms: 'Волосся > Бальзами та маски',
  hairSprays: 'Волосся > Спреї',
  body: 'Тіло та гігієна',
  makeup: 'Декоративна косметика',
  sets: 'Набори',
  accessories: 'Аксесуари',
}

// Google product taxonomy IDs (from the client's sheet).
const G = {
  skinCare: 567, // Средства для ухода за кожей (serums: no narrower category exists)
  moisturizer: 2592, // Лосьоны (Lotion & Moisturizer): face/body/eye creams, fluids
  masks: 6262, // Маски и пилинги для ухода за лицом
  sunscreen: 2844, // Солнцезащитные средства
  cleansers: 2526, // Очищающие средства для лица
  makeupRemover: 6034, // Средства для снятия макияжа
  tonics: 543658, // Тонеры > Тоники
  cosmeticSets: 6069, // Косметические наборы
  antiAgeSets: 7429, // Наборы для антивозрастного ухода за кожей
  bodyWash: 2747, // Составы для мытья тела
  deodorant: 543598, // Дезодоранты
  intimateWash: 5821, // Спринцовки и гели для женской гигиены
  shampoo: 543615, // Шампуни
  conditioner: 543616, // Кондиционеры
  hairCare: 486, // Средства для ухода за волосами
  hairLoss: 4766, // Средства против выпадения волос
  foundation: 2765, // Крема-основы и тональные крема
  lipGloss: 2858, // Блески для губ
  lashGrowth: 6340, // Средства для роста ресниц и бровей
  giftBox: 5091, // Коробки для подарков
  waterBottle: 3809, // Бутылки для воды
  shoppingBag: 5608, // Сумки для покупок
  cosmeticBag: 6553, // Дорожные косметички
  bandana: 168, // Банданы и косынки
}

const m = (type, name, ptype, gpc, extra = {}) => ({ type, name, ptype, gpc, ...extra })

module.exports.MAP = {
  // ---- Лінійка Eco.prof.cosmetics
  8337: m('Крем для нормальної, сухої та чутливої шкіри обличчя', 'Angels Cream', PT.creams, G.moisturizer),
  8338: m('Кислотна сироватка для обличчя', 'Brightening Acid Serum', PT.serums, G.skinCare),
  8339: m('Освітлюючий крем для обличчя', 'Brightening Active Cream', PT.creams, G.moisturizer),
  8340: m('Освітлюючий комплекс для обличчя', 'Brightening (сироватка та крем)', PT.sets, G.cosmeticSets),
  8341: m('Крем для комбінованої, жирної та проблемної шкіри обличчя', 'Core Focus Cream', PT.creams, G.moisturizer),
  8343: m('Маска для проблемної шкіри обличчя', 'Core Focus Mask', PT.masks, G.masks),
  8344: m('Карбокситерапія для обличчя', 'Blue Carboxy Therapy', PT.masks, G.masks),
  8426: m('Карбокситерапія для обличчя', 'Blue Carboxy Therapy', PT.masks, G.masks),
  8345: m('Кислотна сироватка для обличчя', 'Core Focus Azsal Serum', PT.serums, G.skinCare),
  8346: m('Гель для вмивання жирної, проблемної та комбінованої шкіри', 'Core Focus Cleanser', PT.cleansing, G.cleansers),
  8389: m('Гель для вмивання жирної, проблемної та комбінованої шкіри', 'Core Focus Cleanser', PT.cleansing, G.cleansers),
  8347: m('Сироватка для обличчя з пептидами та вітаміном С', "Super Angels' Serum", PT.serums, G.skinCare),
  8348: m('Ензимна пудра для вмивання', 'Enzyme Powder Wash', PT.cleansing, G.cleansers, { volume: { amount: 80, unit: 'g' } }),
  8476: m('Ензимна пудра для вмивання', 'Enzyme Powder Wash', PT.cleansing, G.cleansers, { volume: { amount: 30, unit: 'g' } }),
  8349: m('Тонер для відновлення бар’єрних функцій шкіри', 'Normalizing Toner', PT.toners, G.tonics),
  8401: m('Тонер для відновлення бар’єрних функцій шкіри', 'Normalizing Toner', PT.toners, G.tonics),
  8350: m('Гель для душу', 'Natural Shower Gel Fruity Dream', PT.body, G.bodyWash),
  8352: m('Подарункова коробка', 'святкова', PT.accessories, G.giftBox, { noUnitPricing: true }),
  8354: m('Сонцезахисний крем-гель для обличчя', 'Silk SPF 50+', PT.spf, G.sunscreen),
  8463: m('Сонцезахисний крем для обличчя', 'Silk SPF 50', PT.spf, G.sunscreen),
  8355: m('Пінка для вмивання для всіх типів шкіри', 'Angels Foam', PT.cleansing, G.cleansers),
  8356: m('Гель для вмивання', 'Anti-Pollution Cleanser', PT.cleansing, G.cleansers),
  8359: m('Маска для обличчя', 'Immuno Mask', PT.masks, G.masks),
  8360: m('Бальзам для демакіяжу', 'Gentle Make-Up', PT.cleansing, G.makeupRemover),
  8388: m('Сироватка для обличчя з ретинолом', 'Green Retinol Serum', PT.serums, G.skinCare),
  8402: m('Сироватка для обличчя з бакучіолом', 'Bakuchiol Core Focus Serum', PT.serums, G.skinCare),
  8403: m('Крем для обличчя', 'Lifting Effect', PT.creams, G.moisturizer),
  8404: m('Сироватка для обличчя', 'Pink Cocktail Collagen Lifting Serum', PT.serums, G.skinCare),
  8405: m('Маска для обличчя з вітаміном С', 'Pink Cocktail Vit C Regenerating Mask', PT.masks, G.masks),
  8406: m('Ензимна пудра для вмивання', 'Charcoal Enzyme Powder Wash', PT.cleansing, G.cleansers),
  8407: m('Сироватка для обличчя', 'Green Barrier Serum', PT.serums, G.skinCare),
  8408: m('Тонер для обличчя з пре- та пробіотиками', 'Green Barrier Toner', PT.toners, G.tonics),
  8410: m('Крем-емульсія для тіла', 'EmollientIC', PT.body, G.moisturizer),
  8412: m('Крем для шкіри навколо очей', 'Fresh Glance', PT.eyes, G.moisturizer),
  8415: m('Олія для душу', 'EmollientIC', PT.body, G.bodyWash),
  8436: m('Набір для обличчя', '«Бокс для жирної та проблемної шкіри»', PT.sets, G.cosmeticSets),
  8437: m('Набір для обличчя', '«Бокс для нормальної та сухої шкіри»', PT.sets, G.cosmeticSets),
  8438: m('Набір для обличчя', '«Бокс антиейдж»', PT.sets, G.antiAgeSets),
  8439: m('Набір для обличчя', '«Бокс чисті пори»', PT.sets, G.cosmeticSets),
  8464: m('Набір для обличчя', '«Бокс антиейдж для вікової шкіри та профілактики вікових змін»', PT.sets, G.antiAgeSets, { line: 'eco' }),
  // «+ ПОДАРУНОК» is promotional text and is kept out of the title on purpose.
  8474: m('Набір для обличчя', '«Бокс для шкіри з пігментацією»', PT.sets, G.cosmeticSets),
  8440: m('Маска для обличчя', 'Spicule Touch Mask Pink Cocktail', PT.masks, G.masks),
  8444: m('Дезодорант', 'Lotus Deodorant', PT.body, G.deodorant),
  8445: m('Скляна пляшка для води з логотипом бренду', '', PT.accessories, G.waterBottle, { noUnitPricing: true }),
  8446: m('Еко-сумка з логотипом бренду', '', PT.accessories, G.shoppingBag, { noUnitPricing: true }),
  8447: m('Рідкі патчі для шкіри навколо очей', '', PT.eyes, G.skinCare),
  8457: m('Антиоксидантна сироватка для обличчя з арбутином', 'ArbuGlow Serum', PT.serums, G.skinCare),
  8465: m('Крем для обличчя з вітаміном С', 'Radiance Vit C', PT.creams, G.moisturizer),
  8468: m('Гель-пінка для вмивання для всіх типів шкіри', 'Skin Pro Line Pure Gentle Cleanser', PT.cleansing, G.cleansers),
  8469: m('Блиск для губ', 'Light Lips', PT.makeup, G.lipGloss),
  8470: m('Органайзер для косметики', '', PT.accessories, G.cosmeticBag, { noUnitPricing: true }),
  8471: m('Подарунковий набір з кремом для обличчя', 'Radiance Vit C', PT.sets, G.cosmeticSets),
  8472: m('Хустинка з логотипом бренду', '', PT.accessories, G.bandana, { noUnitPricing: true }),
  8475: m('Міцелярний гель для тіла', 'Core Focus Micellar Body Gel', PT.body, G.bodyWash),

  // ---- Лінійка AV&eco.prof.cosmetics (Dr. Alina Vashchenko & Eco.prof.cosmetics)
  8369: m('Гель для вмивання для жирної та проблемної шкіри', 'Acne Effective Washing', PT.cleansing, G.cleansers),
  8396: m('Гель для вмивання для жирної та проблемної шкіри', 'Acne Effective Washing', PT.cleansing, G.cleansers),
  8371: m('Гель для вмивання', 'Soft Natural Cleanser', PT.cleansing, G.cleansers),
  8372: m('Крем для обличчя з пробіотиками', 'Balance Moisturizer', PT.creams, G.moisturizer),
  8373: m('Крем для обличчя', 'AVR Cream', PT.creams, G.moisturizer),
  8374: m('Сироватка для обличчя', 'AVR Serum Redness', PT.serums, G.skinCare),
  8375: m('Молочко для вмивання', 'AVR Mousse Cleansing', PT.cleansing, G.cleansers),
  8376: m('Сонцезахисний спрей SPF 50+ PA++++', 'Mist Sunscreen', PT.spf, G.sunscreen),
  8377: m('Флюїд для обличчя', 'Reti Ceramide Fluide', PT.creams, G.moisturizer),
  8378: m('Крем для обличчя з сечовиною', 'AV Urea 5%', PT.creams, G.moisturizer),
  8379: m('Крем для шкіри навколо очей', 'Dream Eyes', PT.eyes, G.moisturizer),
  8380: m('Міцелярна вода', 'AV', PT.cleansing, G.makeupRemover),
  8381: m('Освітлююча маска для обличчя', 'Sebo 1', PT.masks, G.masks),
  8382: m('Себорегулююча маска для обличчя', 'Sebo 2', PT.masks, G.masks),
  8383: m('Маска для обличчя', 'Hydro Mask', PT.masks, G.masks),
  8385: m('Тонер для обличчя з вітаміном С', 'Vit C', PT.toners, G.tonics),
  8386: m('Кислотна сироватка для обличчя', 'AV Acid Serum', PT.serums, G.skinCare),
  8390: m('Гель для вмивання', 'Cleansing Cream Magnolia+', PT.cleansing, G.cleansers),
  8391: m('Крем для обличчя', 'Magnolia+', PT.creams, G.moisturizer),
  8392: m('Матуючий флюїд для обличчя', 'Mat Fluide', PT.creams, G.moisturizer),
  8393: m('Маска для обличчя', 'Magnolia+', PT.masks, G.masks),
  8394: m('Сироватка для обличчя', 'Magnolia+', PT.serums, G.skinCare),
  8395: m('Лосьйон для обличчя з кислотами', 'Oxygen Lotion with Acid', PT.toners, G.tonics),
  8398: m('М’яка пінка для інтимної гігієни', '', PT.body, G.intimateWash),
  8399: m('Суха сироватка з активатором для обличчя (набір)', 'Dry Serum', PT.masks, G.masks),
  8400: m('Заспокійливий крем для обличчя', 'Redness Recovery Cream', PT.creams, G.moisturizer),
  8413: m('Маска для обличчя', 'Redness Recovery Mask', PT.masks, G.masks),
  8416: m('Дитячий шампунь і гель для душу 2-в-1', 'Tiny Star', PT.body, G.shampoo),
  8417: m('Дитячий крем', 'Tiny Star', PT.body, G.moisturizer),
  8418: m('Шампунь', '1.3 Medicated Shampoo', PT.shampoos, G.shampoo),
  8420: m('Пілінг для шкіри голови з жирною себореєю та лупою', '03', PT.hairPeels, G.hairCare),
  8421: m('Профілактичний пілінг для всіх типів шкіри голови', '01', PT.hairPeels, G.hairCare),
  8422: m('Лосьйон для шкіри голови з пребіотичними властивостями', '3.1', PT.hairLotions, G.hairCare),
  8423: m('Лосьйон для росту волосся', '3.2', PT.hairLotions, G.hairLoss),
  8424: m('Гель для душу з сечовиною 10%', '', PT.body, G.bodyWash),
  8425: m('Крем для тіла з сечовиною 10%', '', PT.body, G.moisturizer),
  8429: m('Шампунь', '1.2 Detox', PT.shampoos, G.shampoo),
  8430: m('Шампунь', '1.1 Hydro', PT.shampoos, G.shampoo),
  8431: m('Бальзам-маска для волосся', 'Hydro', PT.hairBalms, G.conditioner),
  8433: m('Бальзам-маска для фарбованого волосся', 'Color Protect', PT.hairBalms, G.conditioner),
  8432: m('Спрей для волосся', '4.1 Revital 3 in 1', PT.hairSprays, G.conditioner),
  8448: m('Очищувальний спрей для проблемної шкіри тіла', 'Clairfall Cleanser Mist', PT.body, G.skinCare),
  8473: m('Очищувальний спрей для проблемної шкіри тіла', 'Clairfall Cleanser Mist', PT.body, G.skinCare),
  // Shades from the product's «Колір» variant group on the site (8452 page lists both).
  8451: m('Тонувальний СС-крем', 'Skinesis CC Cream', PT.makeup, G.foundation, { shade: 'Nude Rose' }),
  8452: m('Тонувальний СС-крем', 'Skinesis CC Cream', PT.makeup, G.foundation, { shade: 'Beige' }),
  8462: m('Сироватка для вій та брів з пептидом', 'AVolum Boost Serum', PT.lashes, G.lashGrowth),
  8466: m('Сироватка для обличчя з азелаїновою кислотою', 'Azeglow', PT.serums, G.skinCare),
  8459: m('Набір для дитячої шкіри: шампунь і гель для душу 2-в-1 та крем', '', PT.sets, G.cosmeticSets, { line: 'av' }),
}

// Volumes for products whose live page does not show one (out-of-stock pages hide the
// option block). Source: the catalogue import of 2026-10-03, which read the same site.
module.exports.IMPORTED_VOLUMES = {
  8355: { amount: 150, unit: 'ml' },
  8375: { amount: 100, unit: 'ml' },
  8380: { amount: 250, unit: 'ml' },
  8390: { amount: 100, unit: 'ml' },
  8396: { amount: 200, unit: 'ml' },
  8420: { amount: 100, unit: 'ml' },
  8444: { amount: 50, unit: 'ml' },
  8463: { amount: 10, unit: 'ml' },
  8466: { amount: 30, unit: 'ml' },
}

// Not physical goods / not sellable through Shopping, or missing a description.
module.exports.EXCLUDE = {
  8454: 'подарунковий сертифікат (не фізичний товар)',
  8455: 'подарунковий сертифікат (не фізичний товар)',
  8456: 'подарунковий сертифікат (не фізичний товар)',
  8460: 'немає опису на картці товару (Google вимагає description)',
  8461: 'немає опису на картці товару (Google вимагає description)',
}
