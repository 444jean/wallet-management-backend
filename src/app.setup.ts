import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';
import { env } from './config/env.js';

/**
 * HTTP setup shared by main.ts and the e2e tests, so tests exercise the same
 * pipeline as production.
 */
export function configureApp(app: NestExpressApplication) {
  app.setGlobalPrefix('api');
  // Security headers (T03). The API only serves JSON.
  app.use(helmet());
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);
  app.enableCors({ origin: env.FRONTEND_URLS, credentials: true });
  app.useGlobalFilters(new AllExceptionsFilter(app.getHttpAdapter()));
  return app;
}
