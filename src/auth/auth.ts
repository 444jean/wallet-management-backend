import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { haveIBeenPwned, twoFactor } from 'better-auth/plugins';
import { env } from '../config/env.js';
import { prisma } from '../prisma/prisma.js';
import { paletteSchema, themeSchema } from './appearance.js';
import {
  hashPassword,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  passwordPolicyError,
  verifyPassword,
} from './password.js';

/** Endpoints that set a password, and the body field that carries it. */
const PASSWORD_FIELDS: Record<string, string> = {
  '/sign-up/email': 'password',
  '/change-password': 'newPassword',
  '/reset-password': 'newPassword',
};

export const auth = betterAuth({
  basePath: '/api/auth',
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: env.FRONTEND_URLS,
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  user: {
    // Account deletion (POST /api/auth/delete-user). The front always sends
    // the password; every user-owned row goes with ON DELETE CASCADE.
    deleteUser: { enabled: true },
    // Appearance preferences (T08). They travel in the session and are
    // updated with authClient.updateUser().
    additionalFields: {
      palette: {
        type: 'string',
        required: false,
        defaultValue: 'purple',
        input: true,
        validator: { input: paletteSchema },
      },
      theme: {
        type: 'string',
        required: false,
        input: true,
        validator: { input: themeSchema },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: MIN_PASSWORD_LENGTH,
    maxPasswordLength: MAX_PASSWORD_LENGTH,
    password: { hash: hashPassword, verify: verifyPassword },
  },
  rateLimit: {
    // Also on in development, and stored in Postgres so the limit holds across
    // restarts and across the serverless instances in production (T05).
    enabled: true,
    storage: 'database',
    customRules: {
      '/sign-in/*': { window: 60, max: 5 },
      '/sign-up/*': { window: 60, max: 5 },
      '/change-password': { window: 60, max: 5 },
      '/delete-user': { window: 60, max: 5 },
    },
  },
  hooks: {
    // Digit + special character on every endpoint that sets a password.
    before: createAuthMiddleware(async (ctx) => {
      const field = PASSWORD_FIELDS[ctx.path];
      if (!field) return;
      const password: unknown = (ctx.body as Record<string, unknown> | undefined)?.[field];
      if (typeof password !== 'string') return; // Better Auth validates the body
      const message = passwordPolicyError(password);
      if (message) {
        throw new APIError('BAD_REQUEST', { message, code: 'PASSWORD_TOO_WEAK' });
      }
    }),
  },
  plugins: [
    // Optional 2FA: TOTP (authenticator app) + 10 backup codes. Enabling it
    // asks for the password and only takes effect after the first valid code.
    twoFactor({ issuer: 'Mi Billetera' }),
    // Rejects passwords found in public breaches (sign-up, change, reset).
    // k-anonymity: only 5 chars of the SHA-1 leave the server.
    haveIBeenPwned({
      customPasswordCompromisedMessage:
        'Esta contraseña aparece en filtraciones públicas. Elige otra.',
    }),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh once a day
  },
  advanced: {
    // Frontend and API may live on different sites in production.
    defaultCookieAttributes:
      env.NODE_ENV === 'production'
        ? { sameSite: 'none', secure: true }
        : undefined,
  },
});
