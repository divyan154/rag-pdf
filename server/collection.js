import {
  qdrantClient,
  getCollectionName,
  DENSE_VECTOR,
  SPARSE_VECTOR,
  DENSE_SIZE,
} from "./config/qdrant.js";

const INDEXED_FIELDS = ["metadata.userId", "metadata.documentId", "metadata.originalName"];

const ensured = new Map();

// Creates the hybrid collection (named dense + sparse vectors) and the payload
// indexes the filters rely on. Safe to call concurrently and repeatedly.
export function ensureCollection(name = getCollectionName()) {
  if (!ensured.has(name)) {
    ensured.set(
      name,
      create(name).catch((error) => {
        ensured.delete(name);
        throw error;
      }),
    );
  }
  return ensured.get(name);
}

async function create(name) {
  const { exists } = await qdrantClient.collectionExists(name);
  if (exists) return false;

  await qdrantClient.createCollection(name, {
    vectors: { [DENSE_VECTOR]: { size: DENSE_SIZE, distance: "Cosine" } },
    sparse_vectors: { [SPARSE_VECTOR]: { modifier: "idf" } },
  });

  for (const field_name of INDEXED_FIELDS) {
    await qdrantClient.createPayloadIndex(name, {
      field_name,
      field_schema: "keyword",
      wait: true,
    });
  }
  return true;
}
