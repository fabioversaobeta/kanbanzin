import { randomUUID } from 'node:crypto';
import type { Clock } from '../../../shared/clock';
import type { AccessTokenService, RefreshTokenRepository, SecureTokenGenerator } from './ports';

export const REFRESH_TOKEN_TTL_DAYS = 30;

export interface SessionTokens {
  accessToken: string;
  accessTokenExpiresInSeconds: number;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

/** Creates the access/refresh token pair that represents an authenticated session. */
export class SessionIssuer {
  constructor(
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly accessTokens: AccessTokenService,
    private readonly generator: SecureTokenGenerator,
    private readonly clock: Clock,
  ) {}

  /** `familyId` links rotated refresh tokens so that a reuse can revoke the whole chain. */
  async issue(userId: string, familyId: string = randomUUID()): Promise<SessionTokens> {
    const now = this.clock.now();
    const refreshTokenExpiresAt = new Date(now.getTime() + REFRESH_TOKEN_TTL_DAYS * 86_400_000);
    const refresh = this.generator.generate();
    await this.refreshTokens.create({
      id: randomUUID(),
      userId,
      familyId,
      tokenHash: refresh.hash,
      expiresAt: refreshTokenExpiresAt,
      revokedAt: null,
    });
    const access = await this.accessTokens.sign(userId);
    return {
      accessToken: access.token,
      accessTokenExpiresInSeconds: access.expiresInSeconds,
      refreshToken: refresh.token,
      refreshTokenExpiresAt,
    };
  }
}
