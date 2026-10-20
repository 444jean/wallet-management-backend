export type AvatarMime = 'image/png' | 'image/jpeg' | 'image/webp';

/**
 * Image type from its magic bytes, never from what the client claims. Only
 * raster formats: SVG can carry scripts and is never accepted.
 */
export function detectImageType(bytes: Uint8Array): AvatarMime | null {
  const starts = (sig: number[], offset = 0) =>
    bytes.length >= offset + sig.length && sig.every((b, i) => bytes[offset + i] === b);

  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (starts([0xff, 0xd8, 0xff])) return 'image/jpeg';
  // "RIFF" <size> "WEBP"
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) {
    return 'image/webp';
  }
  return null;
}
