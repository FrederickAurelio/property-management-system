export type ApiMeta = {
  requestId?: string;
};

export type ApiSuccess<T> = {
  data: T;
  meta?: ApiMeta;
};

export type ApiErrorPayload = {
  code: string;
  message: string;
  details?: unknown;
};

export type ApiErrorBody = {
  error: ApiErrorPayload;
  meta?: ApiMeta;
};

/** True when a value is already a success envelope (avoid double-wrap). */
export function isApiSuccessEnvelope(
  value: unknown,
): value is ApiSuccess<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    Object.keys(value).every((key) => key === 'data' || key === 'meta')
  );
}
