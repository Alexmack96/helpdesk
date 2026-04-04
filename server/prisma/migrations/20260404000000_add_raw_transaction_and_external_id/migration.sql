-- AlterTable: add externalId to Transaction
ALTER TABLE "Transaction" ADD COLUMN "externalId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_externalId_key" ON "Transaction"("externalId");

-- CreateTable
CREATE TABLE "raw_transaction" (
    "transactionId" TEXT NOT NULL PRIMARY KEY,
    "source"        TEXT NOT NULL,
    "date"          TEXT NOT NULL,
    "time"          TEXT NOT NULL,
    "type"          TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "emoji"         TEXT,
    "category"      TEXT NOT NULL,
    "amount"        TEXT NOT NULL,
    "currency"      TEXT NOT NULL,
    "localAmount"   TEXT NOT NULL,
    "localCurrency" TEXT NOT NULL,
    "notesAndTags"  TEXT,
    "address"       TEXT,
    "receipt"       TEXT,
    "description"   TEXT NOT NULL,
    "categorySplit" TEXT,
    "moneyOut"      TEXT,
    "moneyIn"       TEXT,
    "importedAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
