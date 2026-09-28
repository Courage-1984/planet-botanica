# South Africa launch checklist — Planet Botanica

Store configuration that sits outside the theme. Work through it top to bottom before removing the store password. Items marked **⚖ confirm** are legal or tax questions — this list flags them, it isn't legal advice; the client's accountant or attorney should sign them off.

## 1. Store basics

- [ ] **Settings → General:** store name, legal business name, physical address, phone, sender email.
- [ ] **Currency:** South African Rand (ZAR). Money format `R {{amount}}`.
- [ ] **Time zone:** (GMT+02:00) Africa/Johannesburg. The dormancy notice and order times depend on it.
- [ ] **Markets:** South Africa only (disable international unless the client wants to ship plants abroad — see §7).
- [ ] **Theme settings → Business details:** legal name, registration number, VAT number (if registered), physical address, email, phone. These print in the footer.
- [ ] **Theme settings → Social & WhatsApp:** WhatsApp number in international format (`27…`), social links.

## 2. Payments

Shopify Payments isn't available to South African merchants, so the store uses third-party gateways. Recommended setup: **one card gateway + one instant-EFT option**.

| Provider | What it adds | Notes |
| --- | --- | --- |
| PayFast | Cards, instant EFT, SnapScan, Zapper, Mobicred and more in one gateway | Widely trusted by SA shoppers |
| Yoco | Cards | Also runs the client's card machine if they sell at markets |
| Ozow | Instant EFT directly from the customer's bank | Lower fees than cards; popular for higher baskets |
| Peach Payments / Paystack | Cards, EFT, alternative methods | Good alternatives — compare fees |
| Payflex / PayJustNow | Buy now, pay later | Optional; useful for kits and collector plants |

- [ ] Compare current fees at signup — they change. Shopify also charges its own transaction fee on third-party gateways; check the rate for the chosen plan.
- [ ] Complete the gateway's KYC (ID, proof of address, bank letter). Allow a few working days.
- [ ] **Settings → Payments → Manual payment methods:** optionally add "Bank deposit (EFT)" with banking details and "orders ship once payment reflects".
- [ ] Place a real test order with every payment method, then refund it.

## 3. Shipping & delivery

- [ ] Pick a courier setup:
  - **Bob Go** — multi-courier aggregator (The Courier Guy, Aramex, Pargo and others), live rates, waybills and tracking in one app.
  - **The Courier Guy** app — door-to-door plus **Pudo** lockers.
  - **Pargo** — pickup points in retail stores nationwide.
  - Budget option for supplies: **Paxi** (PEP store collection) — slower, so not ideal for live plants.
- [ ] Live courier rates at checkout need carrier-calculated shipping; check whether the chosen Shopify plan includes it, or use flat rates.
- [ ] **Two shipping profiles:**
  - *Live plants* (every plant product — i.e. everything except the *Growing supplies* type): only fast services (overnight/economy with 1–3-day transit). No slow pickup networks.
  - *Supplies*: all options, including the cheapest.
- [ ] Free-shipping rule in Shopify matches **Theme settings → Cart → Free shipping threshold** (default R900).
- [ ] **Theme settings → Live plant shipping:** dispatch days (default Mon–Wed), cut-off hour, shipping note, dormancy months.
- [ ] Plan dispatch pauses: long weekends (Easter, 27 April, 1 May, 16 June, 9 August, 24 September, 16 December), the December/January courier shutdown and heatwaves. Use **Dispatch pause** in theme settings — orders stay open, customers see the message.
- [ ] Checkout (**Settings → Checkout**): shipping-address phone number **required** (couriers need it); company name optional; address line 2 optional (label it "Suburb / complex" in *Checkout language*).
- [ ] Order confirmation email: add one line about dispatch days and what a dormant winter plant looks like.

## 4. VAT & invoices

- [ ] **⚖ confirm** whether the client is VAT registered, or must register (compulsory above the SARS turnover threshold — check the current figure).
- [ ] **If registered:** Settings → Taxes and duties → South Africa → collect VAT at 15%, *All prices include tax* on. The theme then shows "VAT included".
- [ ] **If not registered:** tax collection **off**, VAT number left blank in theme settings, and no "VAT included" wording in content.
- [ ] VAT vendors must issue valid tax invoices (the words "Tax invoice", supplier VAT number, date, description, VAT amount and so on). Shopify's default emails aren't formatted as tax invoices — add an invoice app (e.g. Sufio or Order Printer with a compliant template).

## 5. Legal pages & consumer law

Set up in **Settings → Policies**. Shopify's generated templates are a starting point only.

