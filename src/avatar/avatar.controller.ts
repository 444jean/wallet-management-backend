import { Body, Controller, Delete, Get, HttpCode, Put, Query, Res } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Response } from 'express';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { AvatarService, MAX_AVATAR_BYTES } from './avatar.service.js';

const avatarUpload = z.object({
  /** Base64 image bytes (no data: prefix). */
  data: z
    .string()
    .max(Math.ceil(MAX_AVATAR_BYTES / 3) * 4)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/, 'Expected base64'),
});
type AvatarUpload = z.infer<typeof avatarUpload>;

/** The signed-in user's profile picture (T12). Never served to other users. */
@Controller('me/avatar')
export class AvatarController {
  constructor(private readonly avatars: AvatarService) {}

  @Put()
  put(
    @Session() session: UserSession,
    @Body(new ZodValidationPipe(avatarUpload)) body: AvatarUpload,
  ) {
    return this.avatars.put(session.user.id, Buffer.from(body.data, 'base64'));
  }

  @Get()
  async get(
    @Session() session: UserSession,
    @Query('v') version: string | undefined,
    @Res() res: Response,
  ) {
    const avatar = await this.avatars.get(session.user.id);
    res.setHeader('Content-Type', avatar.mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline; filename="avatar"');
    // Versioned URLs (user.image) never change content: cache them for good.
    res.setHeader(
      'Cache-Control',
      version ? 'private, max-age=31536000, immutable' : 'private, no-cache',
    );
    res.send(Buffer.from(avatar.data));
  }

  @Delete()
  @HttpCode(204)
  async remove(@Session() session: UserSession) {
    await this.avatars.remove(session.user.id);
  }
}
