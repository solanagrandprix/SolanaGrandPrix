const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Adding CalendarEvent table...');
  
  try {
    // Check if table already exists by trying to query it
    await prisma.$queryRaw`SELECT 1 FROM CalendarEvent LIMIT 1`;
    console.log('CalendarEvent table already exists.');
  } catch (e) {
    // Table doesn't exist, create it
    console.log('Creating CalendarEvent table...');
    
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CalendarEvent" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "title" TEXT NOT NULL,
        "description" TEXT,
        "eventDate" DATETIME NOT NULL,
        "eventType" TEXT NOT NULL DEFAULT 'race',
        "track" TEXT,
        "carClass" TEXT,
        "status" TEXT NOT NULL DEFAULT 'scheduled',
        "isActive" INTEGER NOT NULL DEFAULT 1,
        "createdBy" INTEGER,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create index on eventDate for faster queries
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "CalendarEvent_eventDate_idx" ON "CalendarEvent"("eventDate")
    `);
    
    // Create index on isActive for filtering
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "CalendarEvent_isActive_idx" ON "CalendarEvent"("isActive")
    `);
    
    console.log('CalendarEvent table created successfully.');
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
