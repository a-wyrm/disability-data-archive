import { escapeHtml } from "../../utilities/escape_html.js";


export function GraphBuilder(csvUrl: string) {
	return `
        <script src="https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js"></script>
		<link rel="stylesheet" href="/static/css/graph_builder.css">
		<section class="graph-builder" aria-labelledby="graph-builder-title" data-graph-csv-url="${escapeHtml(csvUrl)}">
			<div class="graph-builder-heading">
				<div>
					<h2 id="graph-builder-title">Visualize this CSV</h2>
					<p>Choose fields to build a chart from the loaded dataset.</p>
				</div>
			</div>
			<div class="graph-builder-controls">
				<label for="graph-type">Chart type
					<select id="graph-type">
						<option value="bar">Bar chart</option>
					</select>
				</label>
				<label for="graph-x">X value
					<select id="graph-x" disabled><option>Loading fields…</option></select>
				</label>
				<label for="graph-y">Y value
					<select id="graph-y" disabled><option>Loading fields…</option></select>
				</label>
				<button id="graph-build" type="button" disabled>Build chart</button>
			</div>
			<p id="graph-status" class="graph-status" role="status" aria-live="polite">Loading fields…</p>
			<div id="graph-output" class="graph-output" aria-label="Generated chart"></div>
		</section>
        <script src="/static/js/bar_builder.js"></script>
	`;
}