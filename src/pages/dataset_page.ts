import { DisabilityArtifactsTable } from "../db/db.js";
import { findArtifactWithTags } from "../db/db_functions.js";
import { FilterBySubject } from "../components/filter_by_subject.js";
import { TimelineSlider } from "../components/timeline_slider.js";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character);
}

export type DatasetFilters = {
	tag?: string;
	from?: number;
	to?: number;
};


export async function DatasetPage(datasets: DisabilityArtifactsTable[], filters: DatasetFilters = {}) {

	const ids = datasets.map(dataset => dataset.id);
	const artifactsWithTags = await Promise.all(ids.map((id) => findArtifactWithTags(Number(id))));
	const tags = [
		...new Set(
			artifactsWithTags
			.filter((artifact): artifact is NonNullable<typeof artifact> => artifact !== null)
			.flatMap(artifact => artifact.tags.map(tag => tag.name))
		),
	].sort();

	const years = datasets.map((dataset) => dataset.created_at);
	const parsedYears = years.map(value => Number(String(value).slice(0, 4))).filter(Number.isFinite);
	const minYear = parsedYears.length > 0 ? Math.min(...parsedYears) : new Date().getFullYear();
	const maxYear = parsedYears.length > 0 ? Math.max(...parsedYears) : minYear;
	
	const tagValue = filters.tag ?? '';
	const fromValue = filters.from?.toString() ?? '';
	const toValue = filters.to?.toString() ?? '';

	const tiles = datasets.length === 0
		? '<p class="empty">No datasets match these filters.</p>'
		: datasets.map((dataset, index) => `
			<a class="dataset-tile" data-subjects="${escapeHtml((artifactsWithTags[index]?.tags ?? []).map(tag => tag.name).join('|'))}" style="--tile-index: ${index}" href="/datasets/${dataset.id}" aria-label="View ${escapeHtml(dataset.file_name)}">
				<div class="tile-topline">
					<span class="tile-number">${String(index + 1).padStart(2, '0')}</span>
					<span>${escapeHtml(dataset.dataset_date ?? 'Date unknown')}</span>
				</div>
				<div>
					<p class="eyebrow">${escapeHtml(dataset.org_source)}</p>
					<h2>${escapeHtml(dataset.file_name)}</h2>
					<p class="tile-description">${escapeHtml(dataset.artifact_type)}</p>
				</div>
				<footer>
					<span>${(artifactsWithTags[index]?.tags ?? []).map(tag => escapeHtml(tag.name)).join(' · ')}</span>
					<span aria-hidden="true">↗</span>
				</footer>
			</a>
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
				<form method="get" action="/datasets">
					${FilterBySubject({ subjects: tags, selectedSubject: tagValue })}
					<fieldset>
						<legend>Publication year</legend>
						${TimelineSlider({ minYear, maxYear, from: filters.from, to: filters.to })}
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
