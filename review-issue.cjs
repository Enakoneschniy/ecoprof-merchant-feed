// Prints a Markdown body for the "needs review" issue, or nothing when there is nothing to review.
const fs = require('fs')
const report = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const sections = []
if (report.unmapped?.length)
  sections.push(
    '### Нові товари без ручної розмітки\n\nУ фіді вони вже є, але тип, назва й категорія Google підібрані автоматично. ' +
      'Додайте запис у `catalog-map.cjs`.\n\n' + report.unmapped.map((x) => `- ${x}`).join('\n'),
  )
if (report.newImages?.length)
  sections.push(
    '### Нові фото, які ще ніхто не переглядав\n\nДодаткові фото не потрапляють у фід, доки їх не перевірено. Перевірене ' +
      'фото додайте в `image-approved.json`. Фото «до/після», скриншоти відгуків і інфографіку додайте в `image-reject.json`.\n\n' +
      report.newImages.map((x) => `- ${x}`).join('\n'),
  )
if (sections.length) {
  process.stdout.write(
    `Збірка фіду ${new Date().toISOString().slice(0, 10)}: ${report.count} товарів.\n\n` + sections.join('\n\n') + '\n',
  )
}
