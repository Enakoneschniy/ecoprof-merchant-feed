// Builds google_merchant_ua.xml from products.json (extract.cjs) + catalog-map.cjs.
//
//   node build.cjs [--out google_merchant_ua.xml] [--max-drop 0.2] [--skip-image-check]
//
// Safety (ТЗ §5): the new file is written to <out>.tmp and only renamed over <out> when
// every item validates AND the SKU count did not fall by more than --max-drop against the
// previous file. Otherwise the previous file stays in place and the process exits non-zero
// (exit 2 = validation errors, exit 3 = SKU count drop) so cron/monitoring can alert.
const fs = require('fs')
const path = require('path')
const { JSDOM } = require('jsdom')
const { decodeHTML } = require('entities')
const { MAP, IMPORTED_VOLUMES, EXCLUDE } = require('./catalog-map.cjs')

const args = process.argv.slice(2)
const arg = (name, def) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : def
}
const OUT = path.resolve(arg('--out', path.join(__dirname, 'google_merchant_ua.xml')))
// items/report JSON go here (default: next to the feed). The CI keeps them out of the published site.
const REPORT_DIR = path.resolve(arg('--report-dir', path.dirname(OUT)))
const MAX_DROP = Number(arg('--max-drop', '0.2'))
const SKIP_IMAGE_CHECK = args.includes('--skip-image-check')

const SITE = 'https://ecosmeticprof.com'
const BRANDS = {
  eco: { brand: 'Eco.prof.cosmetics', label0: 'Основна лінійка' },
  av: { brand: 'AV&eco.prof.cosmetics', label0: 'Товари партнерів' },
}

const products = JSON.parse(fs.readFileSync(path.resolve(arg('--input', path.join(__dirname, 'products.json'))), 'utf8'))
// Visual review of every photo (2026-11-09): before/after shots, screenshots of customer
// messages and text infographics are kept out of the feed (Google rejects text overlays and
// unverifiable result claims). Photos added to the site later are included but reported.
const IMAGE_REJECT = require('./image-reject.json')
const IMAGE_APPROVED = new Set(require('./image-approved.json'))
const sitemap = fs.readFileSync(path.join(__dirname, 'sitemap.xml'), 'utf8')

// ---------------------------------------------------------------- helpers
const report = {
  excluded: [],
  warnings: [],
  errors: [],
  noVolume: [],
  importedVolume: [],
  claimsRemoved: [],
  // Need a human: products without a curated catalog-map entry, photos nobody has looked at.
  unmapped: [],
  newImages: [],
}

const sitemapImage = new Map()
for (const block of sitemap.split('<url>').slice(1)) {
  const loc = block.match(/<loc>([^<]+)<\/loc>/)?.[1]?.replace(/&amp;/g, '&')
  const img = block.match(/<image:loc>([^<]+)<\/image:loc>/)?.[1]?.replace(/&amp;/g, '&')
  if (loc && img) sitemapImage.set(loc, img)
}

/** Percent-encode anything that is not already encoded (spaces in OpenCart paths). */
function cleanUrl(u) {
  let decoded = u
  try {
    decoded = decodeURI(u)
  } catch {}
  return encodeURI(decoded)
}

