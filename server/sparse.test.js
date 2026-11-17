import test from "node:test";
import assert from "node:assert/strict";

import { tokenize, sparseVector } from "./sparse.js";

test("tokenize lowercases, keeps identifiers, drops stopwords and 1-char tokens", () => {
  assert.deepEqual(tokenize("How do I use writeFileSync in a script?"), [
    "use",
    "writefilesync",
    "script",
  ]);
  assert.deepEqual(tokenize("npm_install v2"), ["npm_install", "v2"]);
});

test("query vectors weight each unique term 1", () => {
  const { indices, values } = sparseVector("npm npm install", { query: true });
  assert.equal(indices.length, 2);
  assert.deepEqual(values, [1, 1]);
});

test("document term frequency saturates below k1 + 1 and grows with count", () => {
  const once = sparseVector("promise").values[0];
  const many = sparseVector("promise promise promise promise promise promise").values[0];
  assert.ok(many > once);
  assert.ok(many < 2.2);
});

test("the same term maps to the same index in documents and queries", () => {
  const doc = sparseVector("setTimeout runs later");
  const query = sparseVector("settimeout", { query: true });
  assert.ok(doc.indices.includes(query.indices[0]));
});
