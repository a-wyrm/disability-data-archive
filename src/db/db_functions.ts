import { db, NewDisabilityArtifact, Organization } from "./db.js";

export async function getOrganizations(): Promise<Organization[]> {
  return await db
    .selectFrom('org_acronym')
    .selectAll()
    .orderBy('org_full', 'asc')
    .execute();
}

export async function getAllTags(): Promise<string[]> {
  const tags = await db
    .selectFrom('tags')
    .select('name')
    .orderBy('name', 'asc')
    .execute();
  return tags.map((tag) => tag.name);
}

export async function resolveOrganization(acronym: string, orgFull: string | null, orgAcr: string | null): Promise<string | null> {
  return await db.transaction().execute(async (trx) => {
    if (acronym !== 'other') {
      const organization = await trx
        .selectFrom('org_acronym')
        .select('acronym')
        .where('acronym', '=', acronym)
        .executeTakeFirst();
      return organization?.acronym ?? null;
    }

    if (!orgFull || !orgAcr) {
      return null;
    }

    const existing = await trx
      .selectFrom('org_acronym')
      .select('acronym')
      .where('org_full', '=', orgFull)
      .executeTakeFirst();
    if (existing) {
      return existing.acronym;
    }

    // put org acronym -- if there isn't an existing acronym nor full name
    if (acronym === 'other' && orgFull !== null && orgAcr !== null) {
      await trx.insertInto('org_acronym').values({
        acronym: orgAcr,
        org_full: orgFull,
      }).execute();

      return orgAcr;
    }

    return null;
  });
}

// Get list of artifacts
export async function getAllArtifacts() {
  return await db.selectFrom('disability_artifacts').selectAll().where('reviewed', '=', true).execute();
}

export async function getHomeStats() {
  const [datasets, volunteers] = await Promise.all([
    db.selectFrom('disability_artifacts')
      .select(({ fn }) => fn.count<number>('id').as('count'))
      .where('reviewed', '=', true)
      .executeTakeFirstOrThrow(),
    db.selectFrom('users')
      .select(({ fn }) => fn.count<number>('user_id').as('count'))
      .executeTakeFirstOrThrow(),
  ]);

  return {
    rescuedDatasets: Number(datasets.count),
    volunteers: Number(volunteers.count),
  };
}

export async function getPendingArtifacts() {
  return await db
    .selectFrom('disability_artifacts')
    .selectAll()
    .where('reviewed', '=', false)
    .where(({ not, exists, selectFrom }) => not(exists(
      selectFrom('artifacts_review')
        .select('review_id')
        .whereRef('artifacts_review.artifact_id', '=', 'disability_artifacts.id')
    )))
    .orderBy('added_at', 'asc')
    .execute();
}


// Create artifact w/ tags
export async function createArtifactWithTags(artifact: NewDisabilityArtifact, tagNames: string[]) {
  return await db.transaction().execute(async (trx) => {

    // Insert artifact -- trx is transaction
    const insertedArtifact = await trx
      .insertInto('disability_artifacts')
      .values({ ...artifact })
      .returningAll()
      .executeTakeFirstOrThrow();

    // Create or fetch tags
    for (const tagName of tagNames) {
      const tag = await trx
        .insertInto('tags')
        .values({ name: tagName })
        .onConflict((oc) => oc.column('name').doNothing())
        .returningAll()
        .executeTakeFirst();

      // Get tag ID (whether we just created it or it existed)
      const tagId = tag?.id || (await trx
        .selectFrom('tags')
        .select('id')
        .where('name', '=', tagName)
        .executeTakeFirstOrThrow()).id;

      // Link artifact to tag
      await trx
        .insertInto('artifact_tags')
        .values({ artifact_id: insertedArtifact.id, tag_id: tagId })
        .onConflict((oc) => oc.doNothing())
        .execute();
    }

    return insertedArtifact;
  });
}

