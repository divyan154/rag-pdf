import "dotenv/config";

import { qdrantClient, getCollectionName } from "../config/qdrant.js";
import { retrieve, MODES } from "../retrieval.js";
import { EVAL_USER_ID } from "./config.js";

// Needs two tenants with the same document ingested:
//   node evaluation/ingestEvalDocs.js <pdfs...>
//   node evaluation/ingestEvalDocs.js --user eval-other-user <pdf>
const OTHER_USER_ID = process.env.EVAL_OTHER_USER_ID ?? "eval-other-user";
const NOBODY = "user-with-no-documents";
const PROBES = ["What is npm?", "keyword research", "setTimeout", "content calendar", "writeFileSync"];

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` ${detail}`}`);
  if (!ok) failures++;
}

async function documentIdsFor(userId) {
  const ids = new Map();
  let offset = null;
  do {
    const page = await qdrantClient.scroll(getCollectionName(), {
      filter: { must: [{ key: "metadata.userId", match: { value: userId } }] },
      limit: 200,
      offset,
      with_payload: ["metadata.documentId", "metadata.originalName"],
      with_vector: false,
    });
    page.points.forEach((p) => ids.set(p.payload.metadata.originalName, p.payload.metadata.documentId));
    offset = page.next_page_offset;
  } while (offset != null);
  return ids;
}

async function main() {
  const mine = await documentIdsFor(EVAL_USER_ID);
  const theirs = await documentIdsFor(OTHER_USER_ID);
  if (mine.size < 2 || theirs.size < 1) {
    throw new Error(`Need >=2 documents for ${EVAL_USER_ID} and >=1 for ${OTHER_USER_ID}; see the header of this file.`);
  }
  console.log(`Collection: ${getCollectionName()} | users: ${EVAL_USER_ID} (${mine.size} docs), ${OTHER_USER_ID} (${theirs.size} docs)\n`);

  for (const mode of MODES) {
    let leaked = 0;
    let overlap = 0;
    for (const probe of PROBES) {
      const a = await retrieve(probe, 10, { userId: EVAL_USER_ID, mode });
      const b = await retrieve(probe, 10, { userId: OTHER_USER_ID, mode });
      leaked += a.filter((r) => r.doc.metadata.userId !== EVAL_USER_ID).length;
      leaked += b.filter((r) => r.doc.metadata.userId !== OTHER_USER_ID).length;
      const aIds = new Set(a.map((r) => r.doc.id));
      overlap += b.filter((r) => aIds.has(r.doc.id)).length;
    }
    check(`[${mode}] every result belongs to the requesting user`, leaked === 0, `(${leaked} leaked)`);
    check(`[${mode}] two users never receive the same chunk`, overlap === 0, `(${overlap} shared)`);

    const none = await retrieve("What is npm?", 10, { userId: NOBODY, mode });
    check(`[${mode}] a user with no documents gets nothing`, none.length === 0, `(${none.length} results)`);

    for (const [name, documentId] of mine) {
      const rows = await retrieve("What is npm? keyword research", 10, { userId: EVAL_USER_ID, documentId, mode });
      const wrong = rows.filter((r) => r.doc.metadata.documentId !== documentId).length;
      check(`[${mode}] documentId filter keeps results inside ${name}`, rows.length > 0 && wrong === 0, `(${rows.length} rows, ${wrong} outside)`);
    }

    const [someDocOfOther] = theirs.values();
    const cross = await retrieve("What is npm?", 10, { userId: EVAL_USER_ID, documentId: someDocOfOther, mode });
    check(`[${mode}] another user's documentId returns nothing`, cross.length === 0, `(${cross.length} results)`);
  }

  await retrieve("What is npm?", 3, {}).then(
    () => check("retrieve() without a userId is rejected", false),
    () => check("retrieve() without a userId is rejected", true),
  );

  console.log(failures === 0 ? "\nAll isolation checks passed." : `\n${failures} isolation check(s) FAILED.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error("Isolation check failed to run:", error.message);
  process.exitCode = 1;
});
