-- CreateTable
CREATE TABLE "barclays_transaction" (
    "id"            INTEGER  NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date"          TEXT     NOT NULL,
    "description"   TEXT     NOT NULL,
    "amount"        TEXT     NOT NULL,
    "isCredit"      BOOLEAN  NOT NULL DEFAULT false,
    "statementDate" TEXT     NOT NULL,
    "importedAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
