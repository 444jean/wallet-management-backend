import { describe, expect, it } from 'vitest';
import { redact, redactString } from './redact.js';

describe('redact', () => {
  it('masks sensitive keys at any depth', () => {
    expect(
      redact({
        email: 'ana@test.cl',
        password: 'Mi-Billetera-2026',
        nested: { headers: { Authorization: 'Bearer abc', Cookie: 'x=1' } },
        list: [{ token: 't1' }],
      }),
    ).toEqual({
      email: 'ana@test.cl',
      password: '[REDACTED]',
      nested: { headers: { Authorization: '[REDACTED]', Cookie: '[REDACTED]' } },
      list: [{ token: '[REDACTED]' }],
    });
  });

  it('masks secrets inside strings', () => {
    expect(redactString('{"email":"a@b.cl","password":"Secreta#123"}')).toBe(
      '{"email":"a@b.cl","password":"[REDACTED]"}',
    );
    expect(redactString('GET /api/auth/reset-password?token=abc123&x=1')).toBe(
      'GET /api/auth/reset-password?token=[REDACTED]&x=1',
    );
    expect(redactString('Authorization: Bearer eyJhbGciOi.payload.sig')).toBe(
      'Authorization: [REDACTED]',
    );
    expect(redactString('cookie: better-auth.session_token=xyz')).toBe(
      'cookie: [REDACTED]',
    );
  });

  it('keeps errors readable but redacted', () => {
    const err = redact(new Error('login failed for {"password":"p"}')) as Error;
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('login failed for {"password":"[REDACTED]"}');
  });

  it('leaves harmless values alone', () => {
    expect(redact('Nest application successfully started')).toBe(
      'Nest application successfully started',
    );
    expect(redact(42)).toBe(42);
  });
});
