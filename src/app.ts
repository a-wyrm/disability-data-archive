import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { statSync } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { basename, join, resolve } from 'node:path';

// components
import { Header } from './components/header.js';
import { createArtifactWithTags, createReviewComment, createUser, findArtifactWithTags, findPendingArtifact, findUserByLogin, getAllArtifacts, getHomeStats, getOrganizations, getPendingArtifactTags, getPendingArtifacts, getReviewComments, getUserById, resolveOrganization, reviewArtifact, searchArtifacts, updateReviewComment } from './db/db_functions.js';
import { escapeHtml } from "./utilities/escape_html.js";
import { clearSession, getSession, hashPassword, setSessionCookie, verifyPassword } from './utilities/auth.js';

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
import { HomePage } from './pages/home.js';


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
            <p>${escapeHtml(record.org_id)} · ${escapeHtml(record.artifact_type)}</p>
          </div>
          <a href="${escapeHtml(artifactUrl)}">Open artifact</a>
        </article>
      `;
    }).join('');
}



// HTMX stuff
type Variables = { isHtmx: boolean };
export const app = new Hono<{ Variables: Variables }>();
app.use('*', async (c, next) => {
  c.set('isHtmx', c.req.header('HX-Request') === 'true');
  await next();
});

// CSS sheets need to be re-rendered on pages when they are updated
// this code block syncs the most recent version of the css files to display the most recent version
const devStart = Date.now().toString();
const stylesheetPaths = ['./static/css/styles.css', './static/css/csv_viewer.css', './static/css/header_styles.css', './static/css/user_pages.css'];
export function getDevRevision() {
  const stylesheetRevisions = stylesheetPaths
    .map((stylesheetPath) => statSync(stylesheetPath).mtimeMs)
    .join('-');
  return `${devStart}-${stylesheetRevisions}`;
}


function checkAuth(result: string | undefined) {
  if (result != null) {
    return true;
  }

  return false;
}

// static files
app.use('/static/*', serveStatic({ root: './' }));
app.use('/uploads/*', serveStatic({ root: './' }));
app.get('/__dev/revision', (c) => c.text(getDevRevision()));

// The function that actually lays out the html content
// includes the skip main content field
function layout(content: string, isAuthenticated: boolean) {
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
    </head>
    <body>
        <a class="skip-link" href="#main-content">Skip to main content</a>
        ${Header(isAuthenticated)}
        <main id="main-content" class="container" tabindex="-1">
        ${content}
        </main>
    </body>
    </html>
    <script>
      (() => {
        const revision = '${getDevRevision()}';
        setInterval(async () => {
          try {
            const response = await fetch('/__dev/revision', { cache: 'no-store' });
            if ((await response.text()) !== revision) window.location.reload();
          } 
          catch {
            // The server may be restarting after a source change.
          }
        }, 500);
      })();
    </script>`;
}

app.get('/', async (c) => {
  const session = await getSession(c);
  const res = checkAuth(session?.token);

  return c.html(layout(HomePage(await getHomeStats()), res));
});

// search
app.get("/search", async (c) => {

  // search context can change especially for the db filtering
	const searchValue = c.req.query("q") ?? "";

  const session = await getSession(c);
  const res = checkAuth(session?.token);

  const artifacts = await searchArtifacts(searchValue);
  const results = await Promise.all(artifacts.map(async (artifact) => {
    const artifactWithTags = await findArtifactWithTags(Number(artifact.id));
    return {
      ...artifact,
      tags: artifactWithTags?.tags ?? [],
    };
  }));

  return c.html(layout(SearchPage(results, searchValue), res));
});


