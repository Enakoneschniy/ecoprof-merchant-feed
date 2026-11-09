// Extracts product data from the downloaded legacy product pages into products.json.
const fs = require('fs')
const path = require('path')
const { JSDOM } = require('jsdom')

const dir = path.join(__dirname, 'pages')
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.html'))

const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '')
const money = (s) => {
  const digits = s.replace(/[^\d.,]/g, '').replace(/\s/g, '').replace(',', '.')
  return digits ? Number(digits) : null
}

const out = []
for (const f of files) {
  const html = fs.readFileSync(path.join(dir, f), 'utf8')
  if (!html.includes('class="body-product"')) continue
  const doc = new JSDOM(html).window.document

  const ld = [...doc.querySelectorAll('script[type="application/ld+json"]')]
    .map((s) => {
      try {
        return JSON.parse(s.textContent)
      } catch {
        return null
      }
    })
    .filter(Boolean)
  const productLd = ld.find((x) => x['@type'] === 'Product') || {}
  const crumbsLd = ld.find((x) => x['@type'] === 'BreadcrumbList')

  // The product's own wishlist button (the cards of related products use other markup).
  const mainId = html.match(/sc-wishlist-btn mt-4[\s\S]{0,200}?wishlist\.add\('(\d+)'\)/)?.[1] ?? null
  const id = productLd.productID ? String(productLd.productID) : mainId
  const actions = doc.querySelector('.sc-product-actions')
  const notifyButton = actions ? /Повідомити про наявність/.test(actions.textContent) : null
  const cartButton = actions ? Boolean(actions.querySelector('#button-cart')) : null
  const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href')
  const name = text(doc.querySelector('h1'))

  const priceBox = doc.querySelector('.sc-product-actions-top-left .sc-module-price-box')
  const price = money(text(priceBox?.querySelector('.sc-module-price')))
  const oldPrice = money(text(priceBox?.querySelector('.sc-module-price-old')))

  // Every gallery photo appears in several cached sizes (800, 150, 960). Group by the
  // source file and keep one URL each, in page order, preferring the 960x960 cache.
  const bySource = new Map()
  const consider = (u) => {
    if (!u || !u.includes('/image/')) return
    const m = u.match(/^(.*\/image\/)cache\/(.+)-(\d+)x(\d+)(\.[A-Za-z]+)$/)
    const key = m ? m[2] + m[5] : u.replace(/^.*\/image\//, '')
    const size = m ? Number(m[3]) : 99999
    const prev = bySource.get(key)
    const rank = (s) => (s === 960 ? 0 : s === 99999 ? 2 : 1)
    if (!prev) bySource.set(key, { url: u, size })
    else if (rank(size) < rank(prev.size)) bySource.set(key, { url: u, size })
  }
  doc.querySelectorAll('#productImages img').forEach((img) => consider(img.getAttribute('src')))
  doc.querySelectorAll('#productImages a').forEach((a) => consider(a.getAttribute('href')))
  doc.querySelectorAll('#productImages [data-src], #productImages [data-zoom]').forEach((e) => {
    consider(e.getAttribute('data-src'))
    consider(e.getAttribute('data-zoom'))
  })
  const images = [...bySource.values()].map((v) => v.url)

  const descEl = doc.querySelector('.sc-product-content-text')
  if (descEl) descEl.querySelectorAll('.sc-product-tags').forEach((t) => t.remove())
  const descriptionHtml = descEl ? descEl.innerHTML : ''

  const attributes = []
  doc.querySelectorAll('.sc-product-content-attributes-list').forEach((list) => {
    const section = text(list.querySelector('.sc-product-content-attributes-list-title'))
    list.querySelectorAll('.sc-product-content-attributes-list-item').forEach((item) => {
      const cells = item.querySelectorAll(':scope > div')
      attributes.push({ section, name: text(cells[0]), value: text(cells[1]) })
    })
  })

  const groups = []
  doc.querySelectorAll('.product-group').forEach((g) => {
    groups.push({
      name: text(g.querySelector('.product-group-name')),
      current: text(g.querySelector('.product-group-product.current')),
      all: [...g.querySelectorAll('.product-group-product')].map((p) => ({
        label: text(p),
        href: p.querySelector('a')?.getAttribute('href') || null,
        current: p.classList.contains('current'),
      })),
    })
  })
  const options = []
  doc.querySelectorAll('#sc-product-options .form-group').forEach((g) => {
    options.push({
      name: text(g.querySelector('label.sc-control-label')).replace(/\*$/, '').trim(),
      values: [...g.querySelectorAll('.radio label, option')].map((l) => ({
        label: text(l),
        title: l.getAttribute('title'),
      })),
    })
  })

  const crumbs = [...doc.querySelectorAll('.breadcrumb .breadcrumb-item')].map(text).filter(Boolean)
  const stockText = text(doc.querySelector('.sc-product-stock, .product-stock, .sc-product-info-stock'))

  out.push({
    file: f,
    id,
    mainId,
    notifyButton,
    cartButton,
    canonical,
    name,
    price,
    oldPrice,
    ldPrice: productLd.offers?.price ?? null,
    availability: productLd.offers?.availability ?? null,
    model: productLd.model ?? null,
    ldBrand: productLd.brand?.name ?? null,
    ldCategory: productLd.category ?? null,
    ldImage: productLd.image ?? null,
    ogImage: doc.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? null,
    images,
    crumbs,
    crumbsLd: crumbsLd?.itemListElement?.map((x) => x.item?.name) ?? [],
    descriptionHtml,
    attributes,
    groups,
    options,
    stockText,
  })
}
out.sort((a, b) => Number(a.id) - Number(b.id))
fs.writeFileSync(path.join(__dirname, 'products.json'), JSON.stringify(out, null, 2))
console.log('products', out.length)