- [ ] **ECT Act, section 43:** the website must show the supplier's details (legal name and status, registration number, physical and postal address, phone, email), full prices including delivery and taxes, payment methods, delivery times, the returns and refund policy, the privacy and security policy and the cooling-off right. The footer covers the business details; the policies cover the rest.
- [ ] **Returns & refunds.** **⚖ confirm:**
  - The ECT Act's 7-day cooling-off right (s44) has exclusions for goods that, by their nature, can't be returned or are likely to deteriorate rapidly. Get advice on whether live plants fall within them before the policy relies on it.
  - Consumer Protection Act quality warranties apply to supplies (soil, pots, kits); get advice on how they apply to live plants.
  - The theme's "arrive-alive promise" copy (photo within 48 hours) must match the final policy wording.
- [ ] **Terms of service** and **shipping policy** match the real courier setup and dispatch days.
- [ ] **POPIA:**
  - [ ] Privacy policy covering what's collected, why, the operator (Shopify, payment gateway, courier), retention and data-subject rights.
  - [ ] Register the Information Officer with the Information Regulator (eServices portal).
  - [ ] Direct marketing is opt-in: in **Settings → Checkout → Marketing options**, leave "preselect sign-up" **off**. The theme's newsletter form already carries consent wording and links the privacy policy.

## 6. Plants, permits & biodiversity

- [ ] **⚖ confirm** provincial permit requirements for selling **indigenous** species (the catalogue's products tagged `Region: South Africa`, e.g. *Drosera capensis*). Selling nursery-propagated plants may still need a permit from the provincial conservation authority (e.g. CapeNature in the Western Cape).
- [ ] **⚖ confirm** CITES/NEMBA paperwork for **imported** stock. Several genera (including *Dionaea*, *Sarracenia*, *Nepenthes* and *Cephalotus*) are CITES-listed. Selling cultivated plants within SA is different from importing or exporting them. Set `custom.cites_listed` on those products so the product page shows the CITES badge — only 2 of the 77 products have it today.
- [ ] Keep product copy honest: "nursery-propagated, never wild-collected" only if that's true for every plant.

## 7. International shipping (only if the client asks)

Live plants crossing borders need phytosanitary certificates, and possibly CITES permits. Recommendation for launch: **SA only**, with supplies (soil, pots) as a possible later export add-on.

## 8. Domain, email & marketing

- [ ] Register the `.co.za` domain (any ZACR-accredited registrar) and connect it in **Settings → Domains**: A record `@ → 23.227.38.65`, CNAME `www → shops.myshopify.com`. Set it as primary.
- [ ] Sender email on the own domain (verify DKIM/SPF in **Settings → Notifications**).
- [ ] Install *Google & YouTube* (product feed + Search Console) and *Facebook & Instagram* (pixel, catalogue, Instagram shopping).
- [ ] Submit `https://DOMAIN/sitemap.xml` in Google Search Console.
- [ ] Shopify Email (free tier) or Klaviyo for the "Bog Letter" newsletter and abandoned-cart emails.

## 9. Apps (keep it lean)

Every app adds monthly cost and page weight. Recommended launch stack:

1. **Search & Discovery** (free) — filters, synonyms, complementary products. *Required by the plant finder.*
2. One **courier** app (Bob Go, The Courier Guy or Pargo).
3. **Reviews** — Judge.me or Shopify Product Reviews. Only publish real reviews; the theme's testimonials section ships with placeholders that must be replaced or removed.
4. **Tax invoices** — only if VAT registered.

## 10. Pre-launch QA

- [ ] Catalogue moved to the client's store (store transfer, or `setup/setup-store.mjs` + product CSV export/import) — see `setup/README.md`.
- [ ] Every plant has: product type = genus, Latin name, difficulty, trap type, climate (temperature group), light, water and at least two photos. Kits without a Latin name carry the `live-plant` tag.
- [ ] **⚖ confirm photo rights.** Several current product photos look like they came from Wikimedia Commons (e.g. the Venus flytrap collage, the seedling close-up), plus public-domain botanical plates. Commons photos are often CC BY-SA and need a visible credit. Get licences confirmed with credits added, or replace them with the nursery's own photography.
- [ ] **Confirm prices.** Beginner plants are currently R15–R38 (e.g. *Utricularia bisquamata* R15, a Venus flytrap seedling R38) while some Nepenthes are R1,450–R8,500. Check the low end isn't placeholder data.
- [ ] Test orders to Cape Town, Johannesburg, Durban and one rural postal code; check rates and delivery estimates.
- [ ] Filters + plant-finder quiz return sensible results.
- [ ] Mobile pass: iPhone Safari and a mid-range Android (most SA traffic is mobile, often on data — keep images compressed).
- [ ] Lighthouse mobile ≥ 85 performance on home, collection and product pages; accessibility ≥ 95.
- [ ] All placeholders replaced: About page, testimonials, homepage image-with-text story, hero image, logo, colours.
- [ ] 404 page, password page, gift card and customer account pages checked.
- [ ] Remove the store password (**Online Store → Preferences**) and announce.
