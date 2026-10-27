import { escapeHtml, renderCommentText } from '../../utilities/escape_html.js';
import type { DisabilityArtifact, Organization } from '../../db/db.js';
import { getDevRevision } from "../../app.js";
import type { ReviewComment } from '../../db/db.js';
import { TagWrangler } from '../../components/tag_wrangler.js';



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
	currentUserReputation: number,
	organizations: Organization[],
	tags: string[],
	knownTags: string[],
	message = '',
) {
	const canEdit = currentUserReputation > 49;
	const organizationOptions = organizations.map((organization) =>
		`<option value="${escapeHtml(organization.acronym)}" ${organization.acronym === artifact.org_id ? 'selected' : ''}>${escapeHtml(organization.org_full)} (${escapeHtml(organization.acronym)})</option>`
	).join('');
	const originalCreatedAt = artifact.created_at.toISOString();
	const editableFields = `
        <fieldset class="review-edits">
            <legend>Optional metadata edits</legend>
            <p>Original description: ${escapeHtml(artifact.dataset_description ?? 'None')}</p>
            <label for="dataset_description">Description
                <textarea id="dataset_description" name="dataset_description" maxlength="12000">${escapeHtml(artifact.dataset_description ?? '')}</textarea>
            </label>
            <p>Original tags: ${escapeHtml(tags.length ? tags.join(', ') : 'None')}</p>
            ${TagWrangler(tags, knownTags)}
            <p>Original created at: ${escapeHtml(originalCreatedAt)}</p>
            <label for="created_at">Created at
                <input id="created_at" name="created_at" type="datetime-local" value="${escapeHtml(originalCreatedAt.slice(0, 16))}" required>
            </label>
            <p>Original dataset kind: ${escapeHtml(artifact.dataset_kind || 'None')}</p>
            <label for="dataset_kind">Dataset kind
                <select id="dataset_kind" name="dataset_kind" required>
                    <option value="public" ${artifact.dataset_kind === 'public' ? 'selected' : ''}>Public</option>
                    <option value="private" ${artifact.dataset_kind === 'private' ? 'selected' : ''}>Private</option>
                </select>
            </label>
            <p>Original dataset status: ${escapeHtml(artifact.dataset_status || 'None')}</p>
            <label for="dataset_status">Dataset status
                <select id="dataset_status" name="dataset_status" required>
                    ${['available', 'study', 'discontinued', 'removed', 'unknown'].map((status) => `<option value="${status}" ${artifact.dataset_status === status ? 'selected' : ''}>${status[0].toUpperCase()}${status.slice(1)}</option>`).join('')}
                </select>
            </label>
            <p>Original organization: ${escapeHtml(artifact.org_id)}</p>
            <label for="org_id">Organization
                <select id="org_id" name="org_id" required>${organizationOptions}</select>
            </label>
            <small>These changes are saved only when you approve this dataset.</small> 
        `
	return `
        <link rel="stylesheet" href="/static/css/user_pages.css?v=${getDevRevision()}">
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
                ${editableFields}
                ${canEdit ? `
                <button class="decision" name="decision" value="approved" type="submit">Approve</button>
                <button class="decision" name="decision" value="denied" type="submit">Deny</button>` : ''}
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
