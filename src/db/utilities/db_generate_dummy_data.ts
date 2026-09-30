import 'dotenv/config';
import { closeDatabase, NewDisabilityArtifact } from "../db.js";
import { createArtifactWithTags } from "../db_functions.js";


const dummyData: NewDisabilityArtifact = {
    artifact_type: "pdf",
    file_path: "/",
    file_name: "test",
    org_source: "test"
} 


await createArtifactWithTags(dummyData, ["politics", "health"]);
await closeDatabase();