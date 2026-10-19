import { Controller, Get, Module } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { prisma } from './../src/prisma/prisma.js';

/** Routes that only exist in the tests, to exercise the error filter. */
@Controller('test')
class BoomController {
  @Get('boom')
  @AllowAnonymous()
  boom() {
    throw new Error('relation "secret_table" does not exist at /srv/app/x.ts');
  }
}

@Module({ controllers: [BoomController] })
class BoomModule {}

// Requires a reachable database and the env vars from the README.
// API_RATE_LIMIT is set low by the test command (see the e2e script).
describe('App (e2e)', () => {
  let app: NestExpressApplication;
  let server: App;

  beforeAll(async () => {
    await prisma.$executeRaw`DELETE FROM api_rate_limit`;
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule, BoomModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>({
      bodyParser: false,
      logger: false,
    });
    configureApp(app);
    await app.init();
    server = app.getHttpServer() as App;
  });

  it('GET /api/health is public', () => {
    return request(server).get('/api/health').expect(200).expect({ status: 'ok' });
  });

  it('GET /api/finance requires a session', () => {
    return request(server).get('/api/finance').expect(401);
  });

  it('sends security headers and hides Express', async () => {
    const res = await request(server).get('/api/health').expect(200);
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('hides internal details of 500 errors', async () => {
    const res = await request(server).get('/api/test/boom').expect(500);
    expect(res.body).toEqual({
      statusCode: 500,
      message: 'Error interno del servidor.',
    });
    expect(JSON.stringify(res.body)).not.toMatch(/secret_table|\/srv\/app|stack/);
  });

  it('rejects bodies over 1 MB with 413', async () => {
    const big = JSON.stringify({ blob: 'x'.repeat(1_100_000) });
    const res = await request(server)
      .post('/api/finance/import')
      .set('Content-Type', 'application/json')
      .send(big)
      .expect(413);
    expect(res.body.message).toBe('La petición es demasiado grande.');
  });

  it('answers 400 to malformed JSON without echoing it', async () => {
    const res = await request(server)
      .post('/api/transactions')
      .set('Content-Type', 'application/json')
      .send('{"password":"oops"')
      .expect(400);
    expect(JSON.stringify(res.body)).not.toContain('oops');
  });

  it('rate limits the API per IP with 429', async () => {
    const limit = Number(process.env.API_RATE_LIMIT ?? 120);
    await prisma.$executeRaw`DELETE FROM api_rate_limit`;
    for (let i = 0; i < limit; i++) {
      await request(server).get('/api/health').expect(200);
    }
    const res = await request(server).get('/api/health').expect(429);
    expect(res.body.message).toMatch(/Demasiadas solicitudes/);
    expect(res.headers['retry-after-api']).toBeDefined();
  });

  it('does not apply the API limit to /api/auth (it has its own)', async () => {
    await request(server).get('/api/auth/get-session').expect(200);
  });

  afterAll(async () => {
    await app.close();
  });
});
