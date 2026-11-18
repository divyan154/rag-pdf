import { QdrantClient } from "@qdrant/qdrant-js";

const url = process.env.QDRANT_URL ?? "http://localhost:6333";

export const qdrantClient = new QdrantClient({ url, apiKey: process.env.QDRANT_API_KEY });

export const getCollectionName = () =>
  process.env.QDRANT_COLLECTION ?? "langchainjs-testing";

export const collectionName = process.env.QDRANT_COLLECTION;

export const DENSE_VECTOR = "dense";
export const SPARSE_VECTOR = "sparse";
export const DENSE_SIZE = 1024;
