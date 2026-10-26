import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Container } from '../../container';
import { UnauthorizedError } from '../../shared/errors';

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by `authenticate` on protected routes. */
    userId: string;
  }
}

export function createAuthenticate(container: Pick<Container, 'accessTokens'>) {
  return async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const userId = token ? await container.accessTokens.verify(token) : null;
    if (!userId) throw new UnauthorizedError();
    request.userId = userId;
  };
}
