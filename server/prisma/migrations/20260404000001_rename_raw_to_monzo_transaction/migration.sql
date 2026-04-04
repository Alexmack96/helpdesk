-- Drop old unified staging table, replace with bank-specific one
DROP TABLE IF EXISTS "raw_transaction";

-- CreateTable: Monzo-specific staging
CREATE TABLE "monzo_transaction" (
    "transactionId"  TEXT     NOT NULL PRIMARY KEY,
    "date"           TEXT     NOT NULL,
    "time"           TEXT     NOT NULL,
    "type"           TEXT     NOT NULL,
    "name"           TEXT     NOT NULL,
    "emoji"          TEXT,
    "category"       TEXT     NOT NULL,
    "amount"         TEXT     NOT NULL,
    "currency"       TEXT     NOT NULL,
    "localAmount"    TEXT     NOT NULL,
    "localCurrency"  TEXT     NOT NULL,
    "notesAndTags"   TEXT,
    "address"        TEXT,
    "receipt"        TEXT,
    "description"    TEXT     NOT NULL,
    "categorySplit"  TEXT,
    "moneyOut"       TEXT,
    "moneyIn"        TEXT,
    "importedAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
