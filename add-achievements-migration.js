// Migration script to add Achievement table
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addAchievementsTable() {
  try {
    console.log('Adding Achievement table...');
    
    // Check if table already exists
    const tableInfo = await prisma.$queryRaw`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='Achievement'
    `;
    
    if (tableInfo && tableInfo.length > 0) {
      console.log('Achievement table already exists. Skipping migration.');
      return;
    }
    
    // Create Achievement table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "Achievement" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "name" TEXT NOT NULL,
        "description" TEXT NOT NULL,
        "icon" TEXT,
        "xpReward" INTEGER NOT NULL DEFAULT 0,
        "rarity" TEXT NOT NULL DEFAULT 'Common',
        "category" TEXT,
        "isActive" INTEGER NOT NULL DEFAULT 1,
        "driverId" INTEGER,
        "unlockedAt" DATETIME,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE
      );
    `);
    
    // Create index for driverId
    await prisma.$executeRawUnsafe(`
      CREATE INDEX "Achievement_driverId_idx" ON "Achievement"("driverId");
    `);
    
    console.log('✓ Successfully created Achievement table');
  } catch (error) {
    if (error.message.includes('already exists') || error.message.includes('duplicate')) {
      console.log('Achievement table already exists. Skipping migration.');
    } else {
      console.error('Error creating Achievement table:', error);
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
}

addAchievementsTable();
