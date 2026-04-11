-- Drop old CSV-based Monzo staging table
DROP TABLE IF EXISTS "monzo_transaction";

-- Drop OAuth credential table (added in previous migration, no longer needed)
DROP TABLE IF EXISTS "monzo_credential";

-- Wipe processed Monzo transactions so they can be re-synced cleanly from the API
DELETE FROM "transaction" WHERE "externalId" LIKE 'monzo:%';

-- Create new API-native Monzo staging table
CREATE TABLE "monzo_api_transaction" (
  "id"                TEXT     NOT NULL PRIMARY KEY,
  "monzoId"           TEXT     NOT NULL UNIQUE,
  "created"           DATETIME NOT NULL,
  "settled"           DATETIME,
  "amountPence"       INTEGER  NOT NULL,
  "currency"          TEXT     NOT NULL,
  "localAmountPence"  INTEGER  NOT NULL,
  "localCurrency"     TEXT     NOT NULL,
  "description"       TEXT     NOT NULL,
  "notes"             TEXT,
  "monzoCategory"     TEXT     NOT NULL,
  "merchantName"      TEXT,
  "merchantEmoji"     TEXT,
  "merchantAddress"   TEXT,
  "scheme"            TEXT,
  "includeInSpending" BOOLEAN  NOT NULL DEFAULT true,
  "accountId"         TEXT     NOT NULL,
  "importedAt"        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status"            TEXT     NOT NULL DEFAULT 'pending'
);
