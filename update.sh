#!/bin/bash
# Regenerates google_merchant_ua.xml from the live site in one go:
#   sitemap -> every Ukrainian product page -> products.json -> feed.
#
#   ./update.sh [--out /path/google_merchant_ua.xml] [--max-drop 0.2]
#
# Any failure leaves the previous feed in place and exits non-zero
# (build.cjs: 2 = validation errors, 3 = SKU count fell by more than --max-drop),
# so a cron job with MAILTO (or any monitor watching the exit code) gets the alert.
set -euo pipefail
cd "$(dirname "$0")"

curl -sSfL --max-time 60 -o sitemap.xml.new https://ecosmeticprof.com/sitemap.xml
grep -q '<urlset' sitemap.xml.new || { echo "sitemap is not a sitemap" >&2; exit 1; }
mv sitemap.xml.new sitemap.xml

# OpenCart writes &amp; into <loc>; the query-string product URLs need a literal &.
grep -oE '<loc>[^<]+</loc>' sitemap.xml | sed 's/<[^>]*>//g; s/&amp;/\&/g' | grep -v '/en/' > uk-urls.txt

rm -rf pages.new && mkdir pages.new
while read -r url; do
  name=$(printf '%s' "$url" | md5sum | cut -d' ' -f1)
  curl -sSL --max-time 40 -o "pages.new/$name.html" "$url" || echo "fetch failed: $url" >&2
  sleep 0.5
done < uk-urls.txt

rm -rf pages.prev && { [ -d pages ] && mv pages pages.prev || true; }
mv pages.new pages
node extract.cjs
node build.cjs "$@"
