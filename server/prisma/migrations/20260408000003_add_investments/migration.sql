CREATE TABLE "investment_account" (
    "id"        TEXT     NOT NULL PRIMARY KEY,
    "name"      TEXT     NOT NULL,
    "category"  TEXT     NOT NULL,
    "rate"      REAL,
    "sortOrder" INTEGER  NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "investment_account_name_key" ON "investment_account"("name");

CREATE TABLE "investment_snapshot" (
    "id"        TEXT     NOT NULL PRIMARY KEY,
    "accountId" TEXT     NOT NULL,
    "date"      DATETIME NOT NULL,
    "value"     REAL     NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "investment_snapshot_accountId_fkey"
        FOREIGN KEY ("accountId") REFERENCES "investment_account" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "investment_snapshot_accountId_date_key"
    ON "investment_snapshot"("accountId", "date");
