import { escapeHtml } from '../../utilities/escape_html.js';
import type { DisabilityArtifact } from '../../db/db.js';

export function ReviewFilePage(artifact: DisabilityArtifact, message = '') {
	return `
    <section class="dataset-detail">
        <a class="back-link" href="/userPages/review_list">Back to reviews</a>
        <p class="eyebrow">${escapeHtml(artifact.org_source)}</p>
        <h1>${escapeHtml(artifact.file_name)}</h1>
        <p>${escapeHtml(artifact.artifact_type)} - ${escapeHtml(artifact.dataset_date ?? 'Date unknown')}</p>
        ${message}
		<div class="artifact-actions">
            <a class="artifact-link" href="${escapeHtml(artifact.file_path)}">Open submitted artifact</a>
        </div>
		<form method="post" action="/userPages/review_files/${artifact.id}">
            <button name="decision" value="approved" type="submit">Approve</button>
            <button name="decision" value="denied" type="submit" class="secondary">Deny</button>
        </form>
    </section>`;
}
