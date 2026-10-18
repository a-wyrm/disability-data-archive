import { escapeHtml } from '../../utilities/escape_html.js';
import type { DisabilityArtifact } from '../../db/db.js';

export function ReviewListPage(artifacts: DisabilityArtifact[]) {
	const rows = artifacts.length === 0 ? '<p class="empty">There are no pending artifacts.</p>' : artifacts.map((artifact) => `
		<article class="record-row"><div><h2>${escapeHtml(artifact.file_name)}</h2><p>${escapeHtml(artifact.org_id)} · ${escapeHtml(artifact.artifact_type)}</p></div>
		<a href="/userPages/review_files/${artifact.id}">Review artifact</a></article>`).join('');
	return `
    <section class="page-intro">
        <div>
            <h1>Pending reviews</h1>
            <p>Approve artifacts for the public archive or deny them.</p>
        </div>
        <strong class="dataset-count">${artifacts.length.toString().padStart(2, '0')} pending</strong>
    </section>
    <section class="record-list">
        ${rows}
    </section>`;
}
