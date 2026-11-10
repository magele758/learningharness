export function searchSources(sources, query, limit = 3) {
  const terms = String(query).toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  return sources
    .map((source) => {
      const haystack = `${source.title}\n${source.text}`.toLowerCase();
      const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
      return { source, score };
    })
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score || a.source.title.localeCompare(b.source.title))
    .slice(0, limit);
}
