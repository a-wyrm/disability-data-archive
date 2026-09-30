function escapeAttribute(value: string) {
	return value.replace(/[&<>"']/g, (character) => ({
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#39;',
	})[character] ?? character);
}

export type SubjectFilterOptions = {
	subjects: string[];
	selectedSubject?: string;
};

export function FilterBySubject({ subjects, selectedSubject = '' }: SubjectFilterOptions) {
	const options = subjects.map((subject) => `
		<option value="${escapeAttribute(subject)}"${subject === selectedSubject ? ' selected' : ''}>${escapeAttribute(subject)}</option>
	`).join('');

	return `
		<label for="tag">Subject</label>
		<select id="tag" name="tag" data-subject-filter>
			<option value="">All subjects</option>
			${options}
		</select>
		<script>
			(() => {
				const initialize = () => {
					const filter = document.querySelector('[data-subject-filter]');
					const grid = document.querySelector('.dataset-grid');
					if (!(filter instanceof HTMLSelectElement) || !(grid instanceof HTMLElement) || filter.dataset.ready) return;
					filter.dataset.ready = 'true';

					const updateTiles = () => {
					const selected = filter.value;
					let visibleCount = 0;
					grid.querySelectorAll('[data-subjects]').forEach((tile) => {
						if (!(tile instanceof HTMLElement)) return;
						const subjects = (tile.dataset.subjects ?? '').split('|').filter(Boolean);
						const visible = !selected || subjects.includes(selected);
						tile.hidden = !visible;
						if (visible) visibleCount += 1;
					});
					};
					let emptyMessage = grid.querySelector('[data-filter-empty]');
					filter.addEventListener('change', updateTiles);
					updateTiles();
				};

				if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize);
				else initialize();
							emptyMessage = document.createElement('p');
							emptyMessage.dataset.filterEmpty = 'true';
							emptyMessage.className = 'empty';
							grid.append(emptyMessage);
						}
						emptyMessage.textContent = 'No datasets match this subject.';
					} else {
						emptyMessage?.remove();
					}

					const url = new URL(window.location.href);
					if (selected) url.searchParams.set('tag', selected);
					else url.searchParams.delete('tag');
					window.history.replaceState({}, '', url);
				};

				filter.addEventListener('change', updateTiles);
				updateTiles();
			})();
		</script>
	`;
}
