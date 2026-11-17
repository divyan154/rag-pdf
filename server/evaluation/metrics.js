// ranked: point ids, best first. evidenceGold: one array of acceptable point ids per evidence passage.

export function firstGoldRank(ranked, evidenceGold) {
  const gold = new Set(evidenceGold.flat());
  const index = ranked.findIndex((id) => gold.has(id));
  return index === -1 ? null : index + 1;
}

export function scoreAtK(ranked, evidenceGold, k) {
  const top = new Set(ranked.slice(0, k));
  const covered = evidenceGold.filter((ids) => ids.some((id) => top.has(id)));

  return {
    hit: covered.length > 0 ? 1 : 0,
    evidenceRecall: covered.length / evidenceGold.length,
    fullCoverage: covered.length === evidenceGold.length ? 1 : 0,
  };
}

export function reciprocalRank(rank) {
  return rank === null ? 0 : 1 / rank;
}

export function mean(values) {
  return values.length === 0
    ? null
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}
