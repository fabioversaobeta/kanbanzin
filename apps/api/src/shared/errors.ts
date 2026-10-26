export type ErrorKind =
  'validation' | 'unauthorized' | 'forbidden' | 'not_found' | 'conflict' | 'rate_limited';

/** Base class for every expected (non-bug) failure raised by the domain and application layers. */
export class AppError extends Error {
  constructor(
    readonly kind: ErrorKind,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(code: string, message: string) {
    super('validation', code, message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(code = 'unauthorized', message = 'Authentication required.') {
    super('unauthorized', code, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(code = 'forbidden', message = 'You are not allowed to perform this action.') {
    super('forbidden', code, message);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super('not_found', 'not_found', `${resource} not found.`);
  }
}

export class ConflictError extends AppError {
  constructor(code: string, message: string) {
    super('conflict', code, message);
  }
}

export class RateLimitedError extends AppError {
  constructor(code = 'rate_limited', message = 'Too many attempts. Try again later.') {
    super('rate_limited', code, message);
  }
}
