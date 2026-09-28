#!/usr/bin/env node
/**
 * Planet Botanica — store setup.
 *
 * Prepares a store for the theme via the Shopify Admin GraphQL API:
 *   metafields   custom.* care-data definitions (products, collections, articles)
 *   collections  genus + curated smart collections, published to Online Store
 *   content      Care guides blog + articles, About / Shipping / Contact pages
 *   menus        planet-botanica-main-menu, planet-botanica-footer, customer-care
 *
 * Products are not created here: the catalogue lives in the development store and
 * moves with a store transfer, or via Products → Export / Import (CSV incl. metafields).
 *
 * Safe to re-run: anything that already exists (matched by key or handle) is skipped.
 * Menus use theme-specific handles, so Shopify's default main-menu / footer are never
 * touched; re-running leaves them as edited in the admin unless --force-menus is passed.
 *
 * Auth — either:
 *   a) Shopify CLI (recommended): run `shopify store auth` once (see setup/README.md),
 *      then leave SHOPIFY_ADMIN_TOKEN unset; requests go through `shopify store execute`.
 *   b) An Admin API access token from a custom app: set SHOPIFY_ADMIN_TOKEN.
 * SHOPIFY_STORE must be the permanent *.myshopify.com domain (Settings → Domains).
 *
 * Usage
 *   SHOPIFY_STORE=abc123.myshopify.com node setup/setup-store.mjs
 *   node setup/setup-store.mjs --only=metafields,collections
 *   node setup/setup-store.mjs --dry-run
 *
 * Admin API scopes: write_products, read_publications, write_publications,
 * write_content, write_online_store_pages, write_online_store_navigation
 */

import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];

