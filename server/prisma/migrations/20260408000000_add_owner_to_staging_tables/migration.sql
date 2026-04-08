ALTER TABLE "amex_transaction" ADD COLUMN "owner" TEXT NOT NULL DEFAULT 'Alex';
ALTER TABLE "barclays_transaction" ADD COLUMN "owner" TEXT NOT NULL DEFAULT 'Alex';
ALTER TABLE "santander_transaction" ADD COLUMN "owner" TEXT NOT NULL DEFAULT 'Alex';
