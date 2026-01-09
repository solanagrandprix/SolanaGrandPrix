-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "driverKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "number" INTEGER NOT NULL DEFAULT 0,
    "team" TEXT NOT NULL DEFAULT 'Privateer',
    "primaryCar" TEXT NOT NULL DEFAULT 'Mazda MX-5 Cup',
    "avatar" TEXT NOT NULL DEFAULT '/images/riley.png',
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Driver_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_userId_key" ON "Driver"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_driverKey_key" ON "Driver"("driverKey");
