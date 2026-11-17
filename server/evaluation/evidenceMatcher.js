import { normalizeText } from "./normalizeText.js";

/**
 * Find Qdrant chunks containing a source evidence passage.
 *
 * Evidence remains independent of chunk IDs.
 * Chunk IDs are derived from the current Qdrant index.
 */
export function matchEvidenceToChunks(evidence, chunks) {
  const evidenceText = normalizeText(evidence.text);

  if (!evidenceText) {
    return {
      status: "invalid_evidence",
      matches: [],
    };
  }

  // First, search chunks on the same source page.
  const pageCandidates = chunks.filter(
    (chunk) => chunk.pageNumber === evidence.page,
  );

  const matches = pageCandidates
    .filter((chunk) => normalizeText(chunk.content).includes(evidenceText))
    .map((chunk) => ({
      pointId: chunk.pointId,
      pageNumber: chunk.pageNumber,
      matchType: "exact",
    }));

  return {
    status: matches.length > 0 ? "exact_match" : "unmatched",
    matches,
  };
}
