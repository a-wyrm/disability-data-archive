import { escapeHtml } from '../../utilities/escape_html.js';
import type { DisabilityArtifact } from '../../db/db.js';
import type { ReviewComment } from '../../db/db.js';

function renderCommentText(text: string) {
	return text.split(/(@[a-zA-Z0-9_]{3,100})/g).map((part) => {
		if (/^@[a-zA-Z0-9_]{3,100}$/.test(part)) {
			return `<strong class="comment-mention">${escapeHtml(part)}</strong>`;
		}
		return escapeHtml(part).replace(/\n/g, '<br>');
	}).join('');
}

function renderComment(comment: ReviewComment, currentUserId: number) {
	return `
        <article class="review-comment">
            <header><strong>${escapeHtml(comment.username)}</strong>
                <time datetime="${comment.comment_date.toISOString()}">${comment.comment_date.toLocaleString()}</time>
                ${comment.edited_at ? '<span>(edited)</span>' : ''}
            </header>
            <p>${renderCommentText(comment.comment_text)}</p>
            <div class="comment-actions">
                ${comment.user_id === currentUserId ? `<button type="button" class="comment-edit" data-comment-id="${comment.comment_id}">Edit</button>` : ''}
            </div>
            <form class="comment-edit-form" id="edit-comment-${comment.comment_id}" method="post" action="/userPages/review_files/comments/${comment.comment_id}/edit" hidden>
                <textarea name="comment" required maxlength="5000">${escapeHtml(comment.comment_text)}</textarea>
                <button type="submit">Save edit</button>
            </form>
        </article>`;
}

export function ReviewFilePage(
	artifact: DisabilityArtifact,
	comments: ReviewComment[],
	currentUserId: number,
	message = '',
) {
	return `
    <section class="dataset-detail">
        <link rel="stylesheet" href="/static/css/user_pages.css">
        <a class="back-link" href="/userPages/review_list">Back to reviews</a>
        <h2 style="padding-top: 10px;">${escapeHtml(artifact.file_name)}</h2>
        <p>${escapeHtml(artifact.artifact_type)} - ${escapeHtml(artifact.dataset_date ?? 'Date unknown')}</p>
        ${message}
		<div class="artifact-actions">
            <a class="artifact-link" href="${escapeHtml(artifact.file_path)}">Open submitted artifact</a>
        </div>
        <section class="review-comments" aria-labelledby="comments-heading">
            <h3 id="comments-heading">Review comments</h3>
            ${comments.length ? comments.map((comment) => renderComment(comment, currentUserId)).join('') : '<p>No comments yet.</p>'}
            <form method="post" action="/userPages/review_files/${artifact.id}/comments">
                <label for="comment">Add a comment</label>
                <textarea id="comment" name="comment" required maxlength="5000" placeholder="Use @username to mention another reviewer"></textarea>
                <input type="hidden" name="parent_comment_id" id="parent-comment-id">
                <button type="submit">Comment</button>
            </form>
        </section>
        <form method="post" action="/userPages/review_files/${artifact.id}">
            <button class="decision" name="decision" value="approved" type="submit">Approve</button>
            <button class="decision" name="decision" value="denied" type="submit">Deny</button>
        </form>
        <script>
            document.querySelectorAll('.comment-edit').forEach((button) => {
                button.addEventListener('click', () => {
                    const form = document.getElementById('edit-comment-' + button.dataset.commentId);
                    if (form) form.hidden = !form.hidden;
                });
            });
            document.querySelectorAll('.comment-reply').forEach((button) => {
                button.addEventListener('click', () => {
                    document.getElementById('parent-comment-id').value = button.dataset.commentId;
                    document.getElementById('comment').focus();
                });
            });
        </script>
    </section>`;
}
