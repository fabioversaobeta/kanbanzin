import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Container } from '../../container';
import { PERSONAL_TOKEN_PREFIX } from '../../modules/access-tokens/application/personal-token-use-cases';
import { UnauthorizedError } from '../../shared/errors';

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by `authenticate` on protected routes. */
    userId: string;
  }
}

export interface AuthenticateOptions {
  /**
   * Accept only session JWTs, rejecting personal access tokens. Used for account management so
   * a leaked token can neither mint new tokens nor touch the account itself.
   */
  sessionOnly?: boolean;
}

export function createAuthenticate(
  container: Pick<Container, 'accessTokens' | 'personalTokens'>,
  options: AuthenticateOptions = {},
) {
  return async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
    let userId: string | null = null;
    if (token.startsWith(PERSONAL_TOKEN_PREFIX)) {
      if (!options.sessionOnly) userId = await container.personalTokens.authenticate.execute(token);
    } else if (token) {
      userId = await container.accessTokens.verify(token);
    }
    if (!userId) throw new UnauthorizedError();
    request.userId = userId;
  };
}
