// Client-side sparse (keyword) vectors. Qdrant applies IDF weighting to the
// stored term frequencies (collection modifier "idf"), giving BM25-style scoring.

const STOPWORDS = new Set(
  `a an and are as at be but by for from has have how i if in into is it its of on or that the their then there these this to was what when where which who why will with you your can do does not so than too very`.split(
    /\s+/,
  ),
);

const K1 = 1.2;

export function tokenize(text) {
  return (String(text).toLowerCase().match(/[a-z0-9_]+/g) ?? []).filter(
    (token) => token.length > 1 && !STOPWORDS.has(token),
  );
}

// FNV-1a, 32-bit, unsigned (Qdrant sparse indices are u32).
function hashToken(token) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < token.length; i++) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// Documents get a saturating term frequency; queries weight each unique term 1.
export function sparseVector(text, { query = false } = {}) {
  const counts = new Map();
  for (const token of tokenize(text)) {
    const index = hashToken(token);
    counts.set(index, (counts.get(index) ?? 0) + 1);
  }

  const indices = [...counts.keys()];
  const values = indices.map((index) => {
    const tf = counts.get(index);
    return query ? 1 : (tf * (K1 + 1)) / (tf + K1);
  });
  return { indices, values };
}
