-- Add apiSource column to existing monzo_transaction table
ALTER TABLE "monzo_transaction" ADD COLUMN "apiSource" BOOLEAN NOT NULL DEFAULT false;

-- Create MonzoCredential table
CREATE TABLE "monzo_credential" (
  "id"             TEXT     NOT NULL PRIMARY KEY,
  "userId"         TEXT     NOT NULL,
  "accessToken"    TEXT     NOT NULL,
  "refreshToken"   TEXT     NOT NULL,
  "expiresAt"      DATETIME NOT NULL,
  "accountId"      TEXT     NOT NULL,
  "lastSyncedTxId" TEXT,
  "lastSyncedAt"   DATETIME,
  "createdAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      DATETIME NOT NULL
);

CREATE UNIQUE INDEX "monzo_credential_userId_key" ON "monzo_credential"("userId");
