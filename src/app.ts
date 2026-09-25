import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { db } from './db/db.js';
import { Header } from './components/header.js';
import { recordRows } from './db/db_functions.js';
import { DatasetPage, datasetTags, type DatasetFilters } from './pages/dataset_page.js';

// HTMX stuff
type Variables = { isHtmx: boolean };
export const app = new Hono<{ Variables: Variables }>();
const devRevision = Date.now().toString();
app.use('*', async (c, next) => {
  c.set('isHtmx', c.req.header('HX-Request') === 'true');
  await next();
});

// static files
app.use('/static/*', serveStatic({ root: './' }));
app.get('/__dev/revision', (c) => c.text(devRevision));



function layout(content: string) {
  return `
  <!doctype html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Disability Data Archive</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css">
        <script>
          (() => {
            const revision = '${devRevision}';
            setInterval(async () => {
              try {
                const response = await fetch('/__dev/revision', { cache: 'no-store' });
                if ((await response.text()) !== revision) window.location.reload();
              } catch {
                // The server may be restarting after a source change.
              }
            }, 500);
          })();
        </script>
    </head>
    <body>
        <main class="container">
        ${Header()}
        ${content}
        </main>
    </body>
    </html>`;
}

app.get('/', async (c) => {
  const records = await db.selectFrom('records')
    .select(['title', 'description', 'source', 'published_year'])
    .orderBy('published_year', 'desc')
    .execute();

  const content = `
    <section class="archive" aria-labelledby="archive-title">
      <div class="section-heading">
        <span class="count">${records.length.toString().padStart(2, '0')} entries</span>
      </div>
      <div id="record-list" class="record-list">${recordRows(records)}</div>
    </section>
  `;

  return c.html(layout(content));
});

app.get('/datasets', async (c) => {
  const records = await db.selectFrom('records')
    .select(['title', 'description', 'source', 'published_year'])
    .orderBy('published_year', 'desc')
    .execute();

  const rawFrom = Number(c.req.query('from'));
  const rawTo = Number(c.req.query('to'));
  const filters: DatasetFilters = {
    tag: c.req.query('tag')?.trim() || undefined,
    from: Number.isInteger(rawFrom) ? rawFrom : undefined,
    to: Number.isInteger(rawTo) ? rawTo : undefined,
  };
  const filteredRecords = records.filter((record) => {
    const matchingTag = !filters.tag || datasetTags(record).includes(filters.tag);
    const afterStart = filters.from === undefined || record.published_year >= filters.from;
    const beforeEnd = filters.to === undefined || record.published_year <= filters.to;
    return matchingTag && afterStart && beforeEnd;
  });

  return c.html(layout(DatasetPage(filteredRecords, filters)));
});

app.get('/records', async (c) => {
  const query = c.req.query('q')?.trim() ?? '';
  const records = await db.selectFrom('records')
    .select(['title', 'description', 'source', 'published_year'])
    .where((expression) => query
      ? expression.or([
        expression('title', 'ilike', `%${query}%`),
        expression('description', 'ilike', `%${query}%`),
        expression('source', 'ilike', `%${query}%`),
      ])
      : expression('id', 'is not', null))
    .orderBy('published_year', 'desc')
    .execute();

  return c.html(recordRows(records));
});

app.get('/health', (c) => c.json({ ok: true }));
