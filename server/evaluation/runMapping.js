import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";

import { qdrantClient, getCollectionName } from "../config/qdrant.js";
import { matchEvidenceToChunks } from "./evidenceMatcher.js";
import { DATASET_PATH, MAPPING_PATH, EVAL_USER_ID } from "./config.js";

async function fetchDocumentChunks(originalName) {
  const chunks = [];
  let offset = null;

  do {
    const response = await qdrantClient.scroll(getCollectionName(), {
      filter: {
        must: [
          { key: "metadata.userId", match: { value: EVAL_USER_ID } },
          { key: "metadata.originalName", match: { value: originalName } },
        ],
      },
      limit: 100,
      offset,
      with_payload: true,
      with_vector: false,
    });

    for (const point of response.points) {
      const payload = point.payload ?? {};
      chunks.push({
        pointId: point.id,
        content: payload.content ?? "",
        pageNumber: payload.metadata?.loc?.pageNumber ?? null,
        source: payload.metadata?.source ?? null,
        lineStart: payload.metadata?.loc?.lines?.from ?? null,
        lineEnd: payload.metadata?.loc?.lines?.to ?? null,
      });
    }
    offset = response.next_page_offset;
  } while (offset !== null && offset !== undefined);

  return chunks;
}

async function main() {
  const collection = await qdrantClient.getCollection(getCollectionName());
  console.log("Collection:", getCollectionName(), `(${collection.points_count} points) | user: ${EVAL_USER_ID}`);

  const dataset = JSON.parse(await fs.readFile(DATASET_PATH, "utf8"));
  const chunksByDocument = new Map();

  for (const [key, originalName] of Object.entries(dataset.documents)) {
    const chunks = await fetchDocumentChunks(originalName);
    if (chunks.length === 0) {
      throw new Error(
        `No chunks for "${originalName}" owned by ${EVAL_USER_ID}. Run evaluation/ingestEvalDocs.js first.`,
      );
    }
    console.log(`  ${key}: ${chunks.length} chunks (${originalName})`);
    chunksByDocument.set(key, chunks);
  }

  const unmatched = [];
  const mapping = dataset.questions.map((question) => {
    const chunks = chunksByDocument.get(question.document);
    if (!chunks) throw new Error(`${question.id} references unknown document "${question.document}"`);

    const evidenceMappings = question.evidence.map((evidence, index) => {
      const page = evidence.page_number;
      const result = matchEvidenceToChunks({ ...evidence, page }, chunks);
      if (result.status !== "exact_match") unmatched.push(`${question.id} evidence #${index} (page ${page})`);
      return { evidenceIndex: index, page, ...result };
    });

    return { questionId: question.id, evidenceMappings };
  });

  await fs.mkdir(path.dirname(MAPPING_PATH), { recursive: true });
  await fs.writeFile(MAPPING_PATH, JSON.stringify(mapping, null, 2), "utf8");

  const totalEvidence = mapping.reduce((sum, item) => sum + item.evidenceMappings.length, 0);
  console.log("\nEvidence mapping complete!");
  console.log("Questions:", mapping.length, `(${mapping.filter((m) => m.evidenceMappings.length === 0).length} without evidence)`);
  console.log("Evidence passages:", totalEvidence);
  console.log("Exact matches:", totalEvidence - unmatched.length);
  console.log("Unmatched:", unmatched.length);
  unmatched.forEach((u) => console.log("  -", u));
  console.log("Output:", MAPPING_PATH);
}

main().catch((error) => {
  console.error("Evidence mapping failed:", error.message);
  process.exitCode = 1;
});
