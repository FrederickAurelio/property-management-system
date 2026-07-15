/** Thrown by FE clients when the API returns an error envelope or network fails. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly requestId?: string;

  constructor(input: {
    status: number;
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  }) {
    super(input.message);
    this.name = 'ApiError';
    this.status = input.status;
    this.code = input.code;
    this.details = input.details;
    this.requestId = input.requestId;
  }
}
