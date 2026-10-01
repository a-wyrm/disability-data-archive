import 'dotenv/config';
import { closeDatabase, NewDisabilityArtifact } from "../db.js";
import { createArtifactWithTags } from "../db_functions.js";


const dummyData: NewDisabilityArtifact = {
    artifact_type: "csv",
    file_path: "/",
    file_name: "cool database",
    dataset_date: "2023-01-28",
    org_source: "NHS"
} 


await createArtifactWithTags(dummyData, ["politics", "health"]);
await closeDatabase();