CREATE TABLE "hsbc_transaction" (
  "id"            INTEGER  NOT NULL PRIMARY KEY AUTOINCREMENT,
  "transactionId" TEXT     NOT NULL,
  "date"          TEXT     NOT NULL,
  "paymentType"   TEXT     NOT NULL,
  "description"   TEXT     NOT NULL,
  "moneyOut"      TEXT,
  "moneyIn"       TEXT,
  "balance"       TEXT,
  "statementDate" TEXT     NOT NULL,
  "owner"         TEXT     NOT NULL DEFAULT 'Joint',
  "importedAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status"        TEXT     NOT NULL DEFAULT 'pending'
);
CREATE UNIQUE INDEX "hsbc_transaction_transactionId_key" ON "hsbc_transaction"("transactionId");
