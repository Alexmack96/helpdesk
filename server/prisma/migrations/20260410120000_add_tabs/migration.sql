CREATE TABLE "tab" (
    "id"          TEXT     NOT NULL PRIMARY KEY,
    "person"      TEXT     NOT NULL,
    "description" TEXT     NOT NULL,
    "amount"      DECIMAL  NOT NULL,
    "direction"   TEXT     NOT NULL,
    "status"      TEXT     NOT NULL DEFAULT 'Open',
    "dueDate"     DATETIME,
    "settledAt"   DATETIME,
    "note"        TEXT,
    "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
