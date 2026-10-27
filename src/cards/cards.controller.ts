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
import { CardsService } from './cards.service.js';
import {
  cardInput,
  cardPatch,
  purchaseInput,
  purchasePatch,
  type CardInput,
  type CardPatch,
  type PurchaseInput,
  type PurchasePatch,
} from './cards.schemas.js';

@Controller('cards')
export class CardsController {
  constructor(private readonly cards: CardsService) {}

  @Get()
  list(@Session() session: UserSession) {
    return this.cards.list(session.user.id);
  }

  @Get(':id')
  get(@Session() session: UserSession, @Param('id') id: string) {
    return this.cards.get(session.user.id, id);
  }

  @Post()
  create(
    @Session() session: UserSession,
    @Body(new ZodValidationPipe(cardInput)) body: CardInput,
  ) {
    return this.cards.create(session.user.id, body);
  }

  @Patch(':id')
  update(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(cardPatch)) body: CardPatch,
  ) {
    return this.cards.update(session.user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Session() session: UserSession, @Param('id') id: string) {
    await this.cards.remove(session.user.id, id);
  }

  @Post(':id/purchases')
  addPurchase(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(purchaseInput)) body: PurchaseInput,
  ) {
    return this.cards.addPurchase(session.user.id, id, body);
  }

  @Patch(':id/purchases/:purchaseId')
  updatePurchase(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Param('purchaseId') purchaseId: string,
    @Body(new ZodValidationPipe(purchasePatch)) body: PurchasePatch,
  ) {
    return this.cards.updatePurchase(session.user.id, id, purchaseId, body);
  }

  @Delete(':id/purchases/:purchaseId')
  @HttpCode(204)
  async removePurchase(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Param('purchaseId') purchaseId: string,
  ) {
    await this.cards.removePurchase(session.user.id, id, purchaseId);
  }
}
