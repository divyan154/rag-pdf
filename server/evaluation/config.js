export const DATASET_PATH = process.env.EVAL_DATASET ?? "evals/datasets/rag_v2.json";
export const MAPPING_PATH = process.env.EVAL_MAPPING ?? "evals/mappings/rag_v2_mapping.json";
export const RESULTS_DIR = "evals/results";

// The user who owns the documents the evals search (retrieval is always per-user).
export const EVAL_USER_ID = process.env.EVAL_USER_ID ?? "eval-user";
