import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { env } from '../config/env.js';
import { prisma } from '../prisma/prisma.js';
import { paletteSchema, themeSchema } from './appearance.js';

export const auth = betterAuth({
  basePath: '/api/auth',
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: env.FRONTEND_URLS,
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  user: {
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
    minPasswordLength: 8,
  },
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
