import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { env } from './config/env.js';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { safeLogger } from './common/safe-logger.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Better Auth needs the raw body; the auth module re-adds the JSON and
    // urlencoded parsers (1 MB limit) for every other route.
    bodyParser: false,
    logger: safeLogger,
  });

  configureApp(app);
  app.enableShutdownHooks();

  await app.listen(env.PORT);
}
// Not awaited: Vercel's launcher patches listen() to capture the server
// without ever calling its callback, and waits for this module's import to
// finish. A top-level await would deadlock until the function times out (T05).
bootstrap().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
