import type { Clock } from '../../../shared/clock';
import type { RefreshTokenRepository, SecureTokenGenerator } from './ports';

export class LogoutSession {
  constructor(
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly generator: SecureTokenGenerator,
    private readonly clock: Clock,
  ) {}

  /** Idempotent: unknown or already revoked tokens are ignored. */
  async execute(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    const record = await this.refreshTokens.findByHash(this.generator.hash(refreshToken));
    if (record) await this.refreshTokens.revokeFamily(record.familyId, this.clock.now());
  }
}
