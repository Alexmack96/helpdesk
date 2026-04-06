-- CreateTable
CREATE TABLE "amex_transaction" (
    "id"              INTEGER  NOT NULL PRIMARY KEY AUTOINCREMENT,
    "transactionDate" TEXT     NOT NULL,
    "processDate"     TEXT     NOT NULL,
    "description"     TEXT     NOT NULL,
    "amount"          TEXT     NOT NULL,
    "isCredit"        BOOLEAN  NOT NULL DEFAULT false,
    "foreignCurrency" TEXT,
    "foreignAmount"   TEXT,
    "statementDate"   TEXT     NOT NULL,
    "importedAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
