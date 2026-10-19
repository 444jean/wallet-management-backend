/** Keys whose values never reach the logs (case-insensitive). */
const SENSITIVE_KEYS = new Set(
  [
    'password',
    'currentPassword',
    'newPassword',
    'token',
    'accessToken',
    'refreshToken',
    'idToken',
    'secret',
    'backupCodes',
    'cookie',
    'set-cookie',
    'authorization',
  ].map((k) => k.toLowerCase()),
);

const MASK = '[REDACTED]';

const STRING_RULES: [RegExp, string][] = [
  // JSON fragments: "password":"..."
  [
    /("(?:password|currentPassword|newPassword|token|accessToken|refreshToken|idToken|secret|cookie|authorization)"\s*:\s*)"(?:[^"\\]|\\.)*"/gi,
    `$1"${MASK}"`,
  ],
  // Query strings: ?token=...&code=...
  [/\b(password|token|secret|code)=[^&\s"']+/gi, `$1=${MASK}`],
  // Authorization headers.
  [/\b(Bearer|Basic)\s+[\w.~+/=-]+/gi, `$1 ${MASK}`],
  // Raw header lines.
  [/\b((?:set-)?cookie|authorization)(\s*[:=]\s*)[^\n]+/gi, `$1$2${MASK}`],
];

export function redactString(value: string): string {
  return STRING_RULES.reduce((s, [re, to]) => s.replace(re, to), value);
}

/**
 * Copy of `value` safe to log: sensitive keys masked at any depth, secrets
 * inside strings masked. Errors keep their message and stack (redacted).
 */
export function redact(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return redactString(value);
  if (value === null || typeof value !== 'object' || depth > 6) return value;
  if (value instanceof Error) {
    const copy = new Error(redactString(value.message));
    copy.name = value.name;
    copy.stack = value.stack && redactString(value.stack);
    return copy;
  }
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [
      k,
      SENSITIVE_KEYS.has(k.toLowerCase()) ? MASK : redact(v, depth + 1),
    ]),
  );
}
