import { db, NewDisabilityArtifact } from "./db.js";


// Get list of artifacts
export async function getAllArtifacts() {
  return await db.selectFrom('disability_artifacts').selectAll().execute();
}

// Create artifact w/ tags
export async function createArtifactWithTags(artifact: NewDisabilityArtifact, tagNames: string[]) {
  return await db.transaction().execute(async (trx) => {
    // Insert artifact -- trx is transaction
    const insertedArtifact = await trx
      .insertInto('disability_artifacts')
      .values(artifact)
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
    .distinct()
    .execute();
}

export async function findArtifactsByOrgSource(orgSource: string) {
  return await db
    .selectFrom('disability_artifacts')
    .selectAll()
    .where('org_source', '=', orgSource)
    .execute();
}

// Find artifacts with full metadata and tags
export async function findArtifactWithTags(artifactId: number) {
  const artifact = await db
    .selectFrom('disability_artifacts')
    .selectAll()
    .where('id', '=', artifactId)
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

	for (const word of words) {
		const searchTerm = `%${word}%`;

		request = request.where((eb) =>
			eb.or([
				eb('file_name', 'ilike', searchTerm),
				eb('org_source', 'ilike', searchTerm),
				eb('artifact_type', 'ilike', searchTerm),
        eb('tags.name', 'ilike', searchTerm),
			])
		);
	}

	return await request.execute();
}
