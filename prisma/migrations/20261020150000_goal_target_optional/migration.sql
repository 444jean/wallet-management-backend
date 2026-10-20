-- T10: "Fondo" = savings goal without a target amount.
ALTER TABLE "savings_goals" ALTER COLUMN "target" DROP NOT NULL;