app.get('/datasets', async (c) => {
  const artifacts = await getAllArtifacts();
  const taggedArtifacts = await Promise.all(artifacts.map((artifact) => findArtifactWithTags(Number(artifact.id))));

  // map artifacts to their tags
  const tagsByArtifactId = new Map(
    taggedArtifacts.filter((artifact): artifact is NonNullable<typeof artifact> => artifact !== null).map((artifact) => [artifact.id, artifact.tags.map((tag) => tag.name)])
  );

  const rawFrom = Number(c.req.query('from'));
  const rawTo = Number(c.req.query('to'));
  const rawPage = Number(c.req.query('page'));
  const rawRecent = c.req.query('recent');
  const organizations = await getOrganizations();

  // The filter value is the same acronym stored in disability_artifacts.org_id.
  const normalizeOrganization = (value: string) => value.trim().toLocaleLowerCase();
  const selectedOrganizationId = c.req.query('org_name')?.trim() || undefined;


  //search tags
  const selectedTags = (c.req.query('tag') ?? '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

  const filters: DatasetFilters = {
    tag: selectedTags[0],
    org_name: selectedOrganizationId,
    from: Number.isInteger(rawFrom) ? rawFrom : undefined,
    to: Number.isInteger(rawTo) ? rawTo : undefined,
    page: Number.isInteger(rawPage) && rawPage > 0 ? rawPage : undefined,
    recent: rawRecent === 'week' || rawRecent === 'month' || rawRecent === 'quarter' || rawRecent === 'year'
      ? rawRecent
      : undefined,
  };

  // dict for converting things to milliseconds
  const recentMilliseconds = {
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    quarter: 90 * 24 * 60 * 60 * 1000,
    year: 365 * 24 * 60 * 60 * 1000,
  };

  const filteredRecords = artifacts.filter((record) => {

    // get matching tag
    const recordTags = tagsByArtifactId.get(record.id) ?? [];
    const matchingTag = selectedTags.length === 0 || selectedTags.some((tag) => recordTags.includes(tag));

    // Match the selected agency directly against the artifact's org_id.
    // if there isn't a matching agency (!selectedOrganization) just skip, otherwise check if the dataset names are the same 
    const matchingAgency = !selectedOrganizationId || normalizeOrganization(record.org_id) === normalizeOrganization(selectedOrganizationId);
    const publishedYear = Number.parseInt(record.dataset_date ?? '', 10) || 0;
    const afterStart = filters.from === undefined || publishedYear >= filters.from;
    const beforeEnd = filters.to === undefined || publishedYear <= filters.to;
    const matchingRecent = !filters.recent || Date.now() - new Date(record.updated_at).getTime() <= recentMilliseconds[filters.recent];
    return matchingTag && matchingAgency && afterStart && beforeEnd && matchingRecent;
  });

  // send the filtered records, filters, and options to the dataset page
  // filters are the start, end, recency, agency, and year they were published
  // specifically, the artifacts dataset and organization db
  // because id is generated by the db we pass unknown to parameter 1
  const session = await getSession(c);
  const res = checkAuth(session?.token);
  return c.html(layout(await DatasetPage(
    filteredRecords as unknown as Parameters<typeof DatasetPage>[0],
    filters,
    { allDatasets: artifacts as unknown as Parameters<typeof DatasetPage>[0], organizations},
  ), res));
});

// show dataset with specific id
app.get('/datasets/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id < 1) {
    return c.notFound();
  }

  const dataset = await findArtifactWithTags(id);
  if (!dataset) {
    return c.notFound();
  }

  const session = await getSession(c);
  const res = checkAuth(session?.token);

  return c.html(layout(DatasetDetailPage(dataset), res));
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

  const session = await getSession(c);
  const res = checkAuth(session?.token);
  return c.html(layout(CsvViewer(dataset, getDevRevision()), res));
});

app.get('/records', async (c) => {
  const query = c.req.query('q')?.trim() ?? '';
  const artifacts = await getAllArtifacts();
  const records = query ? artifacts.filter((artifact) => [
      artifact.file_name,
      artifact.file_path,
      artifact.org_id,
      artifact.artifact_type,
      artifact.dataset_date,
    ].some((value) => value?.toLowerCase().includes(query.toLowerCase())))
    : artifacts;

  return c.html(recordRows(records));
});

// about page
app.get('/about', async (c) => {
  const session = await getSession(c);
  const res = checkAuth(session?.token); 
  return c.html(layout(AboutPage(), res));
});


// signup page functionality
app.get('/signup', async (c) => c.html(layout(CreateAccountPage(), Boolean(await getSession(c)))));
app.post('/signup', async (c) => {

  const body = await c.req.parseBody();
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!/^[a-zA-Z0-9_]{3,100}$/.test(username) || !/^\S+@\S+\.\S+$/.test(email) || password.length < 12) {
    return c.html(layout(CreateAccountPage(accountError('Use a valid username, email, and a password of at least 12 characters.')), false), 400);
  }
  
  try {
    const user = await createUser(username, email, await hashPassword(password));
    await setSessionCookie(c, user.user_id);
    return c.redirect('/');
  } 
  catch {
    return c.html(layout(CreateAccountPage(accountError('That username or email is already in use.')), false), 409);
  }
});

app.get('/login', async (c) => c.html(layout(LoginPage(), Boolean(await getSession(c)))));
app.post('/login', async (c) => {
  const body = await c.req.parseBody();
  const login = typeof body.login === 'string' ? body.login.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const user = await findUserByLogin(login);
  if (!user || user.is_locked || !(await verifyPassword(password, user.password_hash))) {
    return c.html(layout(LoginPage(loginError('The login details are not valid.')), false), 401);
  }

  // this sets the cookie
  await setSessionCookie(c, user.user_id);
  return c.redirect('/');
});

app.get('/logout', async (c) => {
  await clearSession(c);
  return c.redirect('/');
});

