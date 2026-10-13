import { escapeHtml } from "../utilities/escape_html.js";

export function SearchBar(searchValue = '') {
	return `
		<li>
			<form
				class="tag-select-container"
				method="get"
				action="/search"
			>
				<input
					id="dataset-search"
					class="tag-input"
					type="search"
					placeholder="Search datasets..."
					autocomplete="off"
					value="${escapeHtml(searchValue)}"
				>
			</form>
		</li>
	`;
}
