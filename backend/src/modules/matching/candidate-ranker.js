// Ranks matched candidates by suitability. The current matcher preserves the
// discovery order from the geo query — no re-ranking is applied yet.
const rankCandidates = (candidates) => candidates;

module.exports = { rankCandidates };