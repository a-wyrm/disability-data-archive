import { DisabilityArtifactsTable } from "../db/db.js";
import type { Organization } from "../db/db.js";
import { findArtifactWithTags } from "../db/db_functions.js";
import { FilterBySubject } from "../components/filter_by_subject.js";
import { escapeHtml } from "../utilities/escape_html.js";
import { getDevRevision } from "../app.js";

// filter for search
export type DatasetFilters = {
	tag?: string;
	org_name?: string;
	from?: number;
	to?: number;
	recent?: 'week' | 'month' | 'quarter' | 'year';
	page?: number; // number id
};

export type DatasetFilterOptions = {
	allDatasets: DisabilityArtifactsTable[];
	organizations: Organization[];
};

export async function DatasetPage(
	datasets: DisabilityArtifactsTable[],
	filters: DatasetFilters = {},
	options: DatasetFilterOptions = { allDatasets: datasets, organizations: [] }) 
{

	// make pages paginated
	const perPage = 8;
	// if odd get the higher number
	const pageCount = Math.ceil(datasets.length / perPage);
	const curPage = Math.min(Math.max(1, filters.page ?? 1), Math.max(1, pageCount));
	
	// which page do we start on? page 3: (3-1) * 4 = 8 means we start at 8 and go till 12
	const pageStart = (curPage - 1) * perPage;
	const paginatedDatasets = datasets.slice(pageStart, pageStart + perPage);

	const paginationHtml = pageCount > 1 ? `
	<nav class="pagination" aria-label="Dataset pagination">
		<button class="pagination-prev" data-page="${curPage - 1}" ${curPage === 1 ? 'disabled' : ''}>← Back</button>
		<div class="pagination-pages">
			${Array.from({ length: pageCount }, (_, i) => {
				const pageNum = i + 1;
				const isActive = pageNum === curPage;
				return `<button class="pagination-page ${isActive ? 'active' : ''}" data-page="${pageNum}" ${isActive ? 'aria-current="page"' : ''}>${pageNum}</button>`;
			}).join('')}
		</div>
		<button class="pagination-next" data-page="${curPage + 1}" ${curPage === pageCount ? 'disabled' : ''}>Next →</button>
	</nav>
` : '';

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

	// get the organization via their acronym from the SQL dataset
	// this uses the org_acronym table
	const organizationsByAcronym = new Map(options.organizations.map((organization) => [organization.acronym, organization]));

	// get agency counts
	const agencyCounts = new Map<string, number>();
	for (const dataset of options.allDatasets) {
		agencyCounts.set(dataset.org_id, (agencyCounts.get(dataset.org_id) ?? 0) + 1);
	}

	const agencies = [...agencyCounts.entries()]
	.map(([acronym, count]) => ({
		acronym,
		name: organizationsByAcronym.get(acronym)?.org_full ?? acronym,
		count,
	})).sort((left, right) => left.name.localeCompare(right.name));

	const now = Date.now();
	const releaseWindows = [
		{ value: 'week', label: 'New/updated this week', milliseconds: 7 * 24 * 60 * 60 * 1000 },
		{ value: 'month', label: 'New/updated this month', milliseconds: 30 * 24 * 60 * 60 * 1000 },
		{ value: 'quarter', label: 'New/updated this quarter', milliseconds: 90 * 24 * 60 * 60 * 1000 },
		{ value: 'year', label: 'New/updated this year', milliseconds: 365 * 24 * 60 * 60 * 1000 },
	] as const;

	const agencyValue = filters.org_name ?? '';
	const agencyOptions = agencies.map(({ acronym, name, count }) => `
							<label><input type="checkbox" name="org_name" value="${escapeHtml(acronym)}"${acronym === agencyValue ? ' checked' : ''}> ${escapeHtml(name)} (${count.toLocaleString()})</label>
						`).join('');


	const releaseOptions = releaseWindows.map(({ value, label, milliseconds }) => {
		const count = options.allDatasets.filter((dataset) => now - new Date(dataset.updated_at as unknown as Date).getTime() <= milliseconds).length;
		return `<label><input type="checkbox" name="recent" value="${value}"${filters.recent === value ? ' checked' : ''}> ${label} (${count.toLocaleString()})</label>`;
	}).join('');

	const tiles = paginatedDatasets.length === 0 ? '<p class="empty">No datasets match these filters.</p>': paginatedDatasets.map((dataset, index) => `
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
			</a>`).join('');

	return `
		<link rel="stylesheet" href="/static/css/dataset_page.css?v=${getDevRevision()}">
		<section class="page-intro" aria-labelledby="datasets-title">
			<div>
				<h1>Available datasets</h1>
				<p>Browse by tag, source, and publication year.</p>
			</div>
			<strong class="dataset-count">${datasets.length.toString().padStart(2, '0')} datasets</strong>
		</section>
        
		<div class="dataset-layout">
			<aside class="filter-panel" aria-labelledby="filter-title">
				<form id="dataset-filters" method="get" action="/datasets">
					<details class="time-period-filter" open>
						<summary>Government Agency</summary>
						<div class="time-period-content">
							<fieldset>
								<legend class="visually-hidden">Government agency</legend>
								${agencyOptions}
							</fieldset>
							<button class="time-period-submit" type="submit">Submit</button>
						</div>
					</details>
					<details class="time-period-filter" open>
						<summary>Recent Releases</summary>
						<div class="time-period-content">
							<fieldset>
								<legend class="visually-hidden">Recent releases</legend>
								${releaseOptions}
							</fieldset>
							<button class="time-period-submit" type="submit">Submit</button>
						</div>
					</details>
					<details class="time-period-filter" open>
						<summary>Time</summary>
						<div class="time-period-content">
							<fieldset>
								<legend class="visually-hidden">Publication year</legend>
								<div class="year-fields">
									<label for="from">From<input id="from" name="from" type="number" min="${minYear}" max="${maxYear}" value="${fromValue}" placeholder="YYYY"></label>
									<label for="to">To
									<div><input id="to" name="to" type="number" min="${minYear}" max="${maxYear}" value="${toValue}" placeholder="YYYY"></label></div>
								</div>
							</fieldset>
							<button class="time-period-submit" type="submit">Submit</button>
						</div>
					</details>
				</form>
				<div class="filter-heading">
					<h2 id="filter-title">Tags</h2>
					${FilterBySubject({ subjects: tags, selectedSubject: tagValue })}
				</div>
				<a class="reset-link" href="/datasets">Reset filters</a>
			</aside>
			<section class="dataset-grid" aria-live="polite" aria-label="Dataset collection">
				${tiles}
				${paginationHtml}
			</section>
			<script>
					(() => {
						const form = document.getElementById('dataset-filters');
						if (form instanceof HTMLFormElement) {
							form.addEventListener('submit', (event) => {
								event.preventDefault();
								const url = new URL(form.action, window.location.href);
								for (const [name, value] of new FormData(form)) {
									if (typeof value === 'string' && value.trim()) {
										url.searchParams.set(name, value);
									}
								}
								url.searchParams.set('page', '1');
								window.location.assign(url);
							});
						}

						document.querySelectorAll('.pagination-page, .pagination-prev, .pagination-next').forEach((button) => {
							if (button instanceof HTMLButtonElement) {
								button.addEventListener('click', () => {
									const url = new URL(window.location);
									url.searchParams.set('page', button.dataset.page || '1');
									window.location.assign(url);
								});
							}
						});


						document.querySelectorAll('.time-period-filter').forEach((timePeriod) => {
							const summary = timePeriod.querySelector('summary');
							if (!(timePeriod instanceof HTMLDetailsElement)
								|| !(hideButton instanceof HTMLButtonElement)
								|| !(summary instanceof HTMLElement)) {
								return;
							}
						});
					})();
				</script>
		</div>
	`;
}
