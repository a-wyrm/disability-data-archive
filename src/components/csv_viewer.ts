import { escapeHtml } from "../utilities/escape_html.js";

type CsvDataset = {
	file_name: string;
	file_path: string;
};

export function CsvViewer(dataset: CsvDataset) {
	return `
		<section class="csv-viewer" aria-labelledby="csv-viewer-title" data-csv-url="${escapeHtml(dataset.file_path)}">
			<div class="csv-viewer-heading">
				<div>
					<h1 id="csv-viewer-title">${escapeHtml(dataset.file_name)}</h1>
				</div>
				<a class="secondary" href="/datasets">Back to datasets</a>
			</div>
			<div class="csv-data-panel">
				<div class="csv-toolbar">
					<div class="csv-toolbar-title">
						<strong>Data table</strong>
					</div>
					<label class="csv-search-label" for="csv-search">Filter rows</label>
					<input id="csv-search" type="search" placeholder="Search rows…" disabled>
					<p id="csv-status" class="csv-status" role="status" aria-live="polite">Loading dataset…</p>
				</div>
				<div id="csv-table-container" class="csv-table-container" tabindex="0" aria-label="CSV data table">
					<p>Loading dataset…</p>
				</div>
			</div>
		</section>
		<script src="/static/csv_viewer.js" defer></script>
		<link rel="stylesheet" href="/static/css/csv_viewer.css">
	`;
}