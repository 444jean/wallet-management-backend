import { NestFactory } from '@nestjs/core';
import { env } from './config/env.js';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Better Auth needs the raw body; the auth module re-adds the JSON and
    // urlencoded parsers for every other route.
    bodyParser: false,
  });

  app.setGlobalPrefix('api');
  app.enableCors({ origin: env.FRONTEND_URLS, credentials: true });
  app.enableShutdownHooks();

  await app.listen(env.PORT);
}
await bootstrap();
