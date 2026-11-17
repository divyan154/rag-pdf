import "dotenv/config";
import path from "node:path";

import { qdrantClient, getCollectionName } from "../config/qdrant.js";
import { ensureCollection } from "../collection.js";
import { ingestPdf } from "../ingest.js";
import { EVAL_USER_ID } from "./config.js";

// Usage: node evaluation/ingestEvalDocs.js [--user <id>] <pdf> [<pdf> ...]
// Re-running replaces that user's copy of each document (matched by original name).
async function main() {
  const args = process.argv.slice(2);
  const userFlag = args.indexOf("--user");
  const userId = userFlag === -1 ? EVAL_USER_ID : args[userFlag + 1];
  const files = args.filter(
    (arg, i) => !arg.startsWith("--") && (userFlag === -1 || i !== userFlag + 1),
  );

  if (files.length === 0) throw new Error("Pass at least one PDF path.");

  const collection = getCollectionName();
  await ensureCollection(collection);
  console.log(`Collection: ${collection} | user: ${userId}`);

  for (const file of files) {
    const originalName = path.basename(file).replace(/^\d{10,}-/, "");

    await qdrantClient.delete(collection, {
      wait: true,
      filter: {
        must: [
          { key: "metadata.userId", match: { value: userId } },
          { key: "metadata.originalName", match: { value: originalName } },
        ],
      },
    });

    const result = await ingestPdf({ path: file, originalName, userId });
    console.log(`  ${originalName}: ${result.chunks} chunks (documentId ${result.documentId})`);
  }
}

main().catch((error) => {
  console.error("Ingest failed:", error);
  process.exitCode = 1;
});
