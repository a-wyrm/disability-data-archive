import type { Organization } from '../db/db.js';
import { escapeHtml } from '../utilities/escape_html.js';

export function OfficePage(organizations: Organization[], officeCounts: Map<string, number>) {
	return `
		<link rel="stylesheet" href="/static/css/office.css">
		<section class="office-page" aria-labelledby="offices-title">
			<div class="office-page-intro">
				<p class="eyebrow">Explore the archive</p>
				<h1 id="offices-title">Offices</h1>
				<p>Browse datasets by the office or organization they came from.</p>
			</div>
			<div class="office-grid" aria-label="Offices represented in the archive">
				${organizations.length === 0
					? '<p class="empty">No offices found.</p>'
					: organizations.map((organization) => `
						<a class="office-card" href="/datasets?org_id=${encodeURIComponent(organization.acronym)}">
							<strong>${escapeHtml(organization.acronym)} <span class="office-count">(${officeCounts.get(organization.acronym) ?? 0} datasets)</span></strong>
							<span>${escapeHtml(organization.org_full)}</span>
						</a>`).join('')}
			</div>
		</section>
	`;
}