# TheHotBox — website

Static one-page site (EN / FR / DE) for TheHotBox: sauna rental and sales from Verbier, delivered across Switzerland.

- `index.html` — everything (markup, styles, script, translations). No build step.
- `img/` — photos. Currently crops of Instagram screenshots; replace with the original full-resolution files (keep the filenames).

## Things to fill in

- `CONTACT` at the top of the `<script>` in `index.html`: add `email` and/or `whatsapp` to switch on those send buttons on the enquiry form. Instagram DM works out of the box.
- Prices are deliberately not shown ("quote on request").

## Hosting

`.github/workflows/hotbox-pages.yml` publishes this folder to GitHub Pages on every push that touches it
(repo Settings → Pages → Source: **GitHub Actions** must be enabled once).

Preview locally: `python3 -m http.server -d hotbox 8000`.
