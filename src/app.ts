import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { statSync } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { basename, join, resolve } from 'node:path';
import { Header } from './components/header.js';
import { createArtifactWithTags, createReviewComment, createUser, findArtifactWithTags, findPendingArtifact, findUserByLogin, getAllArtifacts, getPendingArtifacts, getReviewComments, reviewArtifact, searchArtifacts, updateReviewComment } from './db/db_functions.js';
import { escapeHtml } from "./utilities/escape_html.js";
import { clearSession, createSession, getSession, hashPassword, setSessionCookie, verifyPassword } from './utilities/auth.js';

// pages
import { DatasetPage, type DatasetFilters } from './pages/dataset_page.js';
import { DatasetDetailPage } from './pages/dataset_detail_page.js';
import { AboutPage } from './pages/about.js';
import { SearchPage } from './pages/search_page.js';
import { SubmitPage, submitError, submitSuccess } from './pages/submit_db.js';
import { CsvViewer } from './components/csv_viewer.js';
import { CreateAccountPage, accountError } from './pages/userPages/create_account.js';
import { LoginPage, loginError } from './pages/userPages/login.js';
import { ReviewListPage } from './pages/userPages/review_list.js';
import { ReviewFilePage } from './pages/userPages/review_files.js';


// upload stuff
const uploadDirectory = resolve(process.env.UPLOAD_DIRECTORY ?? 'uploads');
const maxUploadBytes = 10 * 1024 * 1024;
const allowedExtensions = new Map([
  ['.csv', { type: 'csv', mimeTypes: ['text/csv', 'application/csv', 'application/vnd.ms-excel'] }],
  ['.jpg', { type: 'image', mimeTypes: ['image/jpeg'] }],
  ['.jpeg', { type: 'image', mimeTypes: ['image/jpeg'] }],
  ['.png', { type: 'image', mimeTypes: ['image/png'] }],
]);
const submissionAttempts = new Map<string, number[]>();

type ArtifactRecord = Awaited<ReturnType<typeof getAllArtifacts>>[number];


function recordRows(records: ArtifactRecord[]) {
  return records.length === 0
    ? '<p class="empty">No artifacts found.</p>'
    : records.map((record) => {
      const isCsv = record.artifact_type.toLowerCase() === 'csv'
        || record.file_name.toLowerCase().endsWith('.csv');
      const artifactUrl = isCsv
        ? `/datasets/${record.id}/view`
        : record.file_path;

      return `
        <article class="record-row">
          <div>
            <h2>${escapeHtml(record.file_name)}</h2>
            <p>${escapeHtml(record.org_source)} · ${escapeHtml(record.artifact_type)}</p>
          </div>
          <a href="${escapeHtml(artifactUrl)}">Open artifact</a>
        </article>
      `;
    }).join('');
}



// HTMX stuff
type Variables = { isHtmx: boolean };
export const app = new Hono<{ Variables: Variables }>();
const devStart = Date.now().toString();
const stylesheetPaths = ['./static/css/styles.css', './static/css/csv_viewer.css', './static/css/header_styles.css', './static/css/user_pages.css'];
export function getDevRevision() {
  const stylesheetRevisions = stylesheetPaths
    .map((stylesheetPath) => statSync(stylesheetPath).mtimeMs)
    .join('-');
  return `${devStart}-${stylesheetRevisions}`;
}

app.use('*', async (c, next) => {
  c.set('isHtmx', c.req.header('HX-Request') === 'true');
  await next();
});

// static files
app.use('/static/*', serveStatic({ root: './' }));
app.use('/uploads/*', serveStatic({ root: './' }));
app.get('/__dev/revision', (c) => c.text(getDevRevision()));