export async function findArtifactsByTags(tagNames: string[]) {
  return await db
    .selectFrom('disability_artifacts')
    .selectAll('disability_artifacts')
    .innerJoin('artifact_tags', 'artifact_tags.artifact_id', 'disability_artifacts.id')
    .innerJoin('tags', 'tags.id', 'artifact_tags.tag_id')
    .where('tags.name', 'in', tagNames)
    .where('disability_artifacts.reviewed', '=', true)
    .distinct()
    .execute();
}

export async function findArtifactsByOrgSource(orgSource: string) {
  return await db
    .selectFrom('disability_artifacts')
    .selectAll()
    .where('org_id', '=', orgSource)
    .where('reviewed', '=', true)
    .execute();
}

// Find artifacts with full metadata and tags
export async function findArtifactWithTags(artifactId: number) {
  const artifact = await db
    .selectFrom('disability_artifacts')
    .selectAll()
    .where('id', '=', artifactId)
    .where('reviewed', '=', true)
    .executeTakeFirst();

  if (!artifact) return null;

  const tags = await db
    .selectFrom('artifact_tags')
    .innerJoin('tags', 'tags.id', 'artifact_tags.tag_id')
    .select(['tags.id', 'tags.name'])
    .where('artifact_tags.artifact_id', '=', artifactId)
    .execute();

  return {
    ...artifact,
    tags: tags.map(t => ({ id: t.id, name: t.name }))
  };
}

export async function searchArtifacts(query: string) {
	const words = query.trim().split(/\s+/).filter(Boolean);
  let request = db
    .selectFrom('disability_artifacts')
    .leftJoin('artifact_tags', 'artifact_tags.artifact_id', 'disability_artifacts.id')
    .leftJoin('tags', 'tags.id', 'artifact_tags.tag_id')
    .selectAll('disability_artifacts')
    .distinct();

  request = request.where('disability_artifacts.reviewed', '=', true);

	for (const word of words) {
		const searchTerm = `%${word}%`;

		request = request.where((eb) =>
			eb.or([
				eb('file_name', 'ilike', searchTerm),
				eb('org_id', 'ilike', searchTerm),
				eb('artifact_type', 'ilike', searchTerm),
        eb('tags.name', 'ilike', searchTerm),
			])
		);
	}

	return await request.execute();
}

export async function findPendingArtifact(artifactId: number) {
  return await db
    .selectFrom('disability_artifacts')
    .selectAll()
    .where('id', '=', artifactId)
    .where('reviewed', '=', false)
    .where(({ not, exists, selectFrom }) => not(exists(
      selectFrom('artifacts_review')
        .select('review_id')
        .whereRef('artifacts_review.artifact_id', '=', 'disability_artifacts.id')
    )))
    .executeTakeFirst();
}

// Review edits for each artifact
export interface ArtifactReviewEdits {
  dataset_description: string | null;
  created_at: Date;
  dataset_kind: string;
  dataset_status: string;
  org_id: string;
  tags: string[];
}

export async function getUserById(userId: number) {
  return await db
    .selectFrom('users')
    .select(['user_id', 'reputation', 'is_locked'])
    .where('user_id', '=', userId)
    .executeTakeFirst();
}

export async function getPendingArtifactTags(artifactId: number) {
  return await db
    .selectFrom('artifact_tags')
    .innerJoin('tags', 'tags.id', 'artifact_tags.tag_id')
    .select(['tags.id', 'tags.name'])
    .where('artifact_tags.artifact_id', '=', artifactId)
    .execute();
}

