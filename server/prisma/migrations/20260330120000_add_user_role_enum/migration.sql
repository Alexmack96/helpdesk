-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('Admin', 'Agent');

-- AlterTable
ALTER TABLE "user" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "user" ALTER COLUMN "role" TYPE "UserRole" USING "role"::"UserRole";
ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'Agent'::"UserRole";
