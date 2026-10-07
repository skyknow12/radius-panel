import type { DataSource, ApiMeta } from '../types/api';

/** Standard success envelope: { data, meta }. */
export function envelope<T>(data: T, source: DataSource, extra: Partial<ApiMeta> = {}) {
  return {
    data,
    meta: {
      source,
      generatedAt: new Date().toISOString(),
      ...extra,
    } satisfies ApiMeta,
  };
}

/** Combine the sources of multiple sections into a single top-level source. */
export function combineSources(sources: DataSource[]): DataSource {
  const unique = new Set(sources);
  if (unique.size === 1) return sources[0] ?? 'demo';
  return 'mixed';
}
