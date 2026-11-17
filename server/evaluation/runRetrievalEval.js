import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";

import { retrieve, getCollectionName, EMBEDDING_MODEL, MODES } from "../retrieval.js";
import { firstGoldRank, scoreAtK, reciprocalRank, mean } from "./metrics.js";
import { DATASET_PATH, MAPPING_PATH, RESULTS_DIR, EVAL_USER_ID } from "./config.js";

// Usage: node evaluation/runRetrievalEval.js [--k 1,3,5,10] [--modes dense,sparse,hybrid]
function parseList(flag, fallback) {
  const at = process.argv.indexOf(flag);
  return at === -1 ? fallback : process.argv[at + 1].split(",");
}

function parseArgs() {
  const ks = [...new Set(parseList("--k", ["1", "3", "5", "10"]).map(Number))].sort((a, b) => a - b);
  const modes = parseList("--modes", MODES);

  if (ks.some((k) => !Number.isInteger(k) || k < 1)) throw new Error(`Invalid --k: ${ks}`);
  if (modes.some((m) => !MODES.includes(m))) throw new Error(`Invalid --modes: ${modes}`);
  return { ks, modes };
}

function summarize(rows, ks) {
  const summary = { questions: rows.length, mrr: mean(rows.map((r) => r.reciprocalRank)), atK: {} };
  for (const k of ks) {
    const scores = rows.map((r) => r.atK[k]);
    summary.atK[k] = {
      hitRate: mean(scores.map((s) => s.hit)),
      evidenceRecall: mean(scores.map((s) => s.evidenceRecall)),
      fullCoverage: mean(scores.map((s) => s.fullCoverage)),
    };
  }
  return summary;
}

const pct = (value) => (value == null ? "-" : `${(value * 100).toFixed(1)}%`);

async function main() {
  const { ks, modes } = parseArgs();
  const maxK = ks.at(-1);
  const focusK = ks.includes(3) ? 3 : ks[0];

  const dataset = JSON.parse(await fs.readFile(DATASET_PATH, "utf8"));
  const mapping = JSON.parse(await fs.readFile(MAPPING_PATH, "utf8"));
  const mappingByQuestion = new Map(mapping.map((m) => [m.questionId, m]));

  const rowsByMode = Object.fromEntries(modes.map((m) => [m, []]));
  const skipped = [];

  for (const question of dataset.questions) {
    const evidenceMappings = mappingByQuestion.get(question.id)?.evidenceMappings ?? [];
    const matched = evidenceMappings.filter((e) => e.status === "exact_match");

    if (matched.length === 0) {
      skipped.push({
        questionId: question.id,
        reason: evidenceMappings.length === 0 ? "no evidence (unanswerable)" : "no evidence mapped to a chunk",
      });
      continue;
    }

    const evidenceGold = matched.map((e) => e.matches.map((m) => m.pointId));
    const goldIds = new Set(evidenceGold.flat());

    for (const mode of modes) {
      const retrieved = await retrieve(question.question, maxK, { userId: EVAL_USER_ID, mode });
      const ranked = retrieved.map((r) => r.doc.id);
      const rank = firstGoldRank(ranked, evidenceGold);

      const atK = {};
      for (const k of ks) atK[k] = scoreAtK(ranked, evidenceGold, k);

      rowsByMode[mode].push({
        questionId: question.id,
        category: question.category ?? "uncategorized",
        document: question.document ?? null,
        question: question.question,
        goldPages: [...new Set(matched.flatMap((e) => e.matches.map((m) => m.pageNumber)))],
        firstGoldRank: rank,
        reciprocalRank: reciprocalRank(rank),
        atK,
        retrieved: retrieved.map((r, i) => ({
          rank: i + 1,
          pointId: r.doc.id,
          page: r.doc.metadata?.loc?.pageNumber ?? null,
          document: r.doc.metadata?.originalName ?? null,
          score: r.score,
          isGold: goldIds.has(r.doc.id),
        })),
      });
    }
  }

  const anyRows = Object.values(rowsByMode)[0];
  if (anyRows.length === 0) throw new Error("No scoreable questions. Run evaluation/runMapping.js first.");

  const categories = [...new Set(anyRows.map((r) => r.category))];
  const summary = Object.fromEntries(
    modes.map((mode) => [
      mode,
      {
        overall: summarize(rowsByMode[mode], ks),
        byCategory: Object.fromEntries(
          categories.map((c) => [c, summarize(rowsByMode[mode].filter((r) => r.category === c), ks)]),
        ),
      },
    ]),
  );

  console.log(`Collection: ${getCollectionName()} | user: ${EVAL_USER_ID} | embeddings: ${EMBEDDING_MODEL}`);
  console.log(`Scored ${anyRows.length} questions, skipped ${skipped.length}: ${skipped.map((s) => s.questionId).join(", ") || "none"}\n`);

  console.log("Hit rate by mode (any gold chunk in top k) and MRR:");
  console.table(
    Object.fromEntries(
      modes.map((mode) => [
        mode,
        {
          ...Object.fromEntries(ks.map((k) => [`@${k}`, pct(summary[mode].overall.atK[k].hitRate)])),
          MRR: summary[mode].overall.mrr.toFixed(3),
        },
      ]),
    ),
  );

  console.log(`Hit rate @${focusK} by category:`);
  console.table(
    Object.fromEntries(
      categories.map((c) => [
        `${c} (${summary[modes[0]].byCategory[c].questions})`,
        Object.fromEntries(modes.map((mode) => [mode, pct(summary[mode].byCategory[c].atK[focusK].hitRate)])),
      ]),
    ),
  );

  console.log(`Rank of first gold chunk (within top ${maxK}):`);
  console.table(
    anyRows.map((row, i) => ({
      id: row.questionId,
      category: row.category,
      ...Object.fromEntries(modes.map((mode) => [mode, rowsByMode[mode][i].firstGoldRank ?? `>${maxK}`])),
    })),
  );

  await fs.mkdir(RESULTS_DIR, { recursive: true });
  const outFile = path.join(RESULTS_DIR, `retrieval_${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  await fs.writeFile(
    outFile,
    JSON.stringify(
      {
        runAt: new Date().toISOString(),
        collection: getCollectionName(),
        userId: EVAL_USER_ID,
        embeddingModel: EMBEDDING_MODEL,
        datasetPath: DATASET_PATH,
        mappingPath: MAPPING_PATH,
        ks,
        modes,
        summary,
        skipped,
        questions: rowsByMode,
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log(`Saved: ${outFile}`);
}

main().catch((error) => {
  console.error("Retrieval eval failed:", error);
  process.exitCode = 1;
});