app.get('/userPages/review_list', async (c) => {
  const session = await getSession(c);
  if (!session) {
    return c.redirect('/login');
  }
  return c.html(layout(ReviewListPage(await getPendingArtifacts()), true));
});

app.get('/userPages/review_files/:id', async (c) => {

  // check to see if session exists
  const session = await getSession(c);
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

  const [user, organizations, tags] = await Promise.all([
    getUserById(session.userId),
    getOrganizations(),
    getPendingArtifactTags(id),
  ]);
  return c.html(layout(ReviewFilePage(
    artifact,
    await getReviewComments(id),
    session.userId,
    user?.reputation ?? 0,
    organizations,
    tags.map((tag) => tag.name),
  ), true));
});




app.post('/userPages/review_files/:id/comments', async (c) => {

  const session = await getSession(c);
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
  const session = await getSession(c);
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
  const session = await getSession(c);
  if (!session){
    return c.redirect('/login');
  }
  const id = Number(c.req.param('id'));
  const body = await c.req.parseBody();
  const decision = body.decision;

  if (!Number.isInteger(id) || id < 1 || (decision !== 'approved' && decision !== 'denied')) {
    return c.notFound();
  }

  // users need at least 50 rep to click the approve or deny button
  const user = await getUserById(session.userId);
  if (!user || user.is_locked || user.reputation <= 49) {
    return c.text('You do not have enough reputation to review datasets.', 403);
  }

  let edits;
  if (decision === 'approved') {
    const description = typeof body.dataset_description === 'string' ? body.dataset_description.trim() : '';
    const createdAtValue = typeof body.created_at === 'string' ? body.created_at : '';
    const createdAt = new Date(createdAtValue);
    const datasetKind = typeof body.dataset_kind === 'string' ? body.dataset_kind : '';
    const datasetStatus = typeof body.dataset_status === 'string' ? body.dataset_status : '';
    const orgId = typeof body.org_id === 'string' ? body.org_id : '';
    const tags = typeof body.tags === 'string' ? [...new Set(body.tags.split(',').map((tag) => tag.trim()).filter(Boolean))] : [];
    const organizations = await getOrganizations();
    const validOrg = organizations.some((organization) => organization.acronym === orgId);

    if (!createdAtValue || Number.isNaN(createdAt.getTime())|| !['public', 'private'].includes(datasetKind) || !['available', 'study', 'discontinued', 'removed', 'unknown'].includes(datasetStatus) || !validOrg || tags.some((tag) => tag.length > 25) || tags.length > 80 || description.length > 12000) {
      return c.text('The review edits are invalid.', 400);
    }

    edits = {
      dataset_description: description || null,
      created_at: createdAt,
      dataset_kind: datasetKind,
      dataset_status: datasetStatus,
      org_id: orgId,
      tags,
    };
  }

  const dataset = decision === 'denied' ? await findPendingArtifact(id) : undefined;
  const reviewed = await reviewArtifact(id, session.userId, decision, edits);

  if (decision === 'denied') {
    if (reviewed && dataset?.file_path) {
      await unlink(join(uploadDirectory, basename(dataset.file_path)));
    }
  }
  return c.redirect('/userPages/review_list');
});


// for submitting to db
app.get('/submit', async (c) => {

  const session = await getSession(c);
  const res = checkAuth(session?.token);

  return c.html(layout(SubmitPage(await getOrganizations()), res));
});

