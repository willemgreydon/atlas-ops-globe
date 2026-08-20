import { IdOf } from "./ids";

/**
 * Lightweight, explainable news-story clustering. Groups articles by headline
 * token overlap (Jaccard) so multiple reports of the same event share a story.
 * Deliberately conservative — we track source lineage rather than manufacture
 * false consensus from repeated wire copy. Semantic/entity clustering is a
 * future upgrade; this heuristic is documented in intelligence/news/README.md.
 */
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with", "as", "at",
  "by", "from", "is", "are", "be", "after", "over", "amid", "says", "say", "new",
  "up", "out", "his", "her", "its", "into", "how", "why", "what",
]);

export function titleTokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOPWORDS.has(t)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

export interface StoryAssignment {
  storyId: string;
  articleIndices: number[];
}

/** Assign each article (by index) to a story cluster. Threshold ~0.5 Jaccard. */
export function clusterStories(titles: string[], threshold = 0.5): Map<number, string> {
  const tokens = titles.map(titleTokens);
  const clusters: { key: string; tokens: Set<string>; members: number[] }[] = [];
  const assignment = new Map<number, string>();

  for (let i = 0; i < titles.length; i++) {
    let best: (typeof clusters)[number] | null = null;
    let bestScore = threshold;
    for (const c of clusters) {
      const s = jaccard(tokens[i], c.tokens);
      if (s >= bestScore) { bestScore = s; best = c; }
    }
    if (best) {
      best.members.push(i);
      assignment.set(i, IdOf.story(best.key));
    } else {
      const key = `${titles[i]}#${i}`;
      clusters.push({ key, tokens: tokens[i], members: [i] });
      assignment.set(i, IdOf.story(key));
    }
  }
  return assignment;
}
