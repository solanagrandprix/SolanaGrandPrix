const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Adding DeletionRequest table...');
  
  try {
    // Check if table already exists by trying to query it
    await prisma.$queryRaw`SELECT 1 FROM DeletionRequest LIMIT 1`;
    console.log('DeletionRequest table already exists.');
  } catch (e) {
    // Table doesn't exist, create it
    console.log('Creating DeletionRequest table...');
    
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "DeletionRequest" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "userId" INTEGER NOT NULL UNIQUE,
        "reason" TEXT,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "reviewedBy" INTEGER,
        "reviewedAt" DATETIME,
        "notes" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
    
    // Create index on status for faster queries
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "DeletionRequest_status_idx" ON "DeletionRequest"("status")
    `);
    
    console.log('DeletionRequest table created successfully.');
  }
  
  console.log('Migration complete!');
}

main()
  .catch((e) => {
    console.error('Migration error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
