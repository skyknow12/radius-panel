/**
 * Application error carrying an HTTP status and a stable machine-readable code.
 * Thrown from services / middleware and rendered by the error handler.
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }

  static badRequest(message = 'Bad request', details?: unknown) {
    return new HttpError(400, 'BAD_REQUEST', message, details);
  }
  static unauthorized(message = 'Authentication required') {
    return new HttpError(401, 'UNAUTHORIZED', message);
  }
  static forbidden(message = 'You do not have permission to perform this action') {
    return new HttpError(403, 'FORBIDDEN', message);
  }
  static notFound(message = 'Resource not found') {
    return new HttpError(404, 'NOT_FOUND', message);
  }
  static tooMany(message = 'Too many requests, please try again later') {
    return new HttpError(429, 'RATE_LIMITED', message);
  }
}
