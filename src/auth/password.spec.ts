import { hashPassword as scryptHash } from 'better-auth/crypto';
import { describe, expect, it } from 'vitest';
import {
  hashPassword,
  passwordPolicyError,
  verifyPassword,
} from './password.js';

describe('password policy', () => {
  it('requires a digit', () => {
    expect(passwordPolicyError('sin-numeros-aqui')).toMatch(/número/);
  });

  it('requires a special character', () => {
    expect(passwordPolicyError('sinEspeciales123')).toMatch(/especial/);
    expect(passwordPolicyError('con espacio 123')).toMatch(/especial/);
    expect(passwordPolicyError('ñandúÁrbol12345')).toMatch(/especial/);
  });

  it('accepts a digit plus a special character', () => {
    expect(passwordPolicyError('Mi-Billetera-2026')).toBeNull();
    expect(passwordPolicyError('clave.segura9')).toBeNull();
  });
});

describe('password hashing', () => {
  it('hashes with Argon2id and OWASP parameters', async () => {
    const stored = await hashPassword('correct horse battery');
    expect(stored).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  });

  it('verifies Argon2id hashes', async () => {
    const stored = await hashPassword('correct horse battery');
    await expect(
      verifyPassword({ hash: stored, password: 'correct horse battery' }),
    ).resolves.toBe(true);
    await expect(
      verifyPassword({ hash: stored, password: 'wrong horse battery' }),
    ).resolves.toBe(false);
  });

  it('still verifies legacy scrypt hashes', async () => {
    const stored = await scryptHash('legacy password 1');
    await expect(
      verifyPassword({ hash: stored, password: 'legacy password 1' }),
    ).resolves.toBe(true);
    await expect(
      verifyPassword({ hash: stored, password: 'nope' }),
    ).resolves.toBe(false);
  });
});
