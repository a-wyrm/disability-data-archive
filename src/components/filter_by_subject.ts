import { escapeHtml } from "../utilities/escape_html.js";

export type SubjectFilterOptions = {
    subjects: string[];
    selectedSubject?: string;
};

export function FilterBySubject({ subjects, selectedSubject = '' }: SubjectFilterOptions) {
    const options = subjects.map((subject) => `
        <option value="${escapeHtml(subject)}"${subject === selectedSubject ? ' selected' : ''}>${escapeHtml(subject)}</option>
    `).join('');

    return `
        <label>Active Filters</label>
        <div id="filters_active" aria-live="polite"></div>

        <label for="tag">Filters</label>
        <select id="tag" name="tag" data-subject-filter>
            <option value="">All filters</option>
            ${options}
        </select>

        <script>
            (() => {
                const initialize = () => {
                    const filter = document.querySelector('[data-subject-filter]');
                    const activeFilters = document.getElementById('filters_active');
                    const grid = document.querySelector('.dataset-grid');

                    if (filter.dataset.ready) {
						return;
					}
                    filter.dataset.ready = 'true';

                    // Keep a handle on each real subject option so it can be
                    // disabled/re-enabled as filters are added and removed.
                    const optionByValue = new Map();
                    for (const option of filter.querySelectorAll('option')) {
                        optionByValue.set(option.value, option);
                    }

                    const active = new Set();
                    const syncOptions = () => {
                        for (const [value, option] of optionByValue) {
                            option.disabled = active.has(value);
                        }
                        // Never leave the dropdown sitting on an active value.
                        if (filter.value && active.has(filter.value)) {
							filter.value = '';
						}
                    };

                    const updateTiles = () => {
                        const activeList = [...active];

                        if (grid instanceof HTMLElement) {
                            let visibleCount = 0;
                            grid.querySelectorAll('[data-subjects]').forEach((tile) => {

                                const subjects = (tile.dataset.subjects ?? '').split('|').filter(Boolean);
                                const visible = activeList.length === 0 || activeList.some((subject) => subjects.includes(subject));
                                tile.hidden = !visible;

                                if (visible) {
									visibleCount += 1;
								}
                            });

                            let emptyMessage = grid.querySelector('[data-filter-empty]');
                            if (activeList.length > 0 && visibleCount === 0) {
                                if (!emptyMessage) {
                                    emptyMessage = document.createElement('p');
                                    emptyMessage.dataset.filterEmpty = 'true';
                                    emptyMessage.className = 'empty';
                                    grid.append(emptyMessage);
                                }
                                emptyMessage.textContent = 'No datasets match the selected subjects.';
                            } 
							else {
                                emptyMessage?.remove();
                            }
                        }

                        const url = new URL(window.location.href);
                        if (activeList.length > 0) {
							url.searchParams.set('tag', activeList.join(','));
						}
                        else {
							url.searchParams.delete('tag');
						}
                        window.history.replaceState({}, '', url);
                    };

                    const renderChips = () => {
                        activeFilters.textContent = '';
                        for (const subject of active) {
                            const chip = document.createElement('span');
                            chip.className = 'badge react';

                            const label = document.createElement('span');
                            label.className = 'filter-chip__label';
                            label.textContent = subject;

                            const remove = document.createElement('button');
                            remove.type = 'button';
                            remove.className = 'filter-chip_remove';
                            remove.setAttribute('aria-label', 'Remove ' + subject + ' filter');
                            remove.textContent = 'x';
                            remove.addEventListener('click', () => {
                                active.delete(subject);
                                syncOptions();
                                renderChips();
                                updateTiles();
                            });

                            chip.append(label, remove);
                            activeFilters.append(chip);
                        }
                    };

                    filter.addEventListener('change', () => {
                        const value = filter.value;
                        if (!value || active.has(value)) {
                            filter.value = '';
                            return;
                        }
                        active.add(value);
                        syncOptions();
                        renderChips();
                        updateTiles();
                        filter.value = '';
                    });

                    // Move a server-rendered pre-selected subject into the active
                    // filters area instead of leaving it sitting in the dropdown.
                    if (filter.value) {
                        active.add(filter.value);
                        filter.value = '';
                    }

                    syncOptions();
                    renderChips();
                    updateTiles();
                };

                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', initialize);
                } else {
                    initialize();
                }
            })();
        </script>
    `;
}