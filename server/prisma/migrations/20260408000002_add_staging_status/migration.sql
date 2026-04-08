ALTER TABLE "monzo_transaction" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "amex_transaction"  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "barclays_transaction" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "santander_transaction" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'pending';
