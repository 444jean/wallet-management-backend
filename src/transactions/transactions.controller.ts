import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { TransactionsService } from './transactions.service.js';
import {
  transactionFilters,
  transactionInput,
  transactionPatch,
  type TransactionFilters,
  type TransactionInput,
  type TransactionPatch,
} from './transactions.schemas.js';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get()
  list(
    @Session() session: UserSession,
    @Query(new ZodValidationPipe(transactionFilters))
    filters: TransactionFilters,
  ) {
    return this.transactions.list(session.user.id, filters);
  }

  @Get(':id')
  get(@Session() session: UserSession, @Param('id') id: string) {
    return this.transactions.get(session.user.id, id);
  }

  @Post()
  create(
    @Session() session: UserSession,
    @Body(new ZodValidationPipe(transactionInput)) body: TransactionInput,
  ) {
    return this.transactions.create(session.user.id, body);
  }

  @Patch(':id')
  update(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(transactionPatch)) body: TransactionPatch,
  ) {
    return this.transactions.update(session.user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Session() session: UserSession, @Param('id') id: string) {
    await this.transactions.remove(session.user.id, id);
  }
}
