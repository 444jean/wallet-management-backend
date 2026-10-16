import { Controller, Get } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { PrismaClient } from './generated/prisma/client.js';

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaClient) {}

  @Get('health')
  @AllowAnonymous()
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok' };
  }
}
