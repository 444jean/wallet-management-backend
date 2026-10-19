-- Appearance preferences (T08): brand palette and light/dark theme.
-- No new table, so RLS (enable_rls) already covers it.
-- AlterTable
ALTER TABLE "user" ADD COLUMN     "palette" TEXT NOT NULL DEFAULT 'purple',
ADD COLUMN     "theme" TEXT;

