import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma/client.js';
import { detectImageType, type AvatarMime } from './image-type.js';

/** The browser sends a 256x256 WebP of ~20 KB; this leaves ample room. */
export const MAX_AVATAR_BYTES = 200 * 1024;
export const AVATAR_PATH = '/api/me/avatar';

/**
 * Profile pictures in Postgres (T12). All storage goes through this class, so
 * moving to an object store later only changes this file.
 */
@Injectable()
export class AvatarService {
  constructor(private readonly prisma: PrismaClient) {}

  /** Stores the picture and points user.image at a versioned URL. */
  async put(userId: string, bytes: Uint8Array) {
    if (bytes.length === 0) throw new BadRequestException('La imagen está vacía.');
    if (bytes.length > MAX_AVATAR_BYTES) {
      throw new BadRequestException('La imagen supera los 200 KB.');
    }
    const mimeType = detectImageType(bytes);
    if (!mimeType) throw new BadRequestException('Formato no soportado. Usa PNG, JPEG o WebP.');

    const data = new Uint8Array(bytes);
    const row = await this.prisma.userAvatar.upsert({
      where: { userId },
      create: { userId, data, mimeType },
      update: { data, mimeType },
    });
    // A new URL on every change lets the browser cache each version forever.
    const image = `${AVATAR_PATH}?v=${row.updatedAt.getTime()}`;
    await this.prisma.user.update({ where: { id: userId }, data: { image } });
    return { image };
  }

  async get(userId: string): Promise<{ data: Uint8Array; mimeType: AvatarMime; updatedAt: Date }> {
    const row = await this.prisma.userAvatar.findUnique({ where: { userId } });
    if (!row) throw new NotFoundException('Sin foto de perfil');
    return { data: row.data, mimeType: row.mimeType as AvatarMime, updatedAt: row.updatedAt };
  }

  async remove(userId: string) {
    await this.prisma.userAvatar.deleteMany({ where: { userId } });
    await this.prisma.user.update({ where: { id: userId }, data: { image: null } });
  }
}
