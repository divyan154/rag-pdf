import test from "node:test";
import assert from "node:assert/strict";

import { firstGoldRank, scoreAtK, reciprocalRank, mean } from "./metrics.js";

test("firstGoldRank is 1-based and null when nothing matches", () => {
  assert.equal(firstGoldRank(["a", "b", "c"], [["c"]]), 3);
  assert.equal(firstGoldRank(["a", "b", "c"], [["x"], ["b"]]), 2);
  assert.equal(firstGoldRank(["a", "b"], [["z"]]), null);
});

test("scoreAtK counts an evidence as covered when any of its chunks is in top k", () => {
  const gold = [["a", "a2"], ["d"]];
  assert.deepEqual(scoreAtK(["x", "a2", "d"], gold, 1), {
    hit: 0,
    evidenceRecall: 0,
    fullCoverage: 0,
  });
  assert.deepEqual(scoreAtK(["x", "a2", "d"], gold, 2), {
    hit: 1,
    evidenceRecall: 0.5,
    fullCoverage: 0,
  });
  assert.deepEqual(scoreAtK(["x", "a2", "d"], gold, 3), {
    hit: 1,
    evidenceRecall: 1,
    fullCoverage: 1,
  });
});

test("reciprocalRank and mean", () => {
  assert.equal(reciprocalRank(null), 0);
  assert.equal(reciprocalRank(4), 0.25);
  assert.equal(mean([]), null);
  assert.equal(mean([1, 0]), 0.5);
});
