import { randomUUID } from "node:crypto";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

import { qdrantClient, getCollectionName, DENSE_VECTOR, SPARSE_VECTOR } from "./config/qdrant.js";
import { ensureCollection } from "./collection.js";
import { embeddings } from "./embeddings.js";
import { sparseVector } from "./sparse.js";

const BATCH_SIZE = 50;

export async function ingestPdf({ path, originalName, userId, documentId = randomUUID() }) {
  if (!userId) throw new Error("ingestPdf requires a userId");

  const docs = await new PDFLoader(path).load();
  const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 800, chunkOverlap: 300 });
  const chunks = await splitter.splitDocuments(docs);

  const collection = getCollectionName();
  await ensureCollection(collection);

  for (let start = 0; start < chunks.length; start += BATCH_SIZE) {
    const batch = chunks.slice(start, start + BATCH_SIZE);
    const dense = await embeddings.embedDocuments(batch.map((c) => c.pageContent));

    await qdrantClient.upsert(collection, {
      wait: true,
      points: batch.map((chunk, i) => ({
        id: randomUUID(),
        vector: {
          [DENSE_VECTOR]: dense[i],
          [SPARSE_VECTOR]: sparseVector(chunk.pageContent),
        },
        payload: {
          content: chunk.pageContent,
          metadata: {
            source: chunk.metadata.source,
            loc: chunk.metadata.loc,
            userId,
            documentId,
            originalName,
            chunkIndex: start + i,
          },
        },
      })),
    });
  }

  return { documentId, chunks: chunks.length };
}
