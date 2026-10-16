import { Body, Controller, Delete, Get, HttpCode, Put } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { SalaryService } from './salary.service.js';
import { salaryInput, type SalaryInput } from './salary.schemas.js';

@Controller('salary')
export class SalaryController {
  constructor(private readonly salary: SalaryService) {}

  @Get()
  async get(@Session() session: UserSession) {
    return { salary: await this.salary.get(session.user.id) };
  }

  @Put()
  set(
    @Session() session: UserSession,
    @Body(new ZodValidationPipe(salaryInput)) body: SalaryInput,
  ) {
    return this.salary.set(session.user.id, body);
  }

  @Delete()
  @HttpCode(204)
  async clear(@Session() session: UserSession) {
    await this.salary.clear(session.user.id);
  }
}
