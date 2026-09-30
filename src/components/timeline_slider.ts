function escapeAttribute(value: string) {
	return value.replace(/[&<>"']/g, (character) => ({
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#39;',
	})[character] ?? character);
}

export type TimelineSliderOptions = {
	minYear: number;
	maxYear: number;
	from?: number;
	to?: number;
};

export function TimelineSlider({ minYear, maxYear, from, to }: TimelineSliderOptions) {
	const startYear = from ?? minYear;
	const endYear = to ?? maxYear;
	const min = escapeAttribute(String(minYear));
	const max = escapeAttribute(String(maxYear));
	const start = escapeAttribute(String(Math.min(startYear, endYear)));
	const end = escapeAttribute(String(Math.max(startYear, endYear)));

	return `
		<div class="timeline-slider" data-timeline-slider>
			<div class="timeline-slider-heading">
				<span>Publication year</span>
				<output data-timeline-output aria-live="polite">${start}–${end}</output>
			</div>
			<div class="timeline-slider-controls">
				<label class="visually-hidden" for="timeline-from">Start publication year</label>
				<input id="timeline-from" name="timeline-from" type="range" min="${min}" max="${max}" value="${start}" step="1" aria-label="Start publication year">
				<label class="visually-hidden" for="timeline-to">End publication year</label>
				<input id="timeline-to" name="timeline-to" type="range" min="${min}" max="${max}" value="${end}" step="1" aria-label="End publication year">
			</div>
			<div class="timeline-slider-scale" aria-hidden="true"><span>${min}</span><span>${max}</span></div>
		</div>
		<script>
			(() => {
				const slider = document.querySelector('[data-timeline-slider]');
				if (!slider || slider.dataset.ready) return;
				slider.dataset.ready = 'true';
				const form = slider.closest('form');
				const fromInput = slider.querySelector('#timeline-from');
				const toInput = slider.querySelector('#timeline-to');
				const fromField = document.querySelector('#from');
				const toField = document.querySelector('#to');
				const output = slider.querySelector('[data-timeline-output]');
				if (!(form instanceof HTMLFormElement) || !(fromInput instanceof HTMLInputElement) || !(toInput instanceof HTMLInputElement) || !(fromField instanceof HTMLInputElement) || !(toField instanceof HTMLInputElement) || !(output instanceof HTMLOutputElement)) return;

				const update = (submit) => {
					let start = Number(fromInput.value);
					let end = Number(toInput.value);
					if (start > end) {
						if (document.activeElement === fromInput) end = start;
						else start = end;
						fromInput.value = String(start);
						toInput.value = String(end);
					}
					fromField.value = String(start);
					toField.value = String(end);
					output.value = start + '–' + end;
					output.textContent = start + '–' + end;
					if (submit) form.requestSubmit();
				};

				fromInput.addEventListener('input', () => update(false));
				toInput.addEventListener('input', () => update(false));
				fromInput.addEventListener('change', () => update(true));
				toInput.addEventListener('change', () => update(true));
			})();
		</script>
	`;
}
