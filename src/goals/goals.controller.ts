import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { GoalsService } from './goals.service.js';
import {
  goalInput,
  goalPatch,
  type GoalInput,
  type GoalPatch,
} from './goals.schemas.js';

@Controller('goals')
export class GoalsController {
  constructor(private readonly goals: GoalsService) {}

  @Get()
  list(@Session() session: UserSession) {
    return this.goals.list(session.user.id);
  }

  @Get(':id')
  get(@Session() session: UserSession, @Param('id') id: string) {
    return this.goals.get(session.user.id, id);
  }

  @Post()
  create(
    @Session() session: UserSession,
    @Body(new ZodValidationPipe(goalInput)) body: GoalInput,
  ) {
    return this.goals.create(session.user.id, body);
  }

  @Patch(':id')
  update(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(goalPatch)) body: GoalPatch,
  ) {
    return this.goals.update(session.user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Session() session: UserSession, @Param('id') id: string) {
    await this.goals.remove(session.user.id, id);
  }
}
