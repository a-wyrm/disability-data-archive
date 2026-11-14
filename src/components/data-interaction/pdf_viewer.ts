import { escapeHtml } from "../../utilities/escape_html.js";

type PdfDataset = {
	file_name: string;
	file_path: string;
};

export function PdfViewer(dataset: PdfDataset, stylesheetVersion?: string) {
	return `
		<section class="pdf-viewer" aria-labelledby="pdf-viewer-title">
			<div class="pdf-viewer-heading">
				<h1 id="pdf-viewer-title">${escapeHtml(dataset.file_name)}</h1>
				<a class="secondary" href="/datasets">Back to datasets</a>
			</div>
			<div class="pdf-frame-container">
				<iframe
					class="pdf-frame"
					src="${escapeHtml(dataset.file_path)}"
					title="PDF preview of ${escapeHtml(dataset.file_name)}">
				</iframe>
			</div>
			<p class="pdf-fallback">
				If the PDF does not load, <a href="${escapeHtml(dataset.file_path)}">open it directly</a>.
			</p>
		</section>
		<link rel="stylesheet" href="/static/css/pdf_viewer.css${stylesheetVersion ? `?v=${stylesheetVersion}` : ""}">
	`;
}