function layout(content: string, isAuthenticated = false) {
  return `
  <!doctype html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="icon" href="/static/disability-pride-flag.png"></link>
        <title>Disability Data Archive</title>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@picocss/pico@2.1.1/css/pico.min.css"
        >
        <link rel="stylesheet" href="/static/css/styles.css?v=${getDevRevision()}">

        <script>
          (() => {
            const revision = '${getDevRevision()}';
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
        <a class="skip-link" href="#main-content">Skip to main content</a>
        ${Header(isAuthenticated)}
        <main id="main-content" class="container" tabindex="-1">
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

app.get("/search", async (c) => {
	const searchValue = c.req.query("q") ?? "";

  const artifacts = await searchArtifacts(searchValue);
  const results = await Promise.all(artifacts.map(async (artifact) => {
    const artifactWithTags = await findArtifactWithTags(Number(artifact.id));
    return {
      ...artifact,
      tags: artifactWithTags?.tags ?? [],
    };
  }));

  return c.html(layout(SearchPage(results, searchValue)));
});


app.get('/datasets', async (c) => {
  const artifacts = await getAllArtifacts();
  const taggedArtifacts = await Promise.all(artifacts.map((artifact) => findArtifactWithTags(Number(artifact.id))));
  const tagsByArtifactId = new Map(
    taggedArtifacts
      .filter((artifact): artifact is NonNullable<typeof artifact> => artifact !== null)
      .map((artifact) => [artifact.id, artifact.tags.map((tag) => tag.name)])
  );

  const rawFrom = Number(c.req.query('from'));
  const rawTo = Number(c.req.query('to'));
  const filters: DatasetFilters = {
    tag: c.req.query('tag')?.trim() || undefined,
    from: Number.isInteger(rawFrom) ? rawFrom : undefined,
    to: Number.isInteger(rawTo) ? rawTo : undefined,
  };
  
  const filteredRecords = artifacts.filter((record) => {
    const matchingTag = !filters.tag || (tagsByArtifactId.get(record.id) ?? []).includes(filters.tag);
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

app.get('/datasets/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id < 1) {
    return c.notFound();
  }

  const dataset = await findArtifactWithTags(id);
  if (!dataset) {
    return c.notFound();
  }

  return c.html(layout(DatasetDetailPage(dataset)));
});

app.get('/datasets/:id/view', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id < 1) {
    return c.notFound();
  }

  const dataset = await findArtifactWithTags(id);
  if (!dataset) {
    return c.notFound();
  }

  const isCsv = dataset.artifact_type.toLowerCase() === 'csv' || dataset.file_name.toLowerCase().endsWith('.csv');
  if (!isCsv) {
    return c.redirect(`/datasets/${id}`);
  }

  return c.html(layout(CsvViewer(dataset, getDevRevision())));
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

app.get('/signup', (c) => c.html(layout(CreateAccountPage(), Boolean(getSession(c)))));
app.post('/signup', async (c) => {
  const body = await c.req.parseBody();
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!/^[a-zA-Z0-9_]{3,100}$/.test(username) || !/^\S+@\S+\.\S+$/.test(email) || password.length < 12) {
    return c.html(layout(CreateAccountPage(accountError('Use a valid username, email, and a password of at least 12 characters.'))), 400);
  }
  try {
    const user = await createUser(username, email, await hashPassword(password));
    setSessionCookie(c, createSession(user.user_id, user.username));
    return c.redirect('/userPages/review_list');
  } catch {
    return c.html(layout(CreateAccountPage(accountError('That username or email is already in use.'))), 409);
  }
});

app.get('/login', (c) => c.html(layout(LoginPage(), Boolean(getSession(c)))));
app.post('/login', async (c) => {
  const body = await c.req.parseBody();
  const login = typeof body.login === 'string' ? body.login.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const user = await findUserByLogin(login);
  if (!user || user.is_locked || !(await verifyPassword(password, user.password_hash))) {
    return c.html(layout(LoginPage(loginError('The login details are not valid.'))), 401);
  }
  setSessionCookie(c, createSession(user.user_id, user.username));
  return c.redirect('/userPages/review_list');
});

app.get('/logout', (c) => {
  clearSession(c);
  return c.redirect('/');
});

app.get('/userPages/review_list', async (c) => {
  const session = getSession(c);
  if (!session) {
    return c.redirect('/login');
  }
  return c.html(layout(ReviewListPage(await getPendingArtifacts()), true));
});

app.get('/userPages/review_files/:id', async (c) => {

  // check to see if session exists
  const session = getSession(c);
  if (!session) {
    return c.redirect('/login');
  }

  // check if id not found
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id < 1) {
    return c.notFound();
  }

  // check if artifact exists
  const artifact = await findPendingArtifact(id);
  if (!artifact) { 
    return c.notFound();
  }

  return c.html(layout(ReviewFilePage(artifact, await getReviewComments(id), session.userId), true));
});




app.post('/userPages/review_files/:id/comments', async (c) => {

  const session = getSession(c);
  if (!session) {
    return c.redirect('/login');
  }

  const id = Number(c.req.param('id'));
  const body = await c.req.parseBody();
  const comment = typeof body.comment === 'string' ? body.comment.trim() : '';
  const rawParentId = typeof body.parent_comment_id === 'string' ? body.parent_comment_id : '';
  const parentCommentId = rawParentId ? Number(rawParentId) : null;

  if (!Number.isInteger(id) || id < 1 || !comment || comment.length > 5000
    || (parentCommentId !== null && (!Number.isInteger(parentCommentId) || parentCommentId < 1))) {
    return c.notFound();
  }

  if (!(await findPendingArtifact(id))){
    return c.notFound();
  }

  if (!await createReviewComment(id, session.userId, comment, parentCommentId)){
    return c.notFound();
  }
  return c.redirect(`/userPages/review_files/${id}`);
});

app.post('/userPages/review_files/comments/:commentId/edit', async (c) => {
  const session = getSession(c);
  if (!session){ 
    return c.redirect('/login');
  }

  const commentId = Number(c.req.param('commentId'));
  const body = await c.req.parseBody();
  const comment = typeof body.comment === 'string' ? body.comment.trim() : '';

  if (!Number.isInteger(commentId) || commentId < 1 || !comment || comment.length > 5000){
    return c.notFound();
  }

  const updated = await updateReviewComment(commentId, session.userId, comment);
  if (!updated){
    return c.notFound();
  }
  return c.redirect(c.req.header('Referer') ?? '/userPages/review_list');
});

app.post('/userPages/review_files/:id', async (c) => {
  const session = getSession(c);
  if (!session){
    return c.redirect('/login');
  }
  const id = Number(c.req.param('id'));
  const body = await c.req.parseBody();
  const decision = body.decision;

  if (!Number.isInteger(id) || id < 1 || (decision !== 'approved' && decision !== 'denied')) {
    return c.notFound();
  }

  const dataset = decision === 'denied' ? await findPendingArtifact(id) : undefined;
  const reviewed = await reviewArtifact(id, session.userId, decision);

  if (decision === 'denied') {
    if (reviewed && dataset?.file_path) {
      await unlink(join(uploadDirectory, basename(dataset.file_path)));
    }
  }
  return c.redirect('/userPages/review_list');
});


// for submitting to db
app.get('/submit', (c) => c.html(layout(SubmitPage())));
app.post('/submit', async (c) => {

  // TODO: prevent IP submission from same IP for at least 30 mins afterward 
  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const now = Date.now();
  const recentAttempts = (submissionAttempts.get(ip) ?? []).filter((time) => now - time < 60 * 60 * 1000);
  if (recentAttempts.length >= 5) {
    return c.html(layout(SubmitPage(submitError('Too many submissions from this address. Please try again later.'))), 429);
  }
  recentAttempts.push(now);
  submissionAttempts.set(ip, recentAttempts);

  // get body -- all of it. hono function
  const body = await c.req.parseBody({ all: true });
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return c.html(layout(SubmitPage(submitSuccess())));
  }


  // get names, ensure they are strings
  const fileName = typeof body.file_name === 'string' ? body.file_name.trim() : '';
  const orgSource = typeof body.org_source === 'string' ? body.org_source.trim() : '';
  const datasetDate = typeof body.dataset_date === 'string' ? body.dataset_date.trim() : '';
  const file = body.artifact_file;

  const tags = (Array.isArray(body.tags) ? body.tags : [body.tags]).filter((tag): tag is string => typeof tag === 'string').map((tag) => tag.trim())
  console.log(body);

  if (!fileName || !orgSource || !(file instanceof File)) {
    return c.html(layout(SubmitPage(submitError('Enter a name, organization/source, and a file.'))), 400);
  }
  else if (fileName.length > 255 || orgSource.length > 255 || datasetDate.length > 100) {
    return c.html(layout(SubmitPage(submitError('One or more fields are longer than allowed.'))), 400);
  }
  else if (datasetDate && datasetDate.toLowerCase() !== 'unknown' && !/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(datasetDate)) {
    return c.html(layout(SubmitPage(submitError('Use a date in YYYY, YYYY-MM, YYYY-MM-DD format, or enter unknown.'))), 400);
  }
  else if (file.size === 0 || file.size > maxUploadBytes) {
    return c.html(layout(SubmitPage(submitError('The file must be between 1 byte and 10 MB.'))), 400);
  }

  const originalName = file.name.replaceAll('\\', '/').split('/').pop() ?? '';
  const extension = originalName.slice(originalName.lastIndexOf('.')).toLowerCase();
  const allowed = allowedExtensions.get(extension);
  if (!allowed || !allowed.mimeTypes.includes(file.type.toLowerCase())) {
    return c.html(layout(SubmitPage(submitError('Only CSV, JPG, and PNG files with a matching file type are accepted.'))), 400);
  }

  // verify inputs
  const content = Buffer.from(await file.arrayBuffer());
  if (extension === '.jpg' || extension === '.jpeg') {
    if (content[0] !== 0xff || content[1] !== 0xd8 || content[content.length - 2] !== 0xff || content[content.length - 1] !== 0xd9) {
      return c.html(layout(SubmitPage(submitError('The JPG file contents do not match its extension.'))), 400);
    }
  } 
  else if (extension === '.png') {
    if (content.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
      return c.html(layout(SubmitPage(submitError('The PNG file contents do not match its extension.'))), 400);
    }
  } 
  else if (content.includes(0)) {
    return c.html(layout(SubmitPage(submitError('The CSV file contains binary data and could not be accepted.'))), 400);
  }

  await mkdir(uploadDirectory, { recursive: true });
  const storedName = `${randomUUID()}${extension}`;
  const storedPath = join(uploadDirectory, storedName);
  try {
    await writeFile(storedPath, content, { flag: 'wx' });
    await createArtifactWithTags({
      artifact_type: allowed.type,
      file_path: `/uploads/${storedName}`,
      file_name: fileName,
      dataset_date: datasetDate || null,
      org_source: orgSource,
    }, tags);
  }

  catch (error) {
    await unlink(storedPath).catch(() => undefined);
    return c.html(layout(SubmitPage(submitError('The submission could not be saved. Please try again.'))), 500);
  }

  return c.html(layout(SubmitPage(submitSuccess())));
});