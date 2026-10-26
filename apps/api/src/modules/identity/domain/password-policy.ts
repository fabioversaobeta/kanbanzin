import { ValidationError } from '../../../shared/errors';

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

const COMMON_PASSWORDS = new Set([
  '1234567890',
  '12345678910',
  '0123456789',
  'qwertyuiop',
  'qwerty12345',
  'password12',
  'password123',
  'password1234',
  'passw0rd123',
  'senha12345',
  'senha123456',
  'brasil12345',
  'abc1234567',
  'iloveyou123',
  'admin12345',
  'letmein1234',
  'welcome1234',
  '1q2w3e4r5t',
]);

export interface PasswordContext {
  email?: string;
  name?: string;
}

/** Enforces the password rules recommended by NIST SP 800-63B (length first, no composition rules). */
export function assertStrongPassword(password: string, context: PasswordContext = {}): void {
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new ValidationError(
      'weak_password',
      `Password must have at least ${PASSWORD_MIN_LENGTH} characters.`,
    );
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    throw new ValidationError(
      'weak_password',
      `Password must have at most ${PASSWORD_MAX_LENGTH} characters.`,
    );
  }
  const lowered = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lowered) || new Set(lowered).size < 4) {
    throw new ValidationError('weak_password', 'This password is too common or too simple.');
  }
  const localPart = context.email?.split('@')[0];
  if (localPart && localPart.length >= 4 && lowered.includes(localPart.toLowerCase())) {
    throw new ValidationError('weak_password', 'Password must not contain your e-mail.');
  }
}
