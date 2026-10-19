import { type Algorithm, hash, verify } from '@node-rs/argon2';
import { verifyPassword as verifyScrypt } from 'better-auth/crypto';

/** Password length policy, shared by Better Auth and the frontend form. */
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;

/**
 * Composition rules (user request): at least one digit and one special
 * character (anything that is not a letter, digit or whitespace). Length is
 * enforced by Better Auth itself. Keep in sync with the frontend checklist
 * (src/lib/password-policy.ts).
 */
export function passwordPolicyError(password: string): string | null {
  if (!/\d/.test(password)) return 'La contraseña debe incluir al menos un número.';
  if (!/[^\p{L}\p{N}\s]/u.test(password)) {
    return 'La contraseña debe incluir al menos un carácter especial.';
  }
  return null;
}

/**
 * Argon2id with the OWASP minimum (19 MiB, 2 iterations, 1 lane). The PHC
 * string stores the parameters, so raising them later keeps old hashes valid.
 */
const ARGON2_OPTIONS = {
  // Algorithm.Argon2id: a const enum, not usable as a value with isolatedModules.
  algorithm: 2 as Algorithm.Argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

/**
 * Verifies Argon2id hashes and, for accounts created before T02, Better Auth's
 * default scrypt hashes ("salt:key"). Those users keep signing in normally.
 */
export function verifyPassword({
  hash: stored,
  password,
}: {
  hash: string;
  password: string;
}): Promise<boolean> {
  if (stored.startsWith('$argon2')) return verify(stored, password);
  return verifyScrypt({ hash: stored, password });
}
