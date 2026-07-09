-- AlterTable
ALTER TABLE "User" ADD COLUMN     "authProvider" TEXT NOT NULL DEFAULT 'local',
ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "providerId" TEXT,
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_authProvider_providerId_key" ON "User"("authProvider", "providerId");