const STORE = process.env.SHOPIFY_STORE?.replace(/^https?:\/\//, '').replace(/\/$/, '');
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2026-07';
const DRY_RUN = flag('dry-run');
const STEPS = (option('only') || 'metafields,collections,content,menus').split(',');
const NAMESPACE = 'custom';

const readJson = async (file) => JSON.parse(await readFile(join(here, file), 'utf8'));
const log = (...parts) => console.log(...parts);

/* -------------------------------------------------------------------------- */
/* GraphQL                                                                     */
/* -------------------------------------------------------------------------- */

// Transport 1: Shopify CLI (`shopify store auth` once, no token to manage).
function gqlViaCli(query, variables) {
  const dir = mkdtempSync(join(tmpdir(), 'pb-setup-'));
  const queryFile = join(dir, 'query.graphql');
  const variableFile = join(dir, 'variables.json');
  const outputFile = join(dir, 'result.json');
  writeFileSync(queryFile, query);
  writeFileSync(variableFile, JSON.stringify(variables));
  try {
    const cli = [
      'store execute',
      `--store ${STORE}`,
      `--query-file "${queryFile}"`,
      `--variable-file "${variableFile}"`,
      `--output-file "${outputFile}"`,
      `--version ${API_VERSION}`,
      /^\s*mutation/.test(query) ? '--allow-mutations' : '',
      '--no-color',
    ].join(' ');
    execSync(`shopify ${cli}`, { stdio: ['ignore', 'ignore', 'pipe'] });
    const json = JSON.parse(readFileSync(outputFile, 'utf8'));
    return json.data ?? json;
  } catch (error) {
    throw new Error(error.stderr?.toString() || error.message);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function gql(query, variables = {}) {
  if (!TOKEN) return gqlViaCli(query, variables);

  // Transport 2: Admin API access token.
  const response = await fetch(`https://${STORE}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': TOKEN },
    body: JSON.stringify({ query, variables }),
  });
  if (response.status === 429) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return gql(query, variables);
  }
  const json = await response.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors, null, 2));
  return json.data;
}

// Runs a mutation unless --dry-run; throws on userErrors except the tolerated codes.
async function mutate(label, query, variables, payloadKey, tolerate = []) {
  if (DRY_RUN) {
    log(`  [dry-run] ${label}`);
    return null;
  }
  const data = await gql(query, variables);
  const payload = data[payloadKey];
  const errors = (payload?.userErrors || []).filter((e) => !tolerate.includes(e.code));
  if (errors.length) throw new Error(`${label}: ${JSON.stringify(errors)}`);
  return payload;
}

async function findByHandle(connection, handle) {
  const data = await gql(
    `query ($q: String!) { ${connection}(first: 5, query: $q) { nodes { id handle } } }`,
    { q: `handle:${handle}` }
  );
  return data[connection].nodes.find((node) => node.handle === handle) || null;
}

async function onlineStorePublicationId() {
  const data = await gql(`{ publications(first: 25) { nodes { id name } } }`);
  return data.publications.nodes.find((p) => /online store/i.test(p.name))?.id || null;
}

async function publish(id, publicationId) {
  if (!publicationId) return;
  await mutate(
    `publish ${id}`,
    `mutation ($id: ID!, $input: [PublicationInput!]!) {
      publishablePublish(id: $id, input: $input) { userErrors { field message } }
    }`,
    { id, input: [{ publicationId }] },
    'publishablePublish'
  );
}

/* -------------------------------------------------------------------------- */
/* Steps                                                                       */
/* -------------------------------------------------------------------------- */

async function setupMetafields() {
  log('\n▸ Metafield definitions');
  const definitions = await readJson('metafields.json');
  const owners = [
    ['PRODUCT', definitions.product || []],
    ['COLLECTION', definitions.collection || []],
    ['ARTICLE', definitions.article || []],
  ];

  for (const [owner, fields] of owners) {
    for (const field of fields) {
      const validations = [];
      if (field.choices) validations.push({ name: 'choices', value: JSON.stringify(field.choices) });
      if (field.min !== undefined) validations.push({ name: 'min', value: String(field.min) });
      if (field.max !== undefined) validations.push({ name: 'max', value: String(field.max) });

      const result = await mutate(
        `${owner.toLowerCase()} ${NAMESPACE}.${field.key}`,
        `mutation ($definition: MetafieldDefinitionInput!) {
          metafieldDefinitionCreate(definition: $definition) {
            createdDefinition { id }
            userErrors { field message code }
          }
        }`,
        {
          definition: {
            name: field.name,
            namespace: NAMESPACE,
            key: field.key,
            type: field.type,
            ownerType: owner,
            description: field.description || '',
            pin: true,
            access: { storefront: 'PUBLIC_READ' },
            validations,
          },
        },
        'metafieldDefinitionCreate',
        ['TAKEN']
      );
      if (result) log(`  ${result.createdDefinition ? '✓ created' : '• exists '} ${owner.toLowerCase()} ${NAMESPACE}.${field.key}`);
    }
  }
}

async function metafieldDefinitionId(key) {
  const data = await gql(
    `query ($key: String!) {
      metafieldDefinitions(first: 1, ownerType: PRODUCT, namespace: "${NAMESPACE}", key: $key) { nodes { id } }
    }`,
    { key }
  );
  return data.metafieldDefinitions.nodes[0]?.id || null;
}

async function setupCollections(publicationId) {
  log('\n▸ Collections');
  const { collections } = await readJson('collections.json');

  for (const collection of collections) {
    const existing = DRY_RUN ? null : await findByHandle('collections', collection.handle);
    if (existing) {
      // Still attach the care-guide link, so re-runs keep collections in step with collections.json.
      if (collection.care_guide_link) {
        await mutate(
          `care guide link ${collection.handle}`,
          `mutation ($metafields: [MetafieldsSetInput!]!) {
            metafieldsSet(metafields: $metafields) { userErrors { field message } }
          }`,
          {
            metafields: [
              { ownerId: existing.id, namespace: NAMESPACE, key: 'care_guide_link', type: 'single_line_text_field', value: collection.care_guide_link },
            ],
          },
          'metafieldsSet'
        );
        log(`  • exists  ${collection.handle} (care guide link set)`);
      } else {
        log(`  • exists  ${collection.handle}`);
      }
      continue;
    }

    // Admin API 2026-07+ builds smart collections from "sources" (inclusion conditions).
    const conditions = [];
    for (const rule of collection.rules) {
      if (rule.metafield) {
        const definitionId = DRY_RUN ? 'dry-run' : await metafieldDefinitionId(rule.metafield);
        if (!definitionId) throw new Error(`${collection.handle}: run the metafields step first (${rule.metafield})`);
        conditions.push({ metafieldString: { definitionId, relation: 'EQUALS', values: [rule.condition], matchType: 'ANY' } });
      } else if (rule.column === 'TAG') {
        conditions.push({ productTag: { relation: 'TAGGED_WITH', values: [rule.condition], matchType: 'ANY' } });
      } else {
        conditions.push({ productType: { relation: 'EQUALS', values: [rule.condition], matchType: 'ANY' } });
      }
    }

    const result = await mutate(
      `collection ${collection.handle}`,
      `mutation ($collection: CollectionCreateInput!) {
        collectionCreate(collection: $collection) { collection { id } userErrors { field message } }
      }`,
      {
        collection: {
          title: collection.title,
          handle: collection.handle,
          descriptionHtml: collection.description || '',
          sources: [
            {
              source: {
                title: `${collection.title} — rules`,
                inclusion: { matchType: collection.disjunctive ? 'ANY' : 'ALL', conditions },
              },
            },
          ],
          metafields: collection.care_guide_link
            ? [{ namespace: NAMESPACE, key: 'care_guide_link', type: 'single_line_text_field', value: collection.care_guide_link }]
            : [],
        },
      },
      'collectionCreate'
    );
    if (result?.collection) {
      await publish(result.collection.id, publicationId);
      log(`  ✓ created ${collection.handle}`);
    }
  }
}

async function setupContent() {
  log('\n▸ Blog, articles & pages');
  const content = await readJson('content.json');

  for (const blogConfig of content.blogs) {
    const blog = await ensureBlog(blogConfig);
    for (const article of blogConfig.articles || []) await ensureArticle(blog, article);
  }

  // Pages
  for (const page of content.pages) {
    if (!DRY_RUN && (await findByHandle('pages', page.handle))) {
      log(`  • exists  page ${page.handle}`);
      continue;
    }
    const result = await mutate(
      `page ${page.handle}`,
      `mutation ($page: PageCreateInput!) { pageCreate(page: $page) { page { id } userErrors { field message code } } }`,
      {
        page: {
          title: page.title,
          handle: page.handle,
          body: page.body,
          isPublished: true,
          templateSuffix: page.template_suffix || null,
        },
      },
      'pageCreate'
    );
    if (result?.page) log(`  ✓ created page ${page.handle}`);
  }
}

async function ensureBlog({ handle, title }) {
  if (DRY_RUN) {
    log(`  [dry-run] blog ${handle}`);
    return { id: 'dry-run' };
  }
  const existing = await findByHandle('blogs', handle);
  if (existing) {
    log(`  • exists  blog ${handle}`);
    return existing;
  }
  const result = await mutate(
    `blog ${handle}`,
    `mutation ($blog: BlogCreateInput!) { blogCreate(blog: $blog) { blog { id handle } userErrors { field message } } }`,
    { blog: { title, handle } },
    'blogCreate'
  );
  log(`  ✓ created blog ${handle}`);
  return result?.blog;
}

// Creates the article (published unless "published": false) and links its "Plants in this guide".
async function ensureArticle(blog, article) {
  const draft = article.published === false;
  let existing = null;
  if (!DRY_RUN) {
    const data = await gql(
      `query ($q: String!) { articles(first: 5, query: $q) { nodes { id handle blog { id } } } }`,
      { q: `handle:${article.handle}` }
    );
    existing = data.articles.nodes.find((a) => a.handle === article.handle && a.blog.id === blog.id);
  }

  let articleId = existing?.id;
  if (existing) {
    log(`  • exists  article ${article.handle}`);
  } else {
    const result = await mutate(
      `article ${article.handle}${draft ? ' (draft)' : ''}`,
      `mutation ($article: ArticleCreateInput!) {
        articleCreate(article: $article) { article { id } userErrors { field message code } }
      }`,
      {
        article: {
          blogId: blog.id,
          title: article.title,
          handle: article.handle,
          body: article.body,
          summary: article.summary,
          tags: article.tags,
          author: { name: 'Planet Botanica' },
          isPublished: !draft,
        },
      },
      'articleCreate'
    );
    articleId = result?.article?.id;
    if (articleId) log(`  ✓ created article ${article.handle}${draft ? ' (draft)' : ''}`);
  }

  // "Plants in this guide": the first few products matching the article's query.
  if (articleId && article.related_query && !DRY_RUN) {
    const data = await gql(
      `query ($q: String!) { products(first: 6, query: $q, sortKey: TITLE) { nodes { id } } }`,
      { q: `${article.related_query} AND status:active` }
    );
    const ids = data.products.nodes.map((p) => p.id);
    if (ids.length) {
      await mutate(
        `related products ${article.handle}`,
        `mutation ($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) { userErrors { field message } }
        }`,
        {
          metafields: [
            { ownerId: articleId, namespace: NAMESPACE, key: 'related_products', type: 'list.product_reference', value: JSON.stringify(ids) },
          ],
        },
        'metafieldsSet'
      );
    }
  }
}

async function setupMenus() {
  log('\n▸ Menus');
  if (DRY_RUN) return log('  [dry-run] planet-botanica-main-menu, planet-botanica-footer, customer-care');

  const resource = async (connection, type, handle, title, path) => {
    const node = await findByHandle(connection, handle);
    return node ? { title, type, resourceId: node.id } : { title, type: 'HTTP', url: path };
  };
  const collection = (handle, title) => resource('collections', 'COLLECTION', handle, title, `/collections/${handle}`);
  const page = (handle, title) => resource('pages', 'PAGE', handle, title, `/pages/${handle}`);
  const blog = (handle, title) => resource('blogs', 'BLOG', handle, title, `/blogs/${handle}`);

  const genera = [
    ['dionaea', 'Venus flytraps'],
    ['drosera', 'Sundews'],
    ['sarracenia', 'Trumpet pitchers'],
    ['nepenthes', 'Tropical pitchers'],
    ['pinguicula', 'Butterworts'],
    ['utricularia', 'Bladderworts'],
    ['heliamphora', 'Sun pitchers'],
    ['cephalotus', 'Albany pitchers'],
    ['darlingtonia', 'Cobra lilies'],
    ['byblis', 'Rainbow plants'],
    ['drosophyllum', 'Dewy pines'],
  ];

  // Theme-specific handles, so Shopify's default main-menu / footer (and any other
  // theme using them) are never touched. The theme's header and footer point here.
  const menus = [
    {
      handle: 'planet-botanica-main-menu',
      title: 'Planet Botanica — main menu',
      // Three levels under "Shop plants" make the header render it as a mega menu.
      items: [
        {
          title: 'Shop plants',
          type: 'CATALOG',
          url: '/collections/all',
          items: [
            {
              title: 'By genus',
              type: 'COLLECTIONS',
              url: '/collections',
              items: await Promise.all(genera.map(([handle, title]) => collection(handle, title))),
            },
            {
              title: 'Collections',
              type: 'COLLECTIONS',
              url: '/collections',
              items: [
                await collection('coll-beginners', 'Beginner-friendly'),
                await collection('coll-rare-species', 'Rare species'),
                await collection('coll-tropicals', 'Tropicals'),
                await collection('growing-supplies', 'Growing supplies'),
              ],
            },
          ],
        },
        await collection('coll-beginners', 'Beginner-friendly'),
        {
          ...(await blog('care-guides', 'Learn')),
          items: [
            await blog('care-guides', 'Care guides'),
            await blog('news', 'News'),
            await page('shipping-policy', 'Delivery & shipping'),
          ],
        },
        await page('about', 'Our story'),
        await page('contact', 'Contact us'),
      ],
    },
    {
      handle: 'planet-botanica-footer',
      title: 'Planet Botanica — footer',
      items: [
        { title: 'All plants', type: 'CATALOG', url: '/collections/all' },
        await collection('coll-beginners', 'Beginner-friendly'),
        await collection('coll-rare-species', 'Rare species'),
        await collection('growing-supplies', 'Growing supplies'),
        { title: 'Search', type: 'SEARCH', url: '/search' },
      ],
    },
    {
      handle: 'customer-care',
      title: 'Customer care',
      items: [
        await page('shipping-policy', 'Shipping & delivery'),
        await blog('care-guides', 'Care guides'),
        await blog('news', 'News'),
        await page('about', 'Our story'),
        await page('contact', 'Contact us'),
      ],
    },
  ];

  const existing = (await gql(`{ menus(first: 50) { nodes { id handle } } }`)).menus.nodes;
  for (const menu of menus) {
    const current = existing.find((m) => m.handle === menu.handle);
    if (current && !flag('force-menus')) {
      log(`  • exists  ${menu.handle} (left untouched — pass --force-menus to overwrite)`);
      continue;
    }
    if (current) {
      await mutate(
        `menu ${menu.handle}`,
        `mutation ($id: ID!, $title: String!, $handle: String, $items: [MenuItemUpdateInput!]!) {
          menuUpdate(id: $id, title: $title, handle: $handle, items: $items) { userErrors { field message } }
        }`,
        { id: current.id, title: menu.title, handle: menu.handle, items: menu.items },
        'menuUpdate'
      );
      log(`  ✓ updated ${menu.handle}`);
    } else {
      await mutate(
        `menu ${menu.handle}`,
        `mutation ($title: String!, $handle: String!, $items: [MenuItemCreateInput!]!) {
          menuCreate(title: $title, handle: $handle, items: $items) { userErrors { field message } }
        }`,
        { title: menu.title, handle: menu.handle, items: menu.items },
        'menuCreate'
      );
      log(`  ✓ created ${menu.handle}`);
    }
  }
}

/* -------------------------------------------------------------------------- */

async function main() {
  if (!STORE) {
    console.error('Set SHOPIFY_STORE to the permanent *.myshopify.com domain. See setup/README.md.');
    process.exit(1);
  }

  const transport = TOKEN ? 'access token' : 'Shopify CLI';
  log(`Planet Botanica setup → ${STORE} (API ${API_VERSION}, via ${transport})${DRY_RUN ? ' [dry run]' : ''}`);
  const publicationId = DRY_RUN ? null : await onlineStorePublicationId();
  if (!DRY_RUN && !publicationId) log('! Online Store publication not found — collections will not be published automatically.');

  if (STEPS.includes('metafields')) await setupMetafields();
  if (STEPS.includes('collections')) await setupCollections(publicationId);
  if (STEPS.includes('content')) await setupContent();
  if (STEPS.includes('menus')) await setupMenus();

  log('\nDone. Next: add the storefront filters in Search & Discovery (see setup/README.md).');
}

main().catch((error) => {
  console.error(`\n✗ ${error.message}`);
  process.exit(1);
});
