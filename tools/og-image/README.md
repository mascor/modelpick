# Link preview image

`src/server/public/og.png` is the 1200×630 image shown when the site is shared
on Slack, WhatsApp, X or Reddit. It is a still picture, not the daily data, so
it does not need regenerating with every update.

To regenerate it after changing `index.html`:

```bash
cp src/server/public/favicon-192.png tools/og-image/
docker run --rm -v "$PWD/tools/og-image:/w" zenika/alpine-chrome \
  --no-sandbox --hide-scrollbars --window-size=1200,630 \
  --virtual-time-budget=6000 --screenshot=/w/og.png file:///w/index.html
mv tools/og-image/og.png src/server/public/og.png
```
