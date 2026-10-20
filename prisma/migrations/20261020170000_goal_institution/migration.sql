-- T11: bank or wallet where a savings goal is kept (code from src/goals/institutions.ts).
ALTER TABLE "savings_goals" ADD COLUMN "institution" TEXT;
