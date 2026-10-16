import { Global, Module, OnApplicationShutdown } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma/client.js';
import { prisma } from './prisma.js';

@Global()
@Module({
  providers: [{ provide: PrismaClient, useValue: prisma }],
  exports: [PrismaClient],
})
export class PrismaModule implements OnApplicationShutdown {
  async onApplicationShutdown() {
    await prisma.$disconnect();
  }
}
