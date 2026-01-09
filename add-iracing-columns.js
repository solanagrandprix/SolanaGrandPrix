const { PrismaClient } = require('@prisma/client');

async function addColumns() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Connecting to database...');
    await prisma.$connect();
    console.log('✅ Connected\n');
    
    // Add missing columns one by one with error handling
    const columns = [
      { name: 'iracing', sql: 'ALTER TABLE "Driver" ADD COLUMN "iracing" TEXT;' },
      { name: 'solanaWallet', sql: 'ALTER TABLE "Driver" ADD COLUMN "solanaWallet" TEXT;' },
      { name: 'cardCustomization', sql: 'ALTER TABLE "Driver" ADD COLUMN "cardCustomization" TEXT;' },
    ];
    
    for (const col of columns) {
      try {
        console.log(`Attempting to add column: ${col.name}...`);
        await prisma.$executeRawUnsafe(col.sql);
        console.log(`✅ Added column: ${col.name}\n`);
      } catch (err) {
        if (err.message && (err.message.includes('duplicate column') || err.message.includes('already exists'))) {
          console.log(`⚠️  Column ${col.name} already exists\n`);
        } else {
          console.error(`❌ Error adding ${col.name}:`, err.message);
          console.error('Error code:', err.code);
        }
      }
    }
    
    console.log('✅ All columns processed!');
    console.log('\nNext steps:');
    console.log('1. Run: npx prisma generate');
    console.log('2. Restart your server');
    
  } catch (err) {
    console.error('❌ Fatal error:', err.message);
    console.error('Error code:', err.code);
  } finally {
    await prisma.$disconnect();
  }
}

addColumns();
