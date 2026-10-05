import { escapeHtml } from "../utilities/escape_html.js";
import { DisabilityArtifact } from "../db/db.js";

type SearchResult = DisabilityArtifact & {
	tags: { id: number; name: string }[];
};

export function SearchPage(artifacts: SearchResult[], searchValue: string) {
	const results = artifacts.length === 0
		? `
			<p class="empty">
				No datasets found for
				<strong>${escapeHtml(searchValue)}</strong>.
			</p>
		`
		: artifacts.map((artifact) => `
			<article class="dataset-result">
				<h2>
					<a href="/datasets/${artifact.id}">
						${escapeHtml(artifact.file_name)}
					</a>
				</h2>

				<p>
					${escapeHtml(artifact.org_source)}
				</p>

				<p>
					${escapeHtml(artifact.artifact_type)}
				</p>

				${artifact.tags.length > 0 ? `
					<p>
						${artifact.tags.map((tag) => escapeHtml(tag.name)).join(" · ")}
					</p>
				` : ""}
			</article>
		`).join("");

	return `
    <main>
        <h1>Search results</h1>
        ${results}
    </main>`;
}
