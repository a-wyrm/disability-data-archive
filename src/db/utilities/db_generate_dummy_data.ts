import 'dotenv/config';
import { closeDatabase, NewDisabilityArtifact } from "../db.js";
import { createArtifactWithTags } from "../db_functions.js";


const dummyData: NewDisabilityArtifact = {
    artifact_type: "csv",
    file_path: "/static/disability_estimates_cdc_2016.csv",
    file_name: "Disability Estimates",
    dataset_date: "2023-01-28",
    org_source: "CDC"
} 

const dummyData2: NewDisabilityArtifact = {
    artifact_type: "csv",
    file_path: "/static/acs_2024_disability_employment.csv",
    file_name: "Disability Employment",
    dataset_date: "2024-01-01",
    org_source: "ACS"
} 


await createArtifactWithTags(dummyData, ["health", "politics"]);
await closeDatabase();