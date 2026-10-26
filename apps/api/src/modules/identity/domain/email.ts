import { ValidationError } from '../../../shared/errors';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;

/** Returns the canonical (trimmed, lower-cased) form of an e-mail or throws. */
export function normalizeEmail(raw: string): string {
  const email = raw.trim().toLowerCase();
  if (email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    throw new ValidationError('invalid_email', 'Enter a valid e-mail address.');
  }
  return email;
}