export async function reviewArtifact(
  artifactId: number,
  userId: number,
  status: 'approved' | 'denied',
  edits?: ArtifactReviewEdits,
) {
  return await db.transaction().execute(async (trx) => {
    const artifact = await trx
      .selectFrom('disability_artifacts')
      .select('id')
      .where('id', '=', artifactId)
      .where('reviewed', '=', false)
      .where(({ not, exists, selectFrom }) => not(exists(
        selectFrom('artifacts_review')
          .select('review_id')
          .whereRef('artifacts_review.artifact_id', '=', 'disability_artifacts.id')
      )))
      .executeTakeFirst();

    if (status === 'approved' && edits) {
      await trx
        .updateTable('disability_artifacts')
        .set({
          dataset_description: edits.dataset_description,
          created_at: edits.created_at,
          dataset_kind: edits.dataset_kind,
          dataset_status: edits.dataset_status,
          org_id: edits.org_id,
        })
        .where('id', '=', artifactId)
        .execute();

      await trx.deleteFrom('artifact_tags').where('artifact_id', '=', artifactId).execute();
      for (const tagName of edits.tags) {
        const tag = await trx
          .insertInto('tags')
          .values({ name: tagName })
          .onConflict((oc) => oc.column('name').doNothing())
          .returning('id')
          .executeTakeFirst();
        const tagId = tag?.id ?? (await trx
          .selectFrom('tags')
          .select('id')
          .where('name', '=', tagName)
          .executeTakeFirstOrThrow()).id;
        await trx.insertInto('artifact_tags')
          .values({ artifact_id: artifactId, tag_id: tagId })
          .onConflict((oc) => oc.doNothing())
          .execute();
      }
    }

    await trx.insertInto('artifacts_review').values({
      artifact_id: artifactId,
      user_id: userId,
      review_status: status,
      review_ratings: null,
    }).execute();

    await trx
      .updateTable('disability_artifacts')
      .set({ reviewed: status === 'approved', updated_at: new Date() })
      .where('id', '=', artifactId)
      .execute();

    if (status === 'approved') {
      await trx
        .updateTable('users')
        .set(({ eb }) => ({ reputation: eb('reputation', '+', 1) }))
        .where('user_id', '=', userId)
        .execute();
    }

    return true;
  });
}

export async function getReviewComments(artifactId: number) {
  return await db
    .selectFrom('review_comments')
    .innerJoin('users', 'users.user_id', 'review_comments.user_id')
    .select([
      'review_comments.comment_id',
      'review_comments.artifact_id',
      'review_comments.parent_comment_id',
      'review_comments.user_id',
      'review_comments.comment_text',
      'review_comments.comment_date',
      'review_comments.edited_at',
      'users.username',
    ])
    .where('review_comments.artifact_id', '=', artifactId)
    .orderBy('review_comments.comment_date', 'asc')
    .execute();
}

export async function createReviewComment(
  artifactId: number,
  userId: number,
  commentText: string,
  parentCommentId: number | null = null,
) {
  if (parentCommentId !== null) {
    const parent = await db
      .selectFrom('review_comments')
      .select('comment_id')
      .where('comment_id', '=', parentCommentId)
      .where('artifact_id', '=', artifactId)
      .executeTakeFirst();
    if (!parent) return null;
  }

  return await db
    .insertInto('review_comments')
    .values({
      artifact_id: artifactId,
      parent_comment_id: parentCommentId,
      user_id: userId,
      comment_text: commentText,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function updateReviewComment(commentId: number, userId: number, commentText: string) {
  return await db
    .updateTable('review_comments')
    .set({ comment_text: commentText, edited_at: new Date() })
    .where('comment_id', '=', commentId)
    .where('user_id', '=', userId)
    .returning(['comment_id'])
    .executeTakeFirst();
}

export async function findUserByLogin(login: string) {
  return await db.selectFrom('users').selectAll()
    .where((eb) => eb.or([eb('email', '=', login), eb('username', '=', login)]))
    .executeTakeFirst();
}

export async function createUser(username: string, email: string, passwordHash: string) {
  return await db.insertInto('users')
    .values({ username, email, password_hash: passwordHash })
    .returning(['user_id', 'username', 'email', 'is_locked'])
    .executeTakeFirstOrThrow();
}
