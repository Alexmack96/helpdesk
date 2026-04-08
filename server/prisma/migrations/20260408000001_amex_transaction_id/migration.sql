-- Clear processed Amex transactions
DELETE FROM "transaction" WHERE "externalId" LIKE 'amex:%';

-- Recreate amex_transaction with string transactionId PK
DROP TABLE "amex_transaction";
CREATE TABLE "amex_transaction" (
  "transactionId"   TEXT     NOT NULL PRIMARY KEY,
  "transactionDate" TEXT     NOT NULL,
  "processDate"     TEXT     NOT NULL,
  "description"     TEXT     NOT NULL,
  "amount"          TEXT     NOT NULL,
  "isCredit"        BOOLEAN  NOT NULL DEFAULT false,
  "foreignCurrency" TEXT,
  "foreignAmount"   TEXT,
  "statementDate"   TEXT     NOT NULL,
  "owner"           TEXT     NOT NULL DEFAULT 'Alex',
  "importedAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
