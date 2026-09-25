function escapeHtml(value: string) {
  return value.replace(/[&<>\"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '\"': '&quot;',
    "'": '&#39;',
  })[character] ?? character);
}

export function recordRows(records: Array<{ title: string; description: string; source: string; published_year: number }>) {
  if (records.length === 0) {
    return '<p class="empty">No records match that search.</p>';
  }

  return records.map((record) => `
    <article class="record">
      <div>
        <p class="eyebrow">${escapeHtml(record.source)} · ${record.published_year}</p>
        <h3>${escapeHtml(record.title)}</h3>
        <p>${escapeHtml(record.description)}</p>
      </div>
      <span class="record-mark" aria-hidden="true">↗</span>
    </article>
  `).join('');
}

