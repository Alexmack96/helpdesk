-- Drop helpdesk tables
DROP TABLE IF EXISTS "TicketMessage";
DROP TABLE IF EXISTS "Ticket";
DROP TABLE IF EXISTS "Customer";
DROP TABLE IF EXISTS "KnowledgeBaseEntry";
DROP TABLE IF EXISTS "CannedResponse";

-- Drop helpdesk enums
DROP TYPE IF EXISTS "TicketStatus";
DROP TYPE IF EXISTS "TicketPriority";
DROP TYPE IF EXISTS "TicketCategory";

-- Rename UserRole enum value Agent -> User
ALTER TYPE "UserRole" RENAME VALUE 'Agent' TO 'User';

-- Update default on user.role
ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'User'::"UserRole";

-- Create TransactionType enum
CREATE TYPE "TransactionType" AS ENUM ('Income', 'Expense');

-- Create Category table
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- Create Transaction table
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "type" "TransactionType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "categoryId" TEXT NOT NULL,
    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
