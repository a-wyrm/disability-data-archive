import { escapeHtml } from "../utilities/escape_html.js";

type DatasetDetail = {
	dataset_id: number;
	org_id: string;
	dataset_date: string | null;
	added_at: Date;
	created_at: Date;
	updated_at: Date;
	tags: { id: number; name: string }[];
	artifacts: Array<{ id: number; artifact_type: string; file_path: string; file_name: string }>;
};


function formatDate(value: Date) {
	return value.toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	});
}

export function DatasetDetailPage(dataset: DatasetDetail) {
	const tags = dataset.tags.length === 0
		? '<span>None</span>'
		: dataset.tags.map((tag) => `<span>${escapeHtml(tag.name)}</span>`).join('');
	const isSingle = dataset.artifacts.length === 1;
	const artifactRows = dataset.artifacts.map((artifact) => {
		const isCsv = artifact.artifact_type.toLowerCase() === 'csv'
			|| artifact.file_name.toLowerCase().endsWith('.csv');
		return `<li><span>${escapeHtml(artifact.file_name)}</span>
			<span class="artifact-actions">
				${isCsv ? `<a class="artifact-link" href="/datasets/${dataset.dataset_id}/artifacts/${artifact.id}/view">View CSV</a>` : ''}
				<a class="artifact-link secondary" href="${escapeHtml(artifact.file_path)}" download>Download</a>
			</span></li>`;
	}).join('');
	const datasetAction = isSingle
		? artifactRows
		: `<a class="artifact-link" href="/datasets/${dataset.dataset_id}/download">Download all as ZIP</a>
			<ul class="artifact-list">${artifactRows}</ul>`;

	return `
		<a class="back-link" href="/datasets">← Back to datasets</a>
		<section class="dataset-detail" aria-labelledby="dataset-title">
			<h1 id="dataset-title">${isSingle ? escapeHtml(dataset.artifacts[0].file_name) : 'Dataset grouping'}</h1>
			<p class="detail-type">${dataset.artifacts.length} artifact${dataset.artifacts.length === 1 ? '' : 's'}</p>

			<div class="detail-grid">
				<div>
					<h2>Dataset information</h2>
					<dl class="detail-list">
						<div><dt>Source</dt><dd>${escapeHtml(dataset.org_id)}</dd></div>
						<div><dt>Files</dt><dd>${dataset.artifacts.length}</dd></div>
						<div><dt>Publication date</dt><dd>${escapeHtml(dataset.dataset_date ?? 'Unknown')}</dd></div>
						<div><dt>Subject</dt><dd class="detail-tags">${tags}</dd></div>
					</dl>
				</div>
				<div>
					<h2>Archive record</h2>
					<dl class="detail-list">
						<div><dt>Added</dt><dd>${formatDate(dataset.added_at)}</dd></div>
						<div><dt>Last updated</dt><dd>${formatDate(dataset.updated_at)}</dd></div>
					</dl>
				</div>
			</div>

			<div class="artifact-actions">${datasetAction}</div>
		</section>
	`;
}