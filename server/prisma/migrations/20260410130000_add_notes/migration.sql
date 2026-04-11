CREATE TABLE "note" (
    "id"        TEXT     NOT NULL PRIMARY KEY,
    "title"     TEXT     NOT NULL,
    "body"      TEXT,
    "pinned"    INTEGER  NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
