import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";

import { retrieve, DEFAULT_K, DEFAULT_MODE, getCollectionName, EMBEDDING_MODEL } from "../retrieval.js";
import { qdrantClient } from "../config/qdrant.js";
import { generateAnswer, buildContext, isAbstention, GENERATION_MODEL } from "../generation.js";
import { judgeCorrectness, judgeFaithfulness, isAuthError, JUDGE_MODEL } from "./judge.js";
import { mean } from "./metrics.js";
import { DATASET_PATH, MAPPING_PATH, RESULTS_DIR, EVAL_USER_ID } from "./config.js";

const GENERATOR_OPTIONS = {}; // Haiku 5.5 rejects non-default temperature

// Usage: node evaluation/runGenerationEval.js [--mode retrieved|oracle|both] [--no-judge]
// Defaults to "retrieved" only; "oracle" and "both" double the generations and judge calls.
//   retrieved: real retrieval, end to end.
//   oracle:    gold chunks from the mapping, which isolates the generator.
function parseArgs() {
  const args = process.argv.slice(2);
  const modeFlag = args.indexOf("--mode");
  const mode = modeFlag === -1 ? "retrieved" : args[modeFlag + 1];

  if (!["retrieved", "oracle", "both"].includes(mode)) {
    throw new Error(`Invalid --mode value: ${mode}`);
  }
  return {
    modes: mode === "both" ? ["retrieved", "oracle"] : [mode],
    judging: !args.includes("--no-judge"),
  };
}

async function fetchGoldDocs(pointIds) {
  const points = await qdrantClient.retrieve(getCollectionName(), {
    ids: pointIds,
    with_payload: true,
  });
  return points.map((p) => ({ pageContent: p.payload.content, metadata: p.payload.metadata }));
}

async function scoreCase(question, mode, docs, judging) {
  const answer = await generateAnswer(question.question, docs);
  const abstained = isAbstention(answer);
  const row = {
    questionId: question.id,
    mode,
    answerable: question.answerable !== false,
    answer,
    abstained,
    contextPages: docs.map((d) => d.metadata?.loc?.pageNumber ?? null),
  };

  if (!row.answerable) {
    row.abstentionCorrect = abstained;
    return row;
  }
  if (abstained) {
    row.correctness = { verdict: "abstained", reason: "Model replied I don't know." };
    return row;
  }
  if (!judging) return row;

  try {
    const [correctness, faithfulness] = await Promise.all([
      judgeCorrectness({
        question: question.question,
        expectedAnswer: question.expected_answer,
        answer,
      }),
      judgeFaithfulness({
        question: question.question,
        contextText: buildContext(docs),
        answer,
      }),
    ]);
    const supported = faithfulness.claims.filter((c) => c.supported).length;

    row.correctness = correctness;
    row.faithfulness = {
      ...faithfulness,
      score: faithfulness.claims.length === 0 ? null : supported / faithfulness.claims.length,
    };
  } catch (error) {
    if (isAuthError(error)) {
      throw new Error(
        "Judge could not authenticate. Set ANTHROPIC_API_KEY in server/.env, or run with --no-judge.",
      );
    }
    row.judgeError = error.message;
  }
  return row;
}

function summarize(rows) {
  const answerable = rows.filter((r) => r.answerable);
  const unanswerable = rows.filter((r) => !r.answerable);
  const scored = answerable.filter((r) => !r.judgeError);
  const count = (verdict) => scored.filter((r) => r.correctness?.verdict === verdict).length;

  return {
    answerable: answerable.length,
    falseRefusalRate: answerable.length ? count("abstained") / answerable.length : null,
    correctness: scored.some((r) => r.correctness)
      ? {
          correct: count("correct"),
          partial: count("partial"),
          incorrect: count("incorrect"),
          abstained: count("abstained"),
          correctRate: count("correct") / scored.length,
        }
      : null,
    faithfulness: mean(rows.map((r) => r.faithfulness?.score).filter((s) => s != null)),
    unanswerable: unanswerable.length,
    abstentionAccuracy: unanswerable.length
      ? mean(unanswerable.map((r) => (r.abstentionCorrect ? 1 : 0)))
      : null,
    judgeErrors: rows.filter((r) => r.judgeError).length,
  };
}

const pct = (value) => (value == null ? "-" : `${(value * 100).toFixed(0)}%`);

