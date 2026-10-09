import { escapeHtml } from "../utilities/escape_html.js";

type DatasetDetail = {
	id: number;
	artifact_type: string;
	file_path: string;
	file_name: string;
	org_source: string;
	dataset_date: string | null;
	added_at: Date;
	created_at: Date;
	updated_at: Date;
	tags: { id: number; name: string }[];
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
	const isCsv = dataset.artifact_type.toLowerCase() === 'csv'
		|| dataset.file_name.toLowerCase().endsWith('.csv');
	const datasetAction = isCsv
		? `<a class="artifact-link" href="/datasets/${dataset.id}/view">View dataset</a>
			<a class="artifact-link secondary" href="${escapeHtml(dataset.file_path)}">Download CSV</a>`
		: `<a class="artifact-link" href="${escapeHtml(dataset.file_path)}">Open artifact</a>`;

	return `
		<a class="back-link" href="/datasets">← Back to datasets</a>
		<section class="dataset-detail" aria-labelledby="dataset-title">
			<p class="eyebrow">${escapeHtml(dataset.org_source)}</p>
			<h1 id="dataset-title">${escapeHtml(dataset.file_name)}</h1>
			<p class="detail-type">${escapeHtml(dataset.artifact_type)}</p>

			<div class="detail-grid">
				<div>
					<h2>Dataset information</h2>
					<dl class="detail-list">
						<div><dt>Source</dt><dd>${escapeHtml(dataset.org_source)}</dd></div>
						<div><dt>File</dt><dd>${escapeHtml(dataset.file_name)}</dd></div>
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