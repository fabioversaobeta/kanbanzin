import { ValidationError } from '../../../shared/errors';

export const CURRENT_TERMS_VERSION = '2026-10-26';

export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MINUTES = 15;

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  termsVersion: string;
  termsAcceptedAt: Date;
  failedLoginCount: number;
  lockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Public projection of a user, safe to send to clients. */
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export function toProfile(user: User): UserProfile {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt.toISOString(),
  };
}

export function normalizeName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name.length < 1 || name.length > 80) {
    throw new ValidationError('invalid_name', 'Name must have between 1 and 80 characters.');
  }
  return name;
}

export function isLocked(user: Pick<User, 'lockedUntil'>, now: Date): boolean {
  return user.lockedUntil !== null && user.lockedUntil.getTime() > now.getTime();
}
