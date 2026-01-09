const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixUserUpdatedAt() {
  try {
    console.log('=== Fixing User.updatedAt Column ===\n');
    console.log('Connecting to database...');
    await prisma.$connect();
    console.log('✅ Connected\n');
    
    // SQLite doesn't support IF NOT EXISTS, so we'll try/catch
    try {
      console.log('Adding User.updatedAt column...');
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "User" ADD COLUMN "updatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP;
      `);
      console.log('✅ Successfully added User.updatedAt column!\n');
    } catch (err) {
      if (err.message && (err.message.includes('duplicate column') || err.message.includes('already exists') || err.message.includes('duplicate'))) {
        console.log('⚠️  User.updatedAt column already exists\n');
      } else {
        console.error('❌ Error:', err.message);
        console.error('Error code:', err.code);
        console.error('\nYou may need to manually add this column.\n');
        throw err;
      }
    }
    
    console.log('=== Done! ===');
    console.log('\nNext steps:');
    console.log('1. Run: npx prisma generate');
    console.log('2. Restart your server: node server.js');
    
  } catch (err) {
    console.error('\n❌ Fatal error:', err.message);
    if (err.code) console.error('Error code:', err.code);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixUserUpdatedAt();
