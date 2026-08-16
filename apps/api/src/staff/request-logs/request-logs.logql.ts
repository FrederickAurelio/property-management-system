export function escapeLogqlString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/** Escape a user string for a LogQL regular expression (not a quoted line filter). */
export function escapeLogqlRegexp(value: string): string {
  return value.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
}

export type RequestLogsLogqlFilters = {
  q?: string;
  requestId?: string;
  path?: string;
  app?: 'pms' | 'web';
  actor?: string;
  errorsOnly?: boolean;
};

function pushLineFilter(parts: string[], raw: string | undefined): void {
  const value = raw?.trim();
  if (!value) {
    return;
  }
  parts.push(`|= "${escapeLogqlString(value)}"`);
}

function pushJsonRegexField(
  matchers: string[],
  field: string,
  raw: string | undefined,
): void {
  const value = raw?.trim();
  if (!value) {
    return;
  }
  const re = `(?i).*${escapeLogqlRegexp(value)}.*`;
  matchers.push(`${field} =~ "${escapeLogqlString(re)}"`);
}

/**
 * HTTP request lines only (`req` + `res` objects) before Loki `limit`.
 * Nest Logger / iCal cron stay in Docker; they must not fill the newest-500.
 */
export function buildRequestLogsLogql(
  filters: RequestLogsLogqlFilters,
): string {
  const parts = ['{service="api"}', '|= "\\"req\\":"', '|= "\\"res\\":"'];
  pushLineFilter(parts, filters.q);
  if (filters.errorsOnly) {
    // Line regex — independent of Loki `| json` flatten names.
    parts.push('|~ "\\"statusCode\\":[45][0-9]{2}"');
  }

  const jsonMatchers: string[] = [];
  if (filters.app) {
    jsonMatchers.push(`app="${escapeLogqlString(filters.app)}"`);
  }
  pushJsonRegexField(jsonMatchers, 'actor', filters.actor);
  pushJsonRegexField(jsonMatchers, 'path', filters.path);
  pushJsonRegexField(jsonMatchers, 'requestId', filters.requestId);
  if (jsonMatchers.length > 0) {
    parts.push('| json');
    for (const matcher of jsonMatchers) {
      parts.push('|');
      parts.push(matcher);
    }
  }

  return parts.join(' ');
}
