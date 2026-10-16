import { Module } from '@nestjs/common';
import { SalaryModule } from '../salary/salary.module.js';
import { FinanceController } from './finance.controller.js';
import { FinanceService } from './finance.service.js';

@Module({
  imports: [SalaryModule],
  controllers: [FinanceController],
  providers: [FinanceService],
})
export class FinanceModule {}
