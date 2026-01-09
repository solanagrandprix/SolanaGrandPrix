const { PrismaClient } = require('@prisma/client');

async function addUpdatedAtColumn() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Connecting to database...');
    await prisma.$connect();
    console.log('✅ Connected\n');
    
    console.log('Checking if User.updatedAt column exists...');
    
    // Check if column exists by trying to add it (SQLite doesn't support IF NOT EXISTS)
    try {
      console.log('Attempting to add User.updatedAt column...');
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "User" ADD COLUMN "updatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP;
      `);
      console.log('✅ Added User.updatedAt column\n');
    } catch (err) {
      if (err.message && (err.message.includes('duplicate column') || err.message.includes('already exists'))) {
        console.log('⚠️  User.updatedAt column already exists\n');
      } else {
        console.error('❌ Error adding User.updatedAt:', err.message);
        console.error('Error code:', err.code);
        // Continue anyway - we'll handle it in code
      }
    }
    
    console.log('✅ Column check complete!');
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

addUpdatedAtColumn();
