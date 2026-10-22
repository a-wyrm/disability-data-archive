import 'dotenv/config';
import { closeDatabase, NewDisabilityArtifact } from "../db.js";
import { createArtifactWithTags } from "../db_functions.js";


const dummyData: NewDisabilityArtifact = {
    artifact_type: "csv",
    file_path: "/static/disability_estimates_cdc_2016.csv",
    file_name: "Disability Estimates",
    reviewed: true,
    dataset_date: "2023-01-28",
    org_id: "CDC",
    dataset_description: "cool dataset",
    dataset_kind: "public",
    dataset_status: "available"
} 

const dummyData2: NewDisabilityArtifact = {
    artifact_type: "csv",
    file_path: "/static/acs_2024_disability_employment.csv",
    file_name: "Disability Employment",
    reviewed: true, 
    dataset_date: "2024-01-01",
    org_id: "ACS",
    dataset_kind: "public",
    dataset_status: "available"
} 


await createArtifactWithTags(dummyData, ["health", "politics"]);
await createArtifactWithTags(dummyData2, ["labor"]);
await closeDatabase();