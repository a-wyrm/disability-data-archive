import { DisabilityArtifactsTable } from "../db/db.js";
import { findArtifactWithTags } from "../db/db_functions.js";
import { FilterBySubject } from "../components/filter_by_subject.js";
import { escapeHtml } from "../utilities/escape_html.js";

export type DatasetFilters = {
	tag?: string;
	org_name?: string;
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

	const years = datasets.map((dataset) => dataset.dataset_date);
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
					<p class="eyebrow">${escapeHtml(dataset.org_id)}</p>
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
					<details class="time-period-filter" open>
						<summary>Time</summary>
						<div class="time-period-content">
							<fieldset>
								<legend class="visually-hidden">Publication year</legend>
								<div class="year-fields">
									<label for="from">From<input id="from" name="from" type="number" min="${minYear}" max="${maxYear}" value="${fromValue}" placeholder="YYYY"></label>
									<label for="to">To<input id="to" name="to" type="number" min="${minYear}" max="${maxYear}" value="${toValue}" placeholder="YYYY"></label>
								</div>
							</fieldset>
							<button class="time-period-submit" type="submit">Submit</button>
							<button class="time-period-hide" type="button" aria-label="Hide time period filter">⌃ <span>Hide</span></button>
						</div>
					</details>
					<a class="reset-link" href="/datasets">Reset filters</a>
				</form>
				<script>
					(() => {
						const timePeriod = document.querySelector('.time-period-filter');
						const hideButton = timePeriod?.querySelector('.time-period-hide');
						const summary = timePeriod?.querySelector('summary');
						if (!(timePeriod instanceof HTMLDetailsElement)
							|| !(hideButton instanceof HTMLButtonElement)
							|| !(summary instanceof HTMLElement)) {
							return;
						}
						hideButton.addEventListener('click', () => {
							timePeriod.open = false;
							summary.focus();
						});
					})();
				</script>
			</aside>
			<section class="dataset-grid" aria-live="polite" aria-label="Dataset collection">
				${tiles}
			</section>
		</div>
	`;
}