/** Identity of a photo independent of the cached size: catalog/x/IMG_1-960x960.JPG -> catalog/x/IMG_1.JPG */
function imageKey(u) {
  const m = decodeURI(u).match(/\/image\/cache\/(.+)-\d+x\d+(\.[A-Za-z]+)$/)
  return m ? m[1] + m[2] : decodeURI(u).replace(/^.*\/image\//, '')
}

function parseVolume(s) {
  if (!s) return null
  // JS \b is ASCII-only, so "50 мл" needs an explicit Unicode letter lookahead.
  const m = String(s).replace(',', '.').match(/(\d+(?:\.\d+)?)\s*(мл|ml|гр|г|g)?(?!\p{L})/iu)
  if (!m) return null
  const unitRaw = (m[2] || '').toLowerCase()
  const unit = unitRaw === 'мл' || unitRaw === 'ml' ? 'ml' : unitRaw ? 'g' : null
  return { amount: Number(m[1]), unit }
}

const VOL_RE = /б.?єм/i
// An out-of-stock variant's own page hides its "Об'єм" group, but its in-stock siblings
// list it ("200мл" -> the variant's URL), so collect every labelled variant link.
const siblingVolume = new Map()
for (const p of products)
  for (const g of p.groups.filter((g) => VOL_RE.test(g.name)))
    for (const v of g.all) if (v.href) siblingVolume.set(v.href.replace(/&amp;/g, '&'), v.label)

function volumeOf(p, map) {
  if (map.volume) return { ...map.volume, source: 'map' }
  const group = p.groups.find((g) => VOL_RE.test(g.name))?.current
  const option = p.options.find((o) => VOL_RE.test(o.name))?.values?.[0]?.label
  const attr = p.attributes.find((a) => VOL_RE.test(a.name))?.value
  const g = parseVolume(group)
  const o = parseVolume(option)
  const a = parseVolume(attr)
  // The variant label ("Об'єм" group) names the SKU; a unitless "200" borrows the option's unit.
  let v = g || a || o
  if (v && !v.unit) v.unit = (o && o.unit) || (a && a.unit) || null
  if (v && v.unit) {
    if (o && o.unit && (o.amount !== v.amount || o.unit !== v.unit))
      report.warnings.push(`${p.id}: об'єм у варіанті «${group}» ≠ опції «${option}» — взято «${group}»`)
    return { ...v, source: 'page' }
  }
  const sib = parseVolume(siblingVolume.get(p.canonical.replace(/&amp;/g, '&')))
  if (sib && sib.unit) return { ...sib, source: 'sibling-variant' }
  if (IMPORTED_VOLUMES[p.id]) {
    report.importedVolume.push(p.id)
    return { ...IMPORTED_VOLUMES[p.id], source: 'import-2026-10-03' }
  }
  return null
}

const fmtNum = (n) => (Number.isInteger(n) ? String(n) : String(n).replace('.', ','))
const volUa = (v) => `${fmtNum(v.amount)} ${v.unit === 'ml' ? 'мл' : 'г'}`
const volGoogle = (v) => `${v.amount} ${v.unit}`
const money = (n) => `${n.toFixed(2)} UAH`

function priceBucket(n) {
  if (n < 800) return 'price_0_799'
  if (n < 1000) return 'price_800_999'
  if (n < 1200) return 'price_1000_1199'
  if (n < 2000) return 'price_1200_1999'
  return 'price_2000_plus'
}

// ---------------------------------------------------------------- description
const BLOCK = new Set(['P', 'DIV', 'LI', 'UL', 'OL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TR', 'TABLE', 'BLOCKQUOTE'])
const IS_BULLET = /^[-–—•·*▪●✅✔✓☑]/
const BULLET = /^\s*(?:[-–—•·*▪●✅✔✓☑]\ufe0f?|\d+[.)])\s*/

function htmlToLines(html) {
  const dom = new JSDOM(`<body>${html}</body>`)
  const out = []
  let cur = ''
  const flush = () => {
    if (cur.trim()) out.push(cur)
    cur = ''
  }
  const walk = (node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) cur += child.nodeValue
      else if (child.nodeType === 1) {
        if (child.tagName === 'BR') flush()
        else if (BLOCK.has(child.tagName)) {
          flush()
          walk(child)
          flush()
        } else walk(child)
      }
    }
  }
  walk(dom.window.document.body)
  flush()
  return out
}

/** Decode entities until stable: catches double-encoded "&amp;nbsp;". */
function decodeAll(s) {
  let prev
  do {
    prev = s
    s = decodeHTML(s)
  } while (s !== prev)
  return s
}

