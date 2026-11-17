import { OllamaEmbeddings } from "@langchain/ollama";

export const EMBEDDING_MODEL = "nomic-embed-text";

export const embeddings = new OllamaEmbeddings({
  model: EMBEDDING_MODEL,
  baseUrl: "http://localhost:11434",
});
