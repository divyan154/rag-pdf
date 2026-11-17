import { qdrantClient, getCollectionName, DENSE_VECTOR, SPARSE_VECTOR } from "./config/qdrant.js";
import { embeddings, EMBEDDING_MODEL } from "./embeddings.js";
import { sparseVector } from "./sparse.js";

export { getCollectionName, EMBEDDING_MODEL };

export const DEFAULT_K = 3;
export const MODES = ["dense", "sparse", "hybrid"];
export const DEFAULT_MODE = process.env.RETRIEVAL_MODE ?? "hybrid";

const PREFETCH_LIMIT = 20;

function buildFilter({ userId, documentId }) {
  const must = [{ key: "metadata.userId", match: { value: userId } }];
  if (documentId) must.push({ key: "metadata.documentId", match: { value: documentId } });
  return { must };
}

// Returns [{ doc: { id, pageContent, metadata }, score }] ranked best-first.
// userId is mandatory so a caller can never search across users by accident.
export async function retrieve(query, k = DEFAULT_K, { userId, documentId, mode = DEFAULT_MODE } = {}) {
  if (!userId) throw new Error("retrieve() requires a userId");
  if (!MODES.includes(mode)) throw new Error(`Unknown retrieval mode: ${mode}`);

  const collection = getCollectionName();
  const filter = buildFilter({ userId, documentId });
  const sparse = sparseVector(query, { query: true });
  const hasSparseTerms = sparse.indices.length > 0;

  if (mode === "sparse" && !hasSparseTerms) return [];

  const common = { filter, limit: k, with_payload: true, with_vector: false };
  const denseQuery = mode === "sparse" ? null : await embeddings.embedQuery(query);

  let response;
  if (mode === "dense" || (mode === "hybrid" && !hasSparseTerms)) {
    response = await qdrantClient.query(collection, { ...common, query: denseQuery, using: DENSE_VECTOR });
  } else if (mode === "sparse") {
    response = await qdrantClient.query(collection, { ...common, query: sparse, using: SPARSE_VECTOR });
  } else {
    const limit = Math.max(PREFETCH_LIMIT, k);
    response = await qdrantClient.query(collection, {
      ...common,
      prefetch: [
        { query: denseQuery, using: DENSE_VECTOR, filter, limit },
        { query: sparse, using: SPARSE_VECTOR, filter, limit },
      ],
      query: { fusion: "rrf" },
    });
  }

  return response.points.map((point) => ({
    doc: { id: point.id, pageContent: point.payload.content, metadata: point.payload.metadata },
    score: point.score,
  }));
}
