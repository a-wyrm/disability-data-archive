import 'dotenv/config';
import { closeDatabase, NewDisabilityArtifact } from "../db.js";
import { createArtifactWithTags } from "../db_functions.js";


const dummyData: NewDisabilityArtifact = {
    artifact_type: "csv",
    file_path: "/",
    file_name: "test",
    org_source: "test"
} 


await createArtifactWithTags(dummyData, ["test"]);
await closeDatabase();