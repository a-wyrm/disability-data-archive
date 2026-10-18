import { escapeHtml } from "../utilities/escape_html.js";
import type { Organization } from "../db/db.js";

export function SubmitPage(organizations: Organization[], message = "") {
  const organizationOptions = organizations.map((organization) =>
    `<option value="${escapeHtml(organization.acronym)}">${escapeHtml(organization.org_full)} (${escapeHtml(organization.acronym)})</option>`
  ).join('');

  return `
    <section class="submit-page" aria-labelledby="submit-title">
      <h1 id="submit-title">Submit a dataset or artifact</h1>
      <p class="submit-intro">Share a disability-related dataset or artifact to the archive. Submissions are validated before they are added to the public archive.</p>
      ${message}

      <form class="submit-form" method="post" action="/submit" enctype="multipart/form-data">
        <label for="file_name">Dataset or artifact name
          <input id="file_name" name="file_name" type="text" maxlength="255" required autocomplete="off">
        </label>

        <label for="org_id">Organization or source
          <select id="org_id" name="org_id" required>
            <option value="">Select an organization</option>
            ${organizationOptions}
            <option value="other">Other</option>
          </select>
        </label>

        <label id="other-org-full-label" for="other_org_full" hidden>Full organization name
          <input id="other_org_full" name="other_org_full" type="text" maxlength="300" autocomplete="organization" required>
        </label>

        <label id="other-org-acronym-label" for="other_org_acronym" hidden>Organization Acronym
          <input id="other_org_acronym" name="other_org_acronym" type="text" maxlength="50">
        </label>

        <label for="dataset_date">When was the dataset published? <small>(optional)</small>
          <input id="dataset_date" name="dataset_date" type="text" maxlength="100" placeholder="YYYY, YYYY-MM, or YYYY-MM-DD">
        </label>

        <label for="tags_input">Tags</label>
        <div id="tags" aria-live="polite"></div>
        <input id="tags_input" type="text" maxlength="25" autocomplete="off" placeholder="Type a tag and press Enter">

        <label for="artifact-file">File
          <input id="artifact-file" name="artifact_file" type="file" accept=".csv,.jpg,.jpeg,.png,text/csv,image/jpeg,image/png" required>
          <small>Accepted formats: CSV, JPG, and PNG. Maximum size: 10 MB.</small>
        </label>

        <label class="submit-honeypot" aria-hidden="true">Leave this field blank
          <input name="website" type="text" tabindex="-1" autocomplete="off">
        </label>

        <button type="submit">Submit for review</button>

      </form>

      <script>

        const tagsInput = document.getElementById('tags_input');
        const tagList = document.getElementById('tags');
        const organizationSelect = document.getElementById('org_id');
        const otherOrganizationFullLabel = document.getElementById('other-org-full-label');
        const otherOrganizationAcronymLabel = document.getElementById('other-org-acronym-label');
        const otherOrganizationInput = document.getElementById('other_org_full');
        const otherOrganizationAcronymInput = document.getElementById('other_org_acronym');
        const active = [];

        organizationSelect.addEventListener('change', function () {
            const isOther = organizationSelect.value === 'other';
            otherOrganizationFullLabel.hidden = !isOther;
            otherOrganizationAcronymLabel.hidden = !isOther;
            otherOrganizationInput.required = isOther;
            otherOrganizationAcronymInput.required = isOther;
            if (!isOther) {
              otherOrganizationInput.value = '';
              otherOrganizationAcronymInput.value = '';
            }
        });

        tagsInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                const tag = tagsInput.value.trim();
                if (!tag || active.includes(tag)) return;

                active.push(tag);
                tagsInput.value = '';
                renderChips();
            
            }

        });

        const renderChips = () => {
            tagList.textContent = '';
            for (const tag of active) {
                const chip = document.createElement('span');
                chip.className = 'badge react';

                const label = document.createElement('span');
                label.className = 'filter-chip_label';
                label.textContent = tag;

                const remove = document.createElement('button');
                remove.type = 'button';
                remove.className = 'filter-chip_remove';
                remove.setAttribute('aria-label', 'Remove ' + tag + ' tag');
                remove.textContent = 'x';
                remove.addEventListener('click', () => {
                    active.splice(active.indexOf(tag), 1);
                    renderChips();
                });

                chip.append(label, remove);
                const hidden = document.createElement('input');
                hidden.type = 'hidden';
                hidden.name = 'tags';
                hidden.value = tag;
                chip.append(hidden);
                tagList.append(chip);
            }
        };
      </script>

    </section>
  `;
}

export function submitError(message: string) {
  return `<p class="form-message error" role="alert">${escapeHtml(message)}</p>`;
}

export function submitSuccess() {
  return `<p class="form-message success" role="status">Thank you. Your submission was received and is awaiting review.</p>`;
}