-- CreateTable
CREATE TABLE "IracingAccount" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "custId" INTEGER NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "displayName" TEXT,
    "lastSyncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IracingAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IracingSession" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sessionId" TEXT NOT NULL,
    "sessionType" TEXT NOT NULL,
    "leagueId" INTEGER,
    "leagueName" TEXT,
    "trackName" TEXT NOT NULL,
    "carName" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL,
    "subSessionId" INTEGER,
    "seasonId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "IracingSessionParticipant" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sessionId" TEXT NOT NULL,
    "custId" INTEGER NOT NULL,
    "displayName" TEXT NOT NULL,
    "lapsCompleted" INTEGER NOT NULL DEFAULT 0,
    "bestLapTime" REAL,
    "incidents" INTEGER NOT NULL DEFAULT 0,
    "finishPosition" INTEGER,
    "startingPosition" INTEGER,
    "totalLaps" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IracingSessionParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "IracingSession" ("sessionId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Driver" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "driverKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "number" INTEGER NOT NULL DEFAULT 0,
    "team" TEXT NOT NULL DEFAULT 'Privateer',
    "primaryCar" TEXT NOT NULL DEFAULT 'Mazda MX-5 Cup',
    "avatar" TEXT NOT NULL DEFAULT '/images/default-avatar.png',
    "irating" INTEGER NOT NULL DEFAULT 0,
    "license" TEXT NOT NULL DEFAULT 'Rookie',
    "starts" INTEGER NOT NULL DEFAULT 0,
    "freeAgent" BOOLEAN NOT NULL DEFAULT true,
    "xpTotal" INTEGER NOT NULL DEFAULT 0,
    "xpLevel" INTEGER NOT NULL DEFAULT 1,
    "xpToNext" INTEGER NOT NULL DEFAULT 500,
    "skillTier" TEXT NOT NULL DEFAULT 'Beginner',
    "bestFinish" INTEGER NOT NULL DEFAULT 0,
    "winRate" REAL NOT NULL DEFAULT 0,
    "totalPurse" INTEGER NOT NULL DEFAULT 0,
    "preferredClasses" TEXT,
    "country" TEXT,
    "timezone" TEXT,
    "twitch" TEXT,
    "twitter" TEXT,
    "discord" TEXT,
    "iracing" TEXT,
    "solanaWallet" TEXT,
    "driverNotes" TEXT,
    "cardCustomization" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Driver_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Driver" ("avatar", "bestFinish", "cardCustomization", "country", "createdAt", "discord", "displayName", "driverKey", "driverNotes", "freeAgent", "id", "iracing", "irating", "license", "number", "preferredClasses", "primaryCar", "skillTier", "solanaWallet", "starts", "team", "timezone", "totalPurse", "twitch", "twitter", "updatedAt", "userId", "winRate", "xpLevel", "xpToNext", "xpTotal") SELECT "avatar", "bestFinish", "cardCustomization", "country", "createdAt", "discord", "displayName", "driverKey", "driverNotes", "freeAgent", "id", "iracing", "irating", "license", "number", "preferredClasses", "primaryCar", "skillTier", "solanaWallet", "starts", "team", "timezone", "totalPurse", "twitch", "twitter", "updatedAt", "userId", "winRate", "xpLevel", "xpToNext", "xpTotal" FROM "Driver";
DROP TABLE "Driver";
ALTER TABLE "new_Driver" RENAME TO "Driver";
CREATE UNIQUE INDEX "Driver_userId_key" ON "Driver"("userId");
CREATE UNIQUE INDEX "Driver_driverKey_key" ON "Driver"("driverKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "IracingAccount_userId_key" ON "IracingAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "IracingAccount_custId_key" ON "IracingAccount"("custId");

-- CreateIndex
CREATE UNIQUE INDEX "IracingSession_sessionId_key" ON "IracingSession"("sessionId");

-- CreateIndex
CREATE INDEX "IracingSessionParticipant_custId_idx" ON "IracingSessionParticipant"("custId");

-- CreateIndex
CREATE UNIQUE INDEX "IracingSessionParticipant_sessionId_custId_key" ON "IracingSessionParticipant"("sessionId", "custId");