app.post('/submit', async (c) => {

  // TODO: prevent IP submission from same IP for at least 30 mins afterward 
  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const now = Date.now();
  const recentAttempts = (submissionAttempts.get(ip) ?? []).filter((time) => now - time < 60 * 60 * 1000);
  if (recentAttempts.length >= 5) {
    const session = await getSession(c);
    const res = checkAuth(session?.token);

    return c.html(layout(SubmitPage(await getOrganizations(), submitError('Too many submissions from this address. Please try again later.')), res), 429);
  }
  recentAttempts.push(now);
  submissionAttempts.set(ip, recentAttempts);

  // get body -- all of it. hono function
  const body = await c.req.parseBody({ all: true });
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    const session = await getSession(c);
    const res = checkAuth(session?.token);
    return c.html(layout(SubmitPage(await getOrganizations(), submitSuccess()), res));
  }


  // get names, ensure they are strings
  const fileName = typeof body.file_name === 'string' ? body.file_name.trim() : '';
  const orgSelection = typeof body.org_id === 'string' ? body.org_id.trim() : '';
  const otherOrgFull = typeof body.other_org_full === 'string' ? body.other_org_full.trim() : '';
  const orgAcronym = typeof body.other_org_acronym === 'string' ? body.other_org_acronym.trim() : '';
  const datasetDate = typeof body.dataset_date === 'string' ? body.dataset_date.trim() : '';
  const datasetDescription = typeof body.dataset_description === 'string' ? body.dataset_description.trim() : '';
  const datasetKind = typeof body.dataset_kind === 'string' ? body.dataset_kind.trim() : '';
  const datasetStatus = typeof body.dataset_status === 'string' ? body.dataset_status.trim() : '';
  const file = body.artifact_file;

  const tags = (Array.isArray(body.tags) ? body.tags : [body.tags]).filter((tag): tag is string => typeof tag === 'string').map((tag) => tag.trim())
  const session = await getSession(c);
  const res = checkAuth(session?.token);

  if (!fileName || !orgSelection || !datasetKind || !datasetStatus || !(file instanceof File)) {
    return c.html(layout(SubmitPage(await getOrganizations(), submitError('Enter a name, organization/source, dataset access, dataset status, and a file.')), res), 400);
  }
  else if (fileName.length > 255 || orgSelection.length > 50 || otherOrgFull.length > 300 || orgAcronym.length > 50 || datasetDate.length > 100 || datasetDescription.length > 12000 || datasetKind.length > 300 || datasetStatus.length > 20) {
    return c.html(layout(SubmitPage(await getOrganizations(), submitError('One or more fields are longer than allowed.')), res), 400);
  }
  else if (!['public', 'private'].includes(datasetKind)) {
    return c.html(layout(SubmitPage(await getOrganizations(), submitError('Select whether the dataset is public or private.')), res), 400);
  }
  else if (!['discontinued', 'removed', 'available', 'study', 'unknown'].includes(datasetStatus)) {
    return c.html(layout(SubmitPage(await getOrganizations(), submitError('Select a valid dataset status.')), res), 400);
  }
  else if (orgSelection === 'other' && !otherOrgFull) {
    return c.html(layout(SubmitPage(await getOrganizations(), submitError('Enter the full name of the organization.')), res), 400);
  }
  else if (orgSelection === 'other' && !orgAcronym) {
    return c.html(layout(SubmitPage(await getOrganizations(), submitError('Enter an acronym for the organization.')), res), 400);
  }
  else if (datasetDate && datasetDate.toLowerCase() !== 'unknown' && !/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(datasetDate)) {
    return c.html(layout(SubmitPage(await getOrganizations(), submitError('Use a date in YYYY, YYYY-MM, YYYY-MM-DD format, or enter unknown.')), res), 400);
  }
  else if (file.size === 0 || file.size > maxUploadBytes) {
    return c.html(layout(SubmitPage(await getOrganizations(), submitError('The file must be between 1 byte and 10 MB.')), res), 400);
  }

  const originalName = file.name.replaceAll('\\', '/').split('/').pop() ?? '';
  const extension = originalName.slice(originalName.lastIndexOf('.')).toLowerCase();
  const allowed = allowedExtensions.get(extension);
  if (!allowed || !allowed.mimeTypes.includes(file.type.toLowerCase())) {
    return c.html(layout(SubmitPage(await getOrganizations(), submitError('Only CSV, JPG, and PNG files with a matching file type are accepted.')), res), 400);
  }

  // verify inputs
  const content = Buffer.from(await file.arrayBuffer());
  if (extension === '.jpg' || extension === '.jpeg') {
    if (content[0] !== 0xff || content[1] !== 0xd8 || content[content.length - 2] !== 0xff || content[content.length - 1] !== 0xd9) {
      return c.html(layout(SubmitPage(await getOrganizations(), submitError('The JPG file contents do not match its extension.')), res), 400);
    }
  } 
  else if (extension === '.png') {
    if (content.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
      return c.html(layout(SubmitPage(await getOrganizations(), submitError('The PNG file contents do not match its extension.')), res), 400);
    }
  } 
  else if (content.includes(0)) {
    return c.html(layout(SubmitPage(await getOrganizations(), submitError('The CSV file contains binary data and could not be accepted.')), res), 400);
  }

  // add to organization database 
  const resolvedOrg = await resolveOrganization(
    orgSelection,
    orgSelection === 'other' ? otherOrgFull : null,
    orgAcronym || null,
  );
  if (!resolvedOrg) {
    return c.html(layout(SubmitPage(await getOrganizations(), submitError('Select a valid organization.')), res), 400);
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
      reviewed: false,
      dataset_date: datasetDate || null,
      dataset_description: datasetDescription || null,
      dataset_kind: datasetKind,
      dataset_status: datasetStatus,
      org_id: resolvedOrg,
    }, tags);
  }

  catch (error) {
    await unlink(storedPath).catch(() => undefined);
    return c.html(layout(SubmitPage(await getOrganizations(), submitError('The submission could not be saved. Please try again.')), res), 500);
  }

  return c.html(layout(SubmitPage(await getOrganizations(), submitSuccess()), res));
});