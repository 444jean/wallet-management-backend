import { describe, expect, it, vi } from 'vitest';
import { AvatarService, MAX_AVATAR_BYTES } from './avatar.service.js';
import { detectImageType } from './image-type.js';

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const WEBP = Uint8Array.from([
  0x52, 0x49, 0x46, 0x46, 0x10, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
]);
const text = (s: string) => new TextEncoder().encode(s);

describe('detectImageType (T12)', () => {
  it('detects PNG, JPEG and WebP by their magic bytes', () => {
    expect(detectImageType(PNG)).toBe('image/png');
    expect(detectImageType(JPEG)).toBe('image/jpeg');
    expect(detectImageType(WEBP)).toBe('image/webp');
  });

  it('rejects SVG, GIF, other RIFF files and plain text', () => {
    expect(detectImageType(text('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(detectImageType(text('GIF89a....'))).toBeNull();
    expect(detectImageType(text('RIFF....WAVEfmt '))).toBeNull();
    expect(detectImageType(text('hola'))).toBeNull();
    expect(detectImageType(new Uint8Array())).toBeNull();
  });
});

function setup() {
  const updatedAt = new Date('2026-10-20T15:00:00Z');
  const prisma = {
    userAvatar: {
      upsert: vi.fn().mockResolvedValue({ updatedAt }),
      findUnique: vi.fn().mockResolvedValue(null),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    user: { update: vi.fn().mockResolvedValue({}) },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { service: new AvatarService(prisma as any), prisma, updatedAt };
}

describe('AvatarService (T12)', () => {
  it('stores a valid image and points user.image at a versioned URL', async () => {
    const { service, prisma, updatedAt } = setup();
    const res = await service.put('u1', WEBP);
    expect(prisma.userAvatar.upsert.mock.calls[0][0].create.mimeType).toBe('image/webp');
    expect(res.image).toBe(`/api/me/avatar?v=${updatedAt.getTime()}`);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { image: res.image },
    });
  });

  it('rejects unsupported formats, empty and oversized files without saving', async () => {
    const { service, prisma } = setup();
    await expect(service.put('u1', text('<svg></svg>'))).rejects.toThrow(/Formato/);
    await expect(service.put('u1', new Uint8Array())).rejects.toThrow(/vacía/);
    const big = new Uint8Array(MAX_AVATAR_BYTES + 1);
    big.set(PNG);
    await expect(service.put('u1', big)).rejects.toThrow(/200 KB/);
    expect(prisma.userAvatar.upsert).not.toHaveBeenCalled();
  });

  it('answers 404 when there is no picture', async () => {
    const { service } = setup();
    await expect(service.get('u1')).rejects.toThrow(/Sin foto/);
  });

  it('removing the picture clears user.image', async () => {
    const { service, prisma } = setup();
    await service.remove('u1');
    expect(prisma.userAvatar.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { image: null } });
  });
});
