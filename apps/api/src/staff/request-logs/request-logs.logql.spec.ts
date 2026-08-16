import {
  buildRequestLogsLogql,
  escapeLogqlRegexp,
  escapeLogqlString,
} from './request-logs.logql';

const HTTP_LINE = '{service="api"} |= "\\"req\\":" |= "\\"res\\":"';

describe('buildRequestLogsLogql', () => {
  it('selects HTTP request lines before any user filters', () => {
    expect(buildRequestLogsLogql({})).toBe(HTTP_LINE);
  });

  it('keeps q as a line substring and path/requestId as json fields', () => {
    expect(
      buildRequestLogsLogql({
        q: 'overlap',
        requestId: 'abc-123',
        path: '/staff/reservations',
        app: 'pms',
        actor: 'rina',
        errorsOnly: true,
      }),
    ).toBe(
      `${HTTP_LINE} |= "overlap" |~ "\\"statusCode\\":[45][0-9]{2}" | json | app="pms" | actor =~ "(?i).*rina.*" | path =~ "(?i).*/staff/reservations.*" | requestId =~ "(?i).*abc-123.*"`,
    );
  });

  it('escapes quotes in user strings', () => {
    expect(escapeLogqlString('say "hi"')).toBe('say \\"hi\\"');
    expect(buildRequestLogsLogql({ q: 'say "hi"' })).toBe(
      `${HTTP_LINE} |= "say \\"hi\\""`,
    );
  });

  it('escapes regex metacharacters in actor', () => {
    expect(escapeLogqlRegexp('a.b')).toBe('a\\.b');
    expect(buildRequestLogsLogql({ actor: 'a.b' })).toBe(
      `${HTTP_LINE} | json | actor =~ "(?i).*a\\\\.b.*"`,
    );
  });
});
