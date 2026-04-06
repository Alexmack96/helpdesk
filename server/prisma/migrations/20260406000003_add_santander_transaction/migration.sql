-- CreateTable
CREATE TABLE "santander_transaction" (
    "id"            INTEGER  NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date"          TEXT     NOT NULL,
    "description"   TEXT     NOT NULL,
    "moneyIn"       TEXT,
    "moneyOut"      TEXT,
    "balance"       TEXT     NOT NULL,
    "statementDate" TEXT     NOT NULL,
    "importedAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
