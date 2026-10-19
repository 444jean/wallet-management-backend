import { z } from 'zod';

/** Brand palettes the user can pick (T08). Keep in sync with the frontend. */
export const PALETTES = ['purple', 'red', 'pink', 'green', 'amber'] as const;
export const THEMES = ['light', 'dark'] as const;

export const paletteSchema = z.enum(PALETTES);
export const themeSchema = z.enum(THEMES);
