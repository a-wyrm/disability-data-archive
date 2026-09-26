import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { Header } from './components/header.js';
import { getAllArtifacts } from './db/db_functions.js';

// pages
import { DatasetPage, type DatasetFilters } from './pages/dataset_page.js';
import { AboutPage } from './pages/about.js';

type ArtifactRecord = Awaited<ReturnType<typeof getAllArtifacts>>[number];

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character);
}

function recordRows(records: ArtifactRecord[]) {
  return records.length === 0
    ? '<p class="empty">No artifacts found.</p>'
    : records.map((record) => `
      <article class="record-row">
        <div>
          <h2>${escapeHtml(record.file_name)}</h2>
          <p>${escapeHtml(record.org_source)} · ${escapeHtml(record.artifact_type)}</p>
        </div>
        <a href="${escapeHtml(record.file_path)}">Open artifact</a>
      </article>
    `).join('');
}

function datasetTags(record: ArtifactRecord): string[] {
  
  const value = (record as ArtifactRecord & { tags?: unknown }).tags;

  if (Array.isArray(value)) {
    return value.filter((tag): tag is string => typeof tag === 'string');
  }

  return typeof value === 'string' ? value.split(',').map((tag) => tag.trim()).filter(Boolean) : [];
}

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
  const records = await getAllArtifacts();

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
  const artifacts = await getAllArtifacts();

  const rawFrom = Number(c.req.query('from'));
  const rawTo = Number(c.req.query('to'));
  const filters: DatasetFilters = {
    tag: c.req.query('tag')?.trim() || undefined,
    from: Number.isInteger(rawFrom) ? rawFrom : undefined,
    to: Number.isInteger(rawTo) ? rawTo : undefined,
  };
  
  const filteredRecords = artifacts.filter((record) => {
    const matchingTag = !filters.tag || datasetTags(record).includes(filters.tag);
    const publishedYear = Number.parseInt(record.dataset_date ?? '', 10) || 0;
    const afterStart = filters.from === undefined || publishedYear >= filters.from;
    const beforeEnd = filters.to === undefined || publishedYear <= filters.to;
    return matchingTag && afterStart && beforeEnd;
  });

  return c.html(layout(await DatasetPage(
    filteredRecords as unknown as Parameters<typeof DatasetPage>[0],
    filters,
  )));
});

app.get('/records', async (c) => {
  const query = c.req.query('q')?.trim() ?? '';
  const artifacts = await getAllArtifacts();
  const records = query ? artifacts.filter((artifact) => [
      artifact.file_name,
      artifact.file_path,
      artifact.org_source,
      artifact.artifact_type,
      artifact.dataset_date,
    ].some((value) => value?.toLowerCase().includes(query.toLowerCase())))
    : artifacts;

  return c.html(recordRows(records));
});

app.get('/about', async (c) => {
  return c.html(layout(AboutPage()));
});