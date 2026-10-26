import { createHash, randomBytes } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import { jwtVerify, SignJWT } from 'jose';
import type {
  AccessTokenService,
  PasswordHasher,
  SecureTokenGenerator,
} from '../application/ports';

/** Argon2id with the OWASP recommended minimum parameters (19 MiB, 2 iterations, 1 lane). */
export class Argon2PasswordHasher implements PasswordHasher {
  private static readonly options = { memoryCost: 19_456, timeCost: 2, parallelism: 1 };

  hash(password: string): Promise<string> {
    return hash(password, Argon2PasswordHasher.options);
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    try {
      return await verify(passwordHash, password);
    } catch {
      return false;
    }
  }
}

const ISSUER = 'kanbanzin-api';
const AUDIENCE = 'kanbanzin-web';
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

export class JwtAccessTokenService implements AccessTokenService {
  private readonly key: Uint8Array;

  constructor(secret: string) {
    this.key = new TextEncoder().encode(secret);
  }

  async sign(userId: string): Promise<{ token: string; expiresInSeconds: number }> {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
      .sign(this.key);
    return { token, expiresInSeconds: ACCESS_TOKEN_TTL_SECONDS };
  }

  async verify(token: string): Promise<string | null> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        algorithms: ['HS256'],
        issuer: ISSUER,
        audience: AUDIENCE,
      });
      return payload.sub ?? null;
    } catch {
      return null;
    }
  }
}

/** 256-bit random tokens. Only their SHA-256 digest is ever stored. */
export class RandomTokenGenerator implements SecureTokenGenerator {
  generate(): { token: string; hash: string } {
    const token = randomBytes(32).toString('base64url');
    return { token, hash: this.hash(token) };
  }

  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
