import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Migrations need a session-level connection (Supabase direct or session
    // pooler); the app itself connects with DATABASE_URL (src/prisma/prisma.ts).
    url: process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'],
  },
});
