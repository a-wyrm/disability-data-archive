import { escapeHtml } from '../utilities/escape_html.js';

function serializeTags(tags: string[]) {
	return JSON.stringify(tags).replace(/</g, '\\u003c');
}

export function TagWrangler(tags: string[], knownTags: string[]) {
	const currentValue = tags.join(', ');
	const serializedKnownTags = serializeTags([...new Set(knownTags)]);

	return `
            <div class="tag-wrangler">
                <label for="tags">Tags <small>(comma-separated)</small>
                    <input id="tags" name="tags" value="${escapeHtml(currentValue)}" maxlength="2000" autocomplete="off" aria-describedby="tag-wrangler-help tag-suggestions">
                </label>
                <small id="tag-wrangler-help">Enter a tag to see existing tags with matching words or alternative capitalization.</small>
                <div id="tag-suggestions" class="tag-suggestions" aria-live="polite"></div>
            </div>
            <script type="application/json" id="known-tags">${serializedKnownTags}</script>
            <br>
            <script>
                (() => {
                 
                    const wrangler = document.querySelector('.tag-wrangler');
                    const input = document.getElementById('tags');
                    const suggestions = document.getElementById('tag-suggestions');

                    if (!(wrangler instanceof HTMLElement) || !(input instanceof HTMLInputElement) || !(suggestions instanceof HTMLElement)){
                        return;
                    }

                    const knownTagsElement = document.getElementById('known-tags');
                    if (!(knownTagsElement instanceof HTMLScriptElement)) return;

                    const knownTags = JSON.parse(knownTagsElement.textContent || '[]');
                    const words = (value) => value.toLocaleLowerCase().match(/[\\p{L}\\p{N}]+/gu) || [];
                    const currentTag = () => input.value.split(',').pop().trim();

                    function renderSuggestions() {
                        const entered = currentTag();
                        const enteredWords = words(entered);
                        if (!enteredWords.length) {
                            suggestions.replaceChildren();
                            return;
                        }

                        const normalizedEntered = entered.toLocaleLowerCase();
                        const matches = knownTags
                            .filter((tag) => tag !== entered
                                && (tag.toLocaleLowerCase().includes(normalizedEntered)
                                    || words(tag).some((word) => enteredWords.includes(word))))
                            .sort((left, right) => left.localeCompare(right))
                            .slice(0, 12);

                        suggestions.replaceChildren();
                        const label = document.createElement('span');
                        label.textContent = matches.length
                            ? 'Potentially related existing tags:'
                            : 'not found';
                        suggestions.append(label);
                        for (const match of matches) {
                            const button = document.createElement('button');
                            button.type = 'button';
                            button.className = 'tag-suggestion';
                            button.textContent = match;
                            button.addEventListener('click', () => {
                                const prefix = input.value.slice(0, input.value.lastIndexOf(',') + 1);
                                input.value = prefix + ' ' + match;
                                input.focus();
                                renderSuggestions();
                            });
                            suggestions.append(button);
                        }
                    }

                    input.addEventListener('input', renderSuggestions);
                    input.addEventListener('keydown', (event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            renderSuggestions();
                        }
                    });
                    renderSuggestions();
                })();
            </script>`;
}