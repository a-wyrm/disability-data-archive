export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character);
}


export function renderCommentText(text: string) {
  return text.split(/(@[a-zA-Z0-9_]{3,100})/g).map((part) => {
    if (/^@[a-zA-Z0-9_]{3,100}$/.test(part)) {
      return `<strong class="comment-mention">${escapeHtml(part)}</strong>`;
    }
    return escapeHtml(part).replace(/\n/g, '<br>');
  }).join('');
}