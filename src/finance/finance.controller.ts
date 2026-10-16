import { Body, Controller, Delete, Get, HttpCode, Post } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { FinanceService } from './finance.service.js';
import { financeImport, type FinanceImport } from './finance.schemas.js';

@Controller('finance')
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get()
  snapshot(@Session() session: UserSession) {
    return this.finance.snapshot(session.user.id);
  }

  @Post('import')
  import(
    @Session() session: UserSession,
    @Body(new ZodValidationPipe(financeImport)) body: FinanceImport,
  ) {
    return this.finance.import(session.user.id, body);
  }

  @Delete()
  @HttpCode(204)
  async reset(@Session() session: UserSession) {
    await this.finance.reset(session.user.id);
  }
}
