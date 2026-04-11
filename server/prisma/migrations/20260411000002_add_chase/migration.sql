CREATE TABLE "chase_transaction" (
  "id"            INTEGER  NOT NULL PRIMARY KEY AUTOINCREMENT,
  "transactionId" TEXT     NOT NULL,
  "date"          TEXT     NOT NULL,
  "description"   TEXT     NOT NULL,
  "amount"        TEXT     NOT NULL,
  "isCredit"      BOOLEAN  NOT NULL DEFAULT false,
  "statementDate" TEXT     NOT NULL,
  "owner"         TEXT     NOT NULL DEFAULT 'Casey',
  "importedAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status"        TEXT     NOT NULL DEFAULT 'pending'
);
CREATE UNIQUE INDEX "chase_transaction_transactionId_key" ON "chase_transaction"("transactionId");
