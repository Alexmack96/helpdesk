CREATE TABLE "sofi_transaction" (
  "id"            INTEGER  NOT NULL PRIMARY KEY AUTOINCREMENT,
  "transactionId" TEXT     NOT NULL,
  "date"          TEXT     NOT NULL,
  "type"          TEXT     NOT NULL,
  "description"   TEXT     NOT NULL,
  "amount"        TEXT     NOT NULL,
  "isCredit"      BOOLEAN  NOT NULL DEFAULT false,
  "balance"       TEXT,
  "accountType"   TEXT     NOT NULL DEFAULT 'Checking',
  "statementDate" TEXT     NOT NULL,
  "owner"         TEXT     NOT NULL DEFAULT 'Casey',
  "importedAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status"        TEXT     NOT NULL DEFAULT 'pending'
);
CREATE UNIQUE INDEX "sofi_transaction_transactionId_key" ON "sofi_transaction"("transactionId");