const PROTECT = [/eco\.prof\.cosmetics/gi, /eco\.prof/gi, /Synovea®/g, /\bвіт\.\s?C\b/gi]
function normalizeLine(s) {
  s = decodeAll(s)
    .replace(/[   \t]/g, ' ')
    .replace(/[​-‍﻿]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  // Keep dotted brand names intact while fixing punctuation spacing.
  const saved = []
  for (const re of PROTECT) s = s.replace(re, (m) => `\u0000${saved.push(m) - 1}\u0000`)
  s = s
    .replace(/\s+([,.;:!?%])/g, (m, c) => (c === '%' ? '%' : c)) // no space before punctuation
    .replace(/([,;:!?])(?=[A-Za-zА-ЯЄІЇҐа-яєіїґ«"(])/g, '$1 ') // space after , ; : ! ?
    .replace(/([a-zа-яєіїґ)»"])\.(?=[A-ZА-ЯЄІЇҐ«"(])/g, '$1. ') // "шкіри.Спікули" -> "шкіри. Спікули"
    .replace(/ [-–] /g, ' — ') // spaced hyphen used as a dash
    .replace(/\s+/g, ' ')
    .trim()
  s = s.replace(/\u0000(\d+)\u0000/g, (m, i) => saved[Number(i)])
  return s
}

const endsSentence = (s) => /[.!?…:;]$/.test(s)
const lowerFirst = (s) => (/^[А-ЯЄІЇҐ][а-яєіїґ’']/.test(s) ? s[0].toLowerCase() + s.slice(1) : s)

function cleanDescription(html) {
  const lines = htmlToLines(html).map(normalizeLine).filter(Boolean)
  const parts = []
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]
    // A heading line ending with ":" followed by dash/bullet items becomes one enumeration:
    // "Уникати станів: надто чутлива шкіра; пошкодження шкіри; ... ."
    if (/:$/.test(line) && i + 1 < lines.length && IS_BULLET.test(lines[i + 1])) {
      const items = []
      while (i + 1 < lines.length) {
        const next = lines[i + 1]
        if (IS_BULLET.test(next)) items.push(next.replace(BULLET, ''))
        // A bullet broken across two blocks: "... інгредієнти для" + "підтримки бар'єру,".
        else if (items.length && /^[a-zа-яєіїґ]/.test(next)) items[items.length - 1] += ' ' + next
        else break
        i++
      }
      const cleaned = items
        .flatMap((x) => x.split(/\s*[•▪●✅✔✓☑]\ufe0f?\s*/)) // several bullets inside one block
        .map((x) => lowerFirst(x.replace(/[.;,]+$/, '').trim()))
        .filter(Boolean)
      parts.push(`${line} ${cleaned.join('; ')}.`)
      continue
    }
    line = line.replace(/^[-–—•·*▪●✅✔✓☑]\ufe0f?\s*/, '')
    // Inline bullets ("Переваги: • Може ... • Легко ...", "✅ ...") -> sentences.
    line = line.replace(/\s*[•▪●✅✔✓☑]\ufe0f?\s*/g, (m, off) => (off === 0 ? '' : ' ')).trim()
    line = line.replace(/[,;]+$/, '')
    if (!line) continue
    line = line.replace(/^[a-zа-яєіїґ]/, (c) => c.toUpperCase()) // every block starts a sentence
    if (!endsSentence(line)) line += '.'
    parts.push(line)
  }
  let text = parts.join(' ').replace(/\s+/g, ' ').replace(/\.\./g, '.').trim()
  if (text.length > 5000) {
    const cut = text.slice(0, 5000)
    text = cut.slice(0, Math.max(cut.lastIndexOf('. '), 4000) + 1)
  }
  return text
}

// ---------------------------------------------------------------- product_detail
const ATTR_NAME_FIX = { "Об'єм": "Об'єм", 'Об`єм': "Об'єм" }
function normalizeAttr(id, name, value) {
  name = name.replace(/\s*:\s*$/, '').trim()
  name = ATTR_NAME_FIX[name] || name
  let v = normalizeLine(value).replace(/[.\s]+$/, '').replace(/\s*,\s*/g, ', ')
  if (!v) return null
  if (name === 'Стать' && /^(унісекс|унісек|unisex)$/i.test(v)) v = 'унісекс'
  if (name === 'Зроблено в' && /^україн/i.test(v)) v = 'Україна'
  if (name === 'Класифікація' && /^дерматокосметик/i.test(v)) v = 'дерматокосметика'
  if (name === 'Класифікація' && /^космецевтика$/i.test(v)) v = 'космецевтика'
  if (['Час застосування', 'Тип шкіри', 'Призначення'].includes(name)) v = lowerFirst(v)
  v = v.replace(/^spf\b/i, 'SPF')
  // ТЗ §5: unconfirmed statements are not passed. Treatment claims ("для лікування вугрової
  // хвороби", "лікування шкіри голови") are dropped from the comma list; the rest stays.
  const parts = v.split(/,\s*/)
  const kept = parts.filter((x) => !/лікув/i.test(x))
  if (kept.length !== parts.length) {
    report.claimsRemoved.push(`${id} ${name}: «${parts.filter((x) => /лікув/i.test(x)).join(', ')}»`)
    if (!kept.length) return null
    v = kept.join(', ')
  }
  return { name, value: v }
}

// ---------------------------------------------------------------- images
async function urlOk(u) {
  for (const method of ['HEAD', 'GET']) {
    try {
      const r = await fetch(u, { method, redirect: 'manual', signal: AbortSignal.timeout(20000) })
      const type = r.headers.get('content-type') || ''
      if (method === 'GET') await r.body?.cancel()
      if (r.status === 200 && type.startsWith('image/')) return true
      if (r.status === 200 && method === 'HEAD') continue
      return false
    } catch {
      if (method === 'GET') return false
    }
  }
  return false
}

const imageCache = new Map()
const checkImage = (u) => {
  if (SKIP_IMAGE_CHECK) return Promise.resolve(true)
  if (!imageCache.has(u)) imageCache.set(u, urlOk(u))
  return imageCache.get(u)
}

/** Prefer the 960x960 cache file (as in the ТЗ example) when it exists. */
async function best960(u) {
  const alt = u.replace(/-\d+x\d+(\.[A-Za-z]+)$/, '-960x960$1')
  if (alt !== u && (await checkImage(alt))) return alt
  return u
}

// ---------------------------------------------------------------- build items
const xmlEscape = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * A product added to the site after catalog-map.cjs was written. It still goes into the feed
 * (a missing product is worse than a rough category), with a type and category guessed from its
 * name and site categories, and is reported so someone adds a proper entry.
 */
function autoMap(p) {
  const n = `${p.name} ${p.ldCategory || ''}`.toLowerCase()
  const rules = [
    [/spf|сонцезахис/, 'Обличчя > SPF', 2844],
    [/шампун/, 'Волосся > Шампуні', 543615],
    [/бальзам-маска|кондиціонер/, 'Волосся > Бальзами та маски', 543616],
    [/лосьйон.*(волосс|голов)|волосся за призначенням/, 'Волосся > Лосьйони', 486],
    [/пілінг.*голов/, 'Волосся > Пілінги', 486],
    [/набір|бокс|набори/, 'Набори', 6069],
    [/маска|mask/, 'Обличчя > Маски', 6262],
    [/сироватк|serum/, 'Обличчя > Сироватки', 567],
    [/тонер|тонік|toner/, 'Обличчя > Тонери та лосьйони', 543658],
    [/для душу|shower|для тіла|body/, 'Тіло та гігієна', 2747],
    [/вмиван|пінка|cleanser|міцеляр|демакіяж|очищення/, 'Обличчя > Очищення', 2526],
    [/дезодорант/, 'Тіло та гігієна', 543598],
    [/крем|cream|флюїд|fluid/, 'Обличчя > Креми', 2592],
    [/декоративн|блиск|помад/, 'Декоративна косметика', 477],
  ]
  const hit = rules.find(([re]) => re.test(n))
  const [, ptype, gpc] = hit || [null, 'Інше', 473]
  const name = p.name.replace(/^\p{Ll}/u, (c) => c.toUpperCase()).replace(/\s+/g, ' ').replace(/[.\s]+$/, '')
  report.unmapped.push(`${p.id} «${p.name}» → ${ptype}, категорія ${gpc} (підібрано автоматично)`)
  return { type: name, name: '', ptype, gpc }
}

async function buildItem(p) {
  const map = MAP[p.id] || autoMap(p)
  const cat = p.ldCategory || ''
  let line = map.line || (/Лінійка Eco\.prof/i.test(cat) ? 'eco' : /Лінійка AV/i.test(cat) ? 'av' : null)
  if (!line) {
    line = 'eco'
    report.warnings.push(`${p.id}: товар не входить у жодну лінійку на сайті — бренд за замовчуванням Eco.prof.cosmetics`)
  }
  const { brand, label0 } = BRANDS[line]

  const vol = volumeOf(p, map)
  if (!vol && !map.noUnitPricing && map.ptype !== 'Набори') report.noVolume.push(`${p.id} ${p.name}`)

  const title =
    [map.type, map.name].filter(Boolean).join(' ') +
    (vol ? `, ${volUa(vol)}` : '') +
    (map.shade ? `, відтінок ${map.shade}` : '') +
    `, ${brand}`

  const description = cleanDescription(p.descriptionHtml)

  // Photos: the sitemap's 960x960 main image first, then the gallery in page order.
  const link = p.canonical.replace(/&amp;/g, '&')
  const candidates = []
  const seen = new Set()
  const add = (u) => {
    if (!u) return
    const k = imageKey(u)
    if (seen.has(k)) return
    seen.add(k)
    candidates.push(u)
  }
  add(sitemapImage.get(link))
  p.images.forEach(add)
  const images = []
  for (const raw of candidates) {
    const k = imageKey(cleanUrl(raw))
    if (IMAGE_REJECT[k]) {
      report.imagesRejected = (report.imagesRejected || 0) + 1
      continue
    }
    if (!IMAGE_APPROVED.has(k)) {
      // A gallery photo nobody has looked at may be a before/after shot or a review screenshot:
      // keep it out until reviewed. The main photo is needed for the item, so it goes in, flagged.
      const isMain = images.length === 0
      report.newImages.push(`${p.id}: ${isMain ? 'головне фото (включено)' : 'додаткове фото (не включено)'} ${cleanUrl(raw)}`)
      if (!isMain) continue
    }
    const u = await best960(cleanUrl(raw))
    if (await checkImage(u)) images.push(u)
    else report.warnings.push(`${p.id}: фото недоступне, пропущено: ${u}`)
  }

  const priceNow = p.price
  const priceWas = p.oldPrice && p.oldPrice > p.price ? p.oldPrice : null

  const details = p.attributes
    .map((a) => {
      const n = normalizeAttr(p.id, a.name, a.value)
      return n && { section: a.section || 'Опис ознак', ...n }
    })
    .filter(Boolean)

  return {
    id: p.id,
    title,
    description,
    link,
    image: images[0],
    additional: images.slice(1, 11),
    availability: p.cartButton ? 'in_stock' : 'out_of_stock',
    price: priceWas ?? priceNow,
    salePrice: priceWas ? priceNow : null,
    brand,
    condition: 'new',
    gpc: map.gpc,
    ptype: map.ptype,
    unitPricing: vol && vol.unit && !map.noUnitPricing ? volGoogle(vol) : null,
    details,
    label0,
    label3: priceBucket(priceNow),
    name: p.name,
  }
}

function validate(it) {
  const e = []
  if (!/^\d+$/.test(it.id)) e.push('id')
  if (!it.title || it.title.length > 150) e.push(`title (${it.title?.length} символів)`)
  if (!it.description || it.description.length < 50) e.push('description порожній/короткий')
  if (/<|&[a-z]+;/i.test(it.description)) e.push('description містить HTML/сутності')
  if (!/^https:\/\/ecosmeticprof\.com\//.test(it.link) || /utm_/i.test(it.link)) e.push('link')
  if (!it.image || !/^https:\/\//.test(it.image)) e.push('image_link')
  if (!(it.price > 0)) e.push('price')
  if (it.salePrice != null && !(it.salePrice < it.price)) e.push('sale_price >= price')
  if (!it.gpc) e.push('google_product_category')
  if (!it.brand) e.push('brand')
  return e
}

function itemXml(it) {
  const t = (tag, v) => `   <g:${tag}>${xmlEscape(v)}</g:${tag}>`
  const lines = [
    '  <item>',
    t('id', it.id),
    t('title', it.title),
    `   <g:description><![CDATA[${it.description.replace(/]]>/g, ']]]]><![CDATA[>')}]]></g:description>`,
    t('link', it.link),
    t('image_link', it.image),
    ...it.additional.map((u) => t('additional_image_link', u)),
    t('availability', it.availability),
    t('price', money(it.price)),
    ...(it.salePrice != null ? [t('sale_price', money(it.salePrice))] : []),
    t('brand', it.brand),
    t('identifier_exists', 'no'),
    t('condition', it.condition),
    t('google_product_category', it.gpc),
    t('product_type', it.ptype),
    ...(it.unitPricing ? [t('unit_pricing_measure', it.unitPricing)] : []),
    ...it.details.flatMap((d) => [
      '   <g:product_detail>',
      `    <g:section_name>${xmlEscape(d.section)}</g:section_name>`,
      `    <g:attribute_name>${xmlEscape(d.name)}</g:attribute_name>`,
      `    <g:attribute_value>${xmlEscape(d.value)}</g:attribute_value>`,
      '   </g:product_detail>',
    ]),
    t('custom_label_0', it.label0),
    t('custom_label_3', it.label3),
    '  </item>',
  ]
  return lines.join('\n')
}

async function main() {
  const items = []
  for (const p of products) {
    if (EXCLUDE[p.id]) {
      report.excluded.push(`${p.id} ${p.name} — ${EXCLUDE[p.id]}`)
      continue
    }
    if (!(p.price > 0)) {
      report.excluded.push(`${p.id} ${p.name} — немає ціни`)
      continue
    }
    const it = await buildItem(p)
    if (!it) continue
    if (!it.image) {
      report.excluded.push(`${p.id} ${p.name} — немає доступного фото`)
      continue
    }
    const errs = validate(it)
    if (errs.length) report.errors.push(`${it.id}: ${errs.join(', ')}`)
    items.push(it)
  }

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
    ' <channel>',
    '  <title>Ecosmeticprof.com</title>',
    `  <link>${SITE}/</link>`,
    '  <description>Google Merchant Center feed</description>',
    ...items.map(itemXml),
    ' </channel>',
    '</rss>',
    '',
  ].join('\n')

  fs.mkdirSync(REPORT_DIR, { recursive: true })
  const base = path.join(REPORT_DIR, path.basename(OUT).replace(/\.xml$/, ''))
  fs.writeFileSync(base + '.items.json', JSON.stringify(items, null, 2))
  fs.writeFileSync(base + '.report.json', JSON.stringify({ count: items.length, ...report }, null, 2))

  if (report.errors.length) {
    console.error(`FEED NOT UPDATED: ${report.errors.length} validation error(s):\n` + report.errors.join('\n'))
    process.exit(2)
  }
  if (fs.existsSync(OUT)) {
    const prev = (fs.readFileSync(OUT, 'utf8').match(/<item>/g) || []).length
    if (prev > 0 && items.length < prev * (1 - MAX_DROP)) {
      console.error(`FEED NOT UPDATED: SKU count fell from ${prev} to ${items.length} (more than ${MAX_DROP * 100}%)`)
      process.exit(3)
    }
  }
  fs.writeFileSync(OUT + '.tmp', xml)
  fs.renameSync(OUT + '.tmp', OUT)
  console.log(`OK: ${items.length} items -> ${OUT}`)
  console.log(`excluded ${report.excluded.length}, warnings ${report.warnings.length}, no volume ${report.noVolume.length}`)
}

main().catch((err) => {
  console.error('FEED NOT UPDATED:', err)
  process.exit(1)
})
