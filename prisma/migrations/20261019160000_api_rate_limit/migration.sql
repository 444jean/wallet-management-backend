-- Global API rate limit shared by every instance (T03, @nestjs/throttler).
-- CreateTable
CREATE TABLE "api_rate_limit" (
    "key" TEXT NOT NULL,
    "hits" INTEGER NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "blocked_until" TIMESTAMPTZ(3),

    CONSTRAINT "api_rate_limit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "api_rate_limit_expires_at_idx" ON "api_rate_limit"("expires_at");

-- Same lockdown as enable_rls: RLS without policies, no access for the
-- Supabase API roles (only exist on Supabase).
ALTER TABLE "api_rate_limit" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON TABLE "api_rate_limit" FROM %I', r);
    END IF;
  END LOOP;
END $$;
