# Planet Botanica — Shopify theme

A bespoke Online Store 2.0 theme for a South African carnivorous-plant nursery. Hand-written Liquid, one CSS file and one vanilla-JS file: no build step, no framework, no theme-vendor lock-in.

## What's special about it

| Feature | Where |
| --- | --- |
| **Care card** — a herbarium-label care sheet built from `custom.*` metafields (light, water, substrate, humidity, temperature, climate, dormancy, trap, origin, altitude, clone ID, CITES, full care guide) | `snippets/care-card.liquid` |
| **Difficulty meter + trap type** on every product card (difficulty 1–5 → Easy / Intermediate / Expert) | `snippets/care-badges.liquid` |
| **Plant-finder quiz** — 2–5 editor-configurable questions that map to storefront filters (climate, difficulty range, trap), so it needs no app and works without JS | `sections/plant-finder.liquid` |
| **Live-plant dispatch countdown** — "Order within 2h 14m for dispatch today", computed in SAST from the dispatch days and cut-off in theme settings | `snippets/dispatch-notice.liquid`, `DispatchNotice` in `assets/theme.js` |
| **Dispatch pause** switch for heatwaves, long weekends and the December courier shutdown | Theme settings → Live plant shipping |
| **Dormancy-season notice** (Southern-hemisphere months) on plants with `custom.dormancy_required` | `sections/main-product.liquid` |
| **Shipping-week section** — visual Mon–Sun dispatch calendar that stays in sync with theme settings | `sections/shipping-calendar.liquid` |
| **Free-shipping progress bar**, AJAX cart drawer, order notes | `sections/cart-drawer.liquid` |
| **Filtering & sorting** by difficulty, trap type, light, growing spot and price (AJAX, back-button safe) | `snippets/facets.liquid`, `FacetFilters` |
| **Predictive search** that shows genus and origin | `sections/predictive-search.liquid` |
| **Mega menu** (genus + collections columns, promo card), dropdowns, compact sticky header, mobile drawer with search | `sections/header.liquid` |
| **Two blogs** — Care guides and News — with reading time, share row, "Plants in this post" and "Keep reading" | `sections/main-article.liquid` |
| **WhatsApp** floating chat button + WhatsApp share on products | Theme settings → Social & WhatsApp |
| **ECT Act business details** (registration no., VAT no., address) in the footer | Theme settings → Business details |
| Care-guide blog with **"Plants in this guide"** product rows | `sections/main-article.liquid` |
| Product, Article and FAQ **structured data** (JSON-LD) | `main-product`, `main-article`, `faq` |

Brand colours, fonts, logo, radius and page width are all theme settings. The theme ships with a neutral placeholder palette until the client's brand assets arrive.

## Repository layout

```
assets/        base.css (design system) · theme.js (custom elements)
config/        settings_schema.json · settings_data.json
layout/        theme.liquid · password.liquid
locales/       en.default.json (every storefront string)
sections/      page sections + header/footer groups
snippets/      reusable partials (cards, care card, price, facets…)
templates/     JSON templates (+ customers/, gift_card.liquid)
setup/         store setup kit: custom.* metafield definitions, collections, content, setup script
docs/          SA launch checklist
```

## Development

Requires the [Shopify CLI](https://shopify.dev/docs/api/shopify-cli) (`npm i -g @shopify/cli`).

```bash
shopify theme check                                   # lint (must stay at 0 offenses)
shopify theme dev --store STORE.myshopify.com         # live-reload preview
shopify theme push --store STORE.myshopify.com --unpublished --theme "Planet Botanica"
shopify theme push --store STORE.myshopify.com --theme <id>   # update an existing theme
```

Development store: `1s1ffn-6j.myshopify.com` (alias `carnigalore.myshopify.com`), theme **Planet Botanica** `#143604252735` (unpublished). The store's live theme belongs to an earlier build: don't publish over it without the client's go-ahead.

The store's data model and setup: see [`setup/README.md`](setup/README.md).

### Conventions

- **Colour schemes:** every section has a `color_scheme` setting (`light`, `surface`, `dark`, `accent`). Schemes are CSS classes that set `--bg`, `--fg` and `--surface`; derived tokens (`--muted`, `--line`) use `color-mix()`.
- **JS:** one custom element per behaviour (`<product-form>`, `<cart-drawer>`, `<facet-filters>`, …), registered in `assets/theme.js`. Config and strings come from `window.theme` in `layout/theme.liquid`.
- **Cart re-rendering:** any element with `data-render-section="<section id>"` refreshes automatically after add/change through the Section Rendering API.
- **Variant changes** re-fetch the product section and swap elements marked `data-swap-id`.
- **Strings:** all storefront text goes through `locales/en.default.json` — add an `af.json` for Afrikaans without touching templates.

## Handover docs

- [`docs/client-guide.md`](docs/client-guide.md) — for the shop owner: adding plants and care data, writing News posts and care guides, menus, dispatch pause, theme settings, filters and quiz
- [`setup/README.md`](setup/README.md) — store setup script, filters, metafield reference, menu tree
- [`docs/sa-launch-checklist.md`](docs/sa-launch-checklist.md) — payments, couriers, VAT, POPIA, ECT Act, permits, QA