function diagnose(retrievedRow, oracleRow) {
  const ok = (r) => r?.correctness?.verdict === "correct";
  if (!retrievedRow?.correctness || !oracleRow?.correctness) return "";
  if (ok(retrievedRow)) return ok(oracleRow) ? "ok" : "ok (lucky)";
  return ok(oracleRow) ? "retrieval" : "generation";
}

async function main() {
  const { modes, judging } = parseArgs();

  const dataset = JSON.parse(await fs.readFile(DATASET_PATH, "utf8"));
  const mapping = JSON.parse(await fs.readFile(MAPPING_PATH, "utf8"));
  const mappingByQuestion = new Map(mapping.map((m) => [m.questionId, m]));

  const rows = [];

  for (const question of dataset.questions) {
    const goldIds = [
      ...new Set(
        (mappingByQuestion.get(question.id)?.evidenceMappings ?? [])
          .filter((e) => e.status === "exact_match")
          .flatMap((e) => e.matches.map((m) => m.pointId)),
      ),
    ];

    for (const mode of modes) {
      if (mode === "oracle" && (question.answerable === false || goldIds.length === 0)) continue;

      const docs =
        mode === "retrieved"
          ? (await retrieve(question.question, DEFAULT_K, { userId: EVAL_USER_ID, mode: DEFAULT_MODE })).map((r) => r.doc)
          : await fetchGoldDocs(goldIds);

      console.log(`${question.id} [${mode}] ...`);
      rows.push(await scoreCase(question, mode, docs, judging));
    }
  }

  const summaries = Object.fromEntries(
    modes.map((mode) => [mode, summarize(rows.filter((r) => r.mode === mode))]),
  );

  console.log(
    `\nGenerator: ${GENERATION_MODEL} | judge: ${judging ? JUDGE_MODEL : "off"} | retrieval=${DEFAULT_MODE} k=${DEFAULT_K} | embeddings: ${EMBEDDING_MODEL}`,
  );

  console.table(
    Object.fromEntries(
      modes.map((mode) => {
        const s = summaries[mode];
        return [
          mode,
          {
            "correct rate": pct(s.correctness?.correctRate),
            "false refusal": pct(s.falseRefusalRate),
            faithfulness: pct(s.faithfulness),
            "abstains on unanswerable": pct(s.abstentionAccuracy),
            "judge errors": s.judgeErrors,
          },
        ];
      }),
    ),
  );

  const questionIds = [...new Set(rows.map((r) => r.questionId))];
  console.table(
    questionIds.map((id) => {
      const byMode = Object.fromEntries(rows.filter((r) => r.questionId === id).map((r) => [r.mode, r]));
      const cell = (r) =>
        !r
          ? "-"
          : r.judgeError
            ? "judge error"
            : (r.correctness?.verdict ?? (r.answerable ? "(unjudged)" : r.abstentionCorrect ? "abstained ok" : "answered"));
      return {
        id,
        retrieved: cell(byMode.retrieved),
        "retrieved faithful": pct(byMode.retrieved?.faithfulness?.score),
        oracle: cell(byMode.oracle),
        "oracle faithful": pct(byMode.oracle?.faithfulness?.score),
        diagnosis: diagnose(byMode.retrieved, byMode.oracle),
      };
    }),
  );

  rows
    .filter((r) => r.correctness && !["correct"].includes(r.correctness.verdict))
    .forEach((r) => console.log(`  ${r.questionId} [${r.mode}] ${r.correctness.verdict}: ${r.correctness.reason}`));
  rows
    .filter((r) => r.judgeError)
    .forEach((r) => console.log(`  ${r.questionId} [${r.mode}] judge error: ${r.judgeError}`));

  await fs.mkdir(RESULTS_DIR, { recursive: true });
  const outFile = path.join(
    RESULTS_DIR,
    `generation_${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  );
  await fs.writeFile(
    outFile,
    JSON.stringify(
      {
        runAt: new Date().toISOString(),
        collection: getCollectionName(),
        embeddingModel: EMBEDDING_MODEL,
        generationModel: GENERATION_MODEL,
        generatorOptions: GENERATOR_OPTIONS,
        judgeModel: judging ? JUDGE_MODEL : null,
        k: DEFAULT_K,
        retrievalMode: DEFAULT_MODE,
        userId: EVAL_USER_ID,
        modes,
        summary: summaries,
        rows,
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log(`\nSaved: ${outFile}`);
}

main().catch((error) => {
  console.error("Generation eval failed:", error.message);
  process.exitCode = 1;
});
