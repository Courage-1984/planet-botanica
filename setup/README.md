# Store setup — care data, collections, content

Everything the theme expects that lives in the Shopify admin rather than in theme code. The schema matches the development store (`1s1ffn-6j.myshopify.com`) exactly, so its 77 products — photos, prices and care data — move to the client's store without remapping.

| File | What it is |
| --- | --- |
| `metafields.json` | `custom.*` care-data definitions: 19 on products, 1 on collections, 1 on articles. Choice lists power filters and the quiz. |
| `collections.json` | 18 smart collections: one per genus (by product type), Nepenthes by climate, and *Beginners / Rare / Tropicals* (by tag). |
| `content.json` | *Care guides* blog with 3 articles, plus About / Shipping / Contact pages. |
| `setup-store.mjs` | Creates all of the above through the Admin GraphQL API (2026-07). Safe to re-run. |

## Moving the catalogue to the client's store

Pick one:

- **Transfer the development store** to the client (Partner Dashboard → Stores → Transfer ownership). Everything comes along, and the setup script only needs its `content` step.
- **Fresh store:** run the setup script (below), then in the dev store go to *Products → Export → All products → CSV for Excel/Numbers* and import that file into the new store. The metafield columns map automatically because the definitions match.

## Running the setup script

Requires Node 18+ and the Shopify CLI (`npm i -g @shopify/cli`). Use the store's **permanent** `*.myshopify.com` domain (*Settings → Domains*). A custom-domain alias makes `store auth` fail with "OAuth callback store does not match".

```bash
# One-time: grant the CLI scoped Admin API access (approve in the browser tab that opens)
shopify store auth --store abc123.myshopify.com --scopes "read_products,write_products,read_publications,write_publications,read_content,write_content,read_online_store_pages,write_online_store_pages,read_online_store_navigation,write_online_store_navigation"

# Preview, then run (or one step at a time: --only=metafields,collections,content,menus)
SHOPIFY_STORE=abc123.myshopify.com node setup/setup-store.mjs --dry-run
SHOPIFY_STORE=abc123.myshopify.com node setup/setup-store.mjs

# Brand-new store only: replace Shopify's default Home/Catalog menus with the theme's
SHOPIFY_STORE=abc123.myshopify.com node setup/setup-store.mjs --only=menus --force-menus
```

PowerShell: `$env:SHOPIFY_STORE="abc123.myshopify.com"; node setup/setup-store.mjs`

Prefer a token? Create a custom app with the same scopes and set `SHOPIFY_ADMIN_TOKEN=shpat_…`; the script then calls the API directly instead of going through the CLI.

**Re-running is safe.** Definitions, collections, pages, articles and menus that already exist (matched by key or handle) are skipped. Existing menus are never overwritten without `--force-menus`, because menus are shared by every theme on the store.

## Storefront filters (manual — Shopify has no API for this)

Install **Shopify Search & Discovery** (free), then *Filters → Add filter*:

1. Availability
2. Price
3. Difficulty — `custom.difficulty` (number range)
4. Trap type — `custom.trap_type`
5. Climate — `custom.temperature_group`
6. Product type (genus)

The plant-finder quiz needs filters 3, 4 and 5. It sends shoppers to URLs like
`/collections/all?filter.p.m.custom.temperature_group=temperate&filter.p.m.custom.difficulty.lte=2`.
Without the filters, the quiz still works but shows every plant.

In Search & Discovery, also set **Complementary products** for plants (soil, pots, kits). The product page shows them in its "Complete the setup" row.

## Metafield reference (what the theme reads)

| Key | Type | Where it shows |
| --- | --- | --- |
| `latin_name` | text | Under the title when the title doesn't already contain it; also marks a product as a **live plant** (dispatch countdown, shipping notes) |
| `difficulty` | integer 1–5 | 3-dot meter: 1–2 Easy · 3 Intermediate · 4–5 Expert (cards, product page, care card); filters; quiz |
| `trap_type` | snap / pitfall / flypaper / suction / lobster-pot | Cards, product page, care card, filters, quiz |
| `temperature_group` | highland / intermediate / lowland / temperate / tropical / mediterranean | Product eyebrow, care card "Climate", filters, quiz |
| `dormancy_required` | boolean | Care card; winter-dormancy notice in season (months in theme settings) |
| `cites_listed` | boolean | CITES badge on the care card and product page |
| `lux_requirements`, `water_requirements`, `potting_media`, `humidity_min`, `temp_range` | text | Care card |
| `origin_location`, `origin_altitude`, `growth_speed`, `clonotype_code` | text | Care card "specimen" section; origin is also the card caption |
| `care_guide` | rich text | Expandable "Read the full care guide" at the bottom of the care card |
| `common_name`, `genus`, `supply_category` | text | Not displayed by the theme; kept for search and filtering |
| collection `care_guide_link` | text (path or URL) | "Read the care guide" link under a collection title |
| article `related_products` | product list | "Plants in this guide" row under a care guide |

**Live plants without a Latin name** (e.g. a starter kit): tag them `live-plant`, or whatever tag is set in *Theme settings → Live plant shipping*.
