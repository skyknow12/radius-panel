import type { DataSource, ApiMeta } from '../types/api';

/** Standard success envelope: { data, meta }. */
export function envelope<T>(
  data: T,
  sourceOrExtra: DataSource | Partial<ApiMeta> = 'live',
  extra: Partial<ApiMeta> = {}
) {
  let source: DataSource = 'live';
  let metaExtra: Partial<ApiMeta> = extra;

  if (typeof sourceOrExtra === 'string') {
    source = sourceOrExtra;
  } else if (sourceOrExtra && typeof sourceOrExtra === 'object') {
    metaExtra = { ...sourceOrExtra, ...extra };
  }

  return {
    success: true,
    data,
    meta: {
      source,
      generatedAt: new Date().toISOString(),
      ...metaExtra,
    } satisfies ApiMeta,
  };
}

/** Combine the sources of multiple sections into a single top-level source. */
export function combineSources(sources: DataSource[]): DataSource {
  const unique = new Set(sources);
  if (unique.size === 1) return sources[0] ?? 'demo';
  return 'mixed';
}
