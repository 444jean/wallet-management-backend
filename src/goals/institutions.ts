/**
 * Where a savings goal is kept (T11). Codes only: names and colours live in
 * the frontend (`src/lib/institutions.ts`), which must use the same codes.
 */
export const INSTITUTIONS = [
  'banco-chile',
  'bancoestado',
  'santander',
  'bci',
  'scotiabank',
  'itau',
  'bice',
  'security',
  'falabella',
  'ripley',
  'consorcio',
  'internacional',
  'mercado-pago',
  'tenpo',
  'mach',
  'fintual',
  'racional',
  'efectivo',
  'otro',
] as const;

export type Institution = (typeof INSTITUTIONS)[number];
