// Cohere embed v3 models return 1024-dimension vectors (keep DENSE_SIZE in config/qdrant.js in sync).
export const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "embed-english-v3.0";

async function embed(texts, inputType) {
  const response = await fetch("https://api.cohere.com/v2/embed", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.COHERE_API_KEY}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      texts,
      input_type: inputType,
      embedding_types: ["float"],
    }),
  });

  if (!response.ok) {
    throw new Error(`Cohere embeddings failed (${response.status}): ${await response.text()}`);
  }
  const { embeddings } = await response.json();
  return embeddings.float;
}

// Cohere accepts up to 96 texts per request; ingest.js sends batches of 50.
export const embeddings = {
  embedDocuments: (texts) => embed(texts, "search_document"),
  embedQuery: async (text) => (await embed([text], "search_query"))[0],
};
