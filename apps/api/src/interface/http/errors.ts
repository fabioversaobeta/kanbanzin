import type { FastifyError, FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { AppError, type ErrorKind } from '../../shared/errors';

const STATUS_BY_KIND: Record<ErrorKind, number> = {
  validation: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
};

interface ErrorBody {
  error: { code: string; message: string; issues?: { path: string; message: string }[] };
}

/** Maps domain errors to HTTP responses and hides internals for anything unexpected. */
export function registerErrorHandling(app: FastifyInstance): void {
  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({ error: { code: 'not_found', message: 'Route not found.' } });
  });

  app.setErrorHandler((error: FastifyError | Error, request, reply) => {
    if (error instanceof AppError) {
      const body: ErrorBody = { error: { code: error.code, message: error.message } };
      return reply.status(STATUS_BY_KIND[error.kind]).send(body);
    }
    if (error instanceof ZodError) {
      const body: ErrorBody = {
        error: {
          code: 'invalid_request',
          message: 'The request is invalid.',
          issues: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      };
      return reply.status(400).send(body);
    }

    const statusCode = (error as FastifyError).statusCode;
    if (statusCode && statusCode >= 400 && statusCode < 500) {
      return reply.status(statusCode).send({
        error: {
          code: (error as FastifyError).code ?? 'bad_request',
          message: 'The request could not be processed.',
        },
      });
    }

    request.log.error({ err: error }, 'Unhandled error');
    return reply
      .status(500)
      .send({ error: { code: 'internal_error', message: 'Something went wrong.' } });
  });
}
