type Dataset = {
	title: string;
	description: string;
	source: string;
	published_year: number;
};

export type DatasetFilters = {
	tag?: string;
	from?: number;
	to?: number;
};

function escapeHtml(value: string) {
	return value.replace(/[&<>"']/g, (character) => ({
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#39;',
	})[character] ?? character);
}

export function datasetTags(dataset: Dataset) {
	const text = `${dataset.title} ${dataset.description}`.toLowerCase();
	const tags = new Set<string>();

	if (text.includes('survey')) tags.add('Surveys');
	if (text.includes('access') || text.includes('barrier')) tags.add('Accessibility');
	if (text.includes('employment')) tags.add('Employment');
	if (text.includes('education') || text.includes('school') || text.includes('learning')) tags.add('Education');
	if (text.includes('longitudinal')) tags.add('Longitudinal');
	if (text.includes('public service')) tags.add('Public services');

	return [...tags];
}

export function DatasetPage(datasets: Dataset[], filters: DatasetFilters = {}) {
	const tags = [...new Set(datasets.flatMap(datasetTags))].sort();
	const years = datasets.map((dataset) => dataset.published_year);
	const minYear = Math.min(...years);
	const maxYear = Math.max(...years);
	const tagValue = filters.tag ?? '';
	const fromValue = filters.from?.toString() ?? '';
	const toValue = filters.to?.toString() ?? '';

	const tiles = datasets.length === 0
		? '<p class="empty">No datasets match these filters.</p>'
		: datasets.map((dataset, index) => `
			<article class="dataset-tile" style="--tile-index: ${index}" aria-label="${escapeHtml(dataset.title)}">
				<div class="tile-topline">
					<span class="tile-number">${String(index + 1).padStart(2, '0')}</span>
					<span>${dataset.published_year}</span>
				</div>
				<div>
					<p class="eyebrow">${escapeHtml(dataset.source)}</p>
					<h2>${escapeHtml(dataset.title)}</h2>
					<p class="tile-description">${escapeHtml(dataset.description)}</p>
				</div>
				<footer>
					<span>${datasetTags(dataset).map(escapeHtml).join(' · ')}</span>
					<span aria-hidden="true">↗</span>
				</footer>
			</article>
		`).join('');

	return `
		<section class="page-intro" aria-labelledby="datasets-title">
        <link rel="stylesheet" href="/static/styles.css">
			<div>
				<h1>Available datasets</h1>
				<p>Browse by tag, source, and publication year.</p>
			</div>
			<strong class="dataset-count">${datasets.length.toString().padStart(2, '0')} datasets</strong>
		</section>
        
		<div class="dataset-layout">
			<aside class="filter-panel" aria-labelledby="filter-title">
				<div class="filter-heading">
					<h2 id="filter-title">Filters</h2>
				</div>
				<form method="get" action="/">
					<label for="tag">Subject</label>
					<select id="tag" name="tag">
						<option value="">All subjects</option>
						${tags.map((tag) => `<option value="${escapeHtml(tag)}"${tag === tagValue ? ' selected' : ''}>${escapeHtml(tag)}</option>`).join('')}
					</select>
					<fieldset>
						<legend>Publication year</legend>
						<div class="year-fields">
							<label for="from">From<input id="from" name="from" type="number" min="${minYear}" max="${maxYear}" value="${fromValue}" placeholder="${minYear}"></label>
							<label for="to">To<input id="to" name="to" type="number" min="${minYear}" max="${maxYear}" value="${toValue}" placeholder="${maxYear}"></label>
						</div>
					</fieldset>
					<button type="submit">Apply filters</button>
					<a class="reset-link" href="/">Reset filters</a>
				</form>
			</aside>
			<section class="dataset-grid" aria-live="polite" aria-label="Dataset collection">
				${tiles}
			</section>
		</div>
	`;
}